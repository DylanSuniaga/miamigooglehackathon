import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { streamText } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { extractDelegationBlocks, stripDelegationBlocks } from "@/lib/agents/delegation-parser";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

const getSandboxPrompt = (isServer: boolean) => `
## Code Execution
When your task requires producing a visualization, chart, graph, animation, data output, or any executable result:
1. WRITE the actual runnable code — do NOT describe it only in prose.
2. Wrap it inside a designated XML tag:
<sandbox language="python" title="<title>"${isServer ? ' mode="server"' : ''}>
<full runnable code>
</sandbox>
3. ${isServer ? "You are running in a persistent Ubuntu server sandbox with 'pip install' and full filesystem access." : "Python + matplotlib preferred. For interactive web content use HTML/JS."}
4. For multi-step tasks produce multiple <sandbox> blocks.
`;

const DELEGATION_SYSTEM_PROMPT = `
## Agent Delegation  
To delegate a subtask to another agent:
<<<DELEGATE:{"to":"<handle>","task":"<clear task>"}>>>
The system spawns that agent and streams their response to the channel.
`;

export async function POST(req: NextRequest) {
  const { channelId, agentId, taskDescription, contextScope } = await req.json();

  if (!channelId || !agentId || !taskDescription) {
    return NextResponse.json(
      { error: "channelId, agentId, and taskDescription are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const startTime = Date.now();

  // 1. Load agent config
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // 2. Assemble context snapshot
  const contextParts: string[] = [];

  // Channel messages (if scope includes chat)
  if (contextScope !== "docs_only") {
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (recentMessages && recentMessages.length > 0) {
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, handle")
        .eq("workspace_id", WORKSPACE_ID);

      const agentMap = new Map(
        (allAgents ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle])
      );

      const chatHistory = (recentMessages ?? [])
        .reverse()
        .map((msg: { sender_type: string; sender_id: string; content: string }) => {
          const prefix =
            msg.sender_type === "agent"
              ? `[@${agentMap.get(msg.sender_id) ?? "agent"}]`
              : "[User]";
          return `${prefix}: ${msg.content}`;
        })
        .join("\n\n");

      contextParts.push(`## Recent Channel History\n${chatHistory}`);
    }
  }

  // Agent context documents (if scope includes docs)
  if (contextScope !== "chat_only") {
    const { data: contextDocs } = await supabase
      .from("agent_context_documents")
      .select("*")
      .eq("agent_id", agentId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (contextDocs && contextDocs.length > 0) {
      const docsText = contextDocs
        .map((d: { title: string; content: string; doc_type: string }) =>
          `### ${d.title} (${d.doc_type})\n${d.content}`
        )
        .join("\n\n---\n\n");

      contextParts.push(`## Agent Context Documents\n${docsText}`);
    }
  }

  const assembledContext = contextParts.join("\n\n---\n\n");

  // 3. Insert agent_run with status "running"
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      agent_id: agentId,
      channel_id: channelId,
      status: "running",
      input_summary: taskDescription.slice(0, 500),
      model_used: agent.model,
      started_at: new Date().toISOString(),
      steps: [{ step: "started", timestamp: new Date().toISOString() }],
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "Failed to create agent run" }, { status: 500 });
  }

  // 4. Post system message to channel
  await supabase.from("messages").insert({
    channel_id: channelId,
    sender_type: "system",
    sender_id: agent.id,
    content: `🚀 **${agent.display_name}** launched — "${taskDescription.slice(0, 100)}"`,
    metadata: { run_id: run.id, type: "agent_launch" },
  });

  // 5. Set up broadcast channel for streaming
  const broadcastClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const broadcastChannel = broadcastClient.channel(`stream:${channelId}`);
  await broadcastChannel.subscribe();

  // 6. Stream the execution
  let fullContent = "";
  let tokenInput = 0;
  let tokenOutput = 0;

  try {
    // Update run steps
    await supabase
      .from("agent_runs")
      .update({
        steps: [
          { step: "started", timestamp: new Date().toISOString() },
          { step: "context_assembled", contextLength: assembledContext.length, timestamp: new Date().toISOString() },
          { step: "streaming", timestamp: new Date().toISOString() },
        ],
      })
      .eq("id", run.id);

    const executionPrompt = `${assembledContext ? `\n\n---\n\nCONTEXT:\n${assembledContext}` : ""}

---

TASK: ${taskDescription}

Execute this task thoroughly. Provide actionable, structured output.`;

  // Load universal workspace instructions & build effective system prompt
  const { data: wsInstructions } = await supabase
    .from("workspace_instructions")
    .select("content, excluded_agent_ids")
    .eq("workspace_id", WORKSPACE_ID)
    .maybeSingle();

  // Load agent directory for inter-agent awareness
  const { data: allAgentsForDir } = await supabase
    .from("agents")
    .select("handle, display_name, description")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("is_active", true);

  const agentDirectory = (allAgentsForDir ?? [])
    .filter((a: { handle: string }) => a.handle !== agent.handle)
    .map((a: { handle: string; display_name: string; description: string }) =>
      `@${a.handle} (${a.display_name})${a.description ? ": " + a.description : ""}`
    )
    .join("\n");

  const enabledTools = (agent.tools as string[]) ?? [];
  const promptParts: string[] = [];

  if (wsInstructions?.content && !(wsInstructions.excluded_agent_ids ?? []).includes(agent.id)) {
    promptParts.push(`[Universal Instructions]\n${wsInstructions.content}`);
  }
  promptParts.push(`[Your Instructions]\n${agent.system_prompt}`);
  if (agentDirectory) promptParts.push(`[Available Agents]\n${agentDirectory}`);
  if (enabledTools.includes("run_code") || enabledTools.includes("e2b_sandbox")) {
    promptParts.push(getSandboxPrompt(enabledTools.includes("e2b_sandbox")).trim());
  }
  if (enabledTools.includes("delegate")) promptParts.push(DELEGATION_SYSTEM_PROMPT.trim());

  const effectiveSystemPrompt = promptParts.join("\n\n---\n\n");

  const result = streamText({
      model: getModel(agent.model),
      system: effectiveSystemPrompt,
      messages: [{ role: "user", content: executionPrompt }],
      temperature: agent.temperature,
    });

    for await (const chunk of result.textStream) {
      fullContent += chunk;

      // Broadcast progress
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id,
          agentHandle: agent.handle,
          agentName: agent.display_name,
          agentEmoji: agent.avatar_emoji,
          agentColor: agent.color,
          model: agent.model,
          content: fullContent,
          done: false,
          runId: run.id,
        },
      });
    }

    // Try to get token usage
    const usage = await result.usage;
    tokenInput = (usage as any)?.inputTokens ?? (usage as any)?.promptTokens ?? 0;
    tokenOutput = (usage as any)?.outputTokens ?? (usage as any)?.completionTokens ?? 0;

    const durationMs = Date.now() - startTime;

    // 7. Update agent_run to completed
    await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        output_summary: fullContent.slice(0, 2000),
        token_count_input: tokenInput,
        token_count_output: tokenOutput,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
        steps: [
          { step: "started", timestamp: run.started_at },
          { step: "context_assembled", contextLength: assembledContext.length },
          { step: "streaming" },
          { step: "completed", durationMs, tokens: tokenInput + tokenOutput },
        ],
      })
      .eq("id", run.id);

    // 8. Insert final message
    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: fullContent,
      metadata: {
        model: agent.model,
        run_id: run.id,
        type: "execution_result",
        duration_ms: durationMs,
        tokens: tokenInput + tokenOutput,
      },
    });

    // Send done signal
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: fullContent,
        done: true,
        runId: run.id,
      },
    });
  } catch (err) {
    console.error(`Execution agent error:`, err);

    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: `⚠️ Execution failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        done: true,
        runId: run.id,
      },
    });
  } finally {
    broadcastClient.removeChannel(broadcastChannel);
  }

  return NextResponse.json({ success: true, runId: run.id });
}
