import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { generateText, streamText } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  extractDelegationBlocks,
  stripDelegationBlocks,
  extractAgentSpecBlock,
  hasAgentSpecBlock,
} from "@/lib/agents/delegation-parser";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

// Sandbox usage prompt
const getSandboxPrompt = (isServer: boolean) => `
## Code Execution
When asked for a visualization, chart, graph, animation, data table, interactive demo, simulation, or any executable output:
1. WRITE the actual code — do NOT only describe it in text.
2. Wrap it like this:
<sandbox language="python" title="<short descriptive title>"${isServer ? ' mode="server"' : ''}>
<full runnable code>
</sandbox>
3. ${isServer ? "You are running in a persistent Ubuntu server sandbox with 'pip install' and full filesystem access." : "Python + matplotlib is preferred for charts/plots. Use numpy for math. Use pandas for data."}
4. After the sandbox block, you may add brief explanation text.
5. For multi-step tasks: produce a <sandbox> block for each executable component.
`;

// Delegation prompt — appended when agent has delegate tool enabled
const DELEGATION_SYSTEM_PROMPT = `
## Agent Delegation
To delegate a subtask to another agent, emit:
<<<DELEGATE:{"to":"<handle>","task":"<clear task description}>>>
The system will invoke that agent and stream their response. Max one level of delegation.
`;

// Debug instruction (added to agents with run_code tool)
const DEBUG_INSTRUCTION = `
SPECIAL DEBUG INSTRUCTION: If you want to silently validate complex Python code before displaying it (highly recommended), wrap it in: <ask_debugger>
YOUR CODE
</ask_debugger>. This guarantees a silent validation cycle before you finalize the sandbox.`;

export async function POST(req: NextRequest) {
  const { channelId, agentHandle } = await req.json();

  if (!channelId || !agentHandle) {
    return NextResponse.json(
      { error: "channelId and agentHandle are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const startTime = Date.now();

  // Load agent config
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("handle", agentHandle)
    .eq("workspace_id", WORKSPACE_ID)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { error: `Agent @${agentHandle} not found` },
      { status: 404 }
    );
  }

  // Load last 50 messages for context
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  const history = (recentMessages ?? []).reverse();

  // Load agent directory (so agents know about each other)
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, handle, display_name, description, tools")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("is_active", true);

  const agentMap = new Map(
    (allAgents ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle])
  );

  // Build agent directory string for inter-agent awareness
  const agentDirectory = (allAgents ?? [])
    .filter((a: { handle: string }) => a.handle !== agentHandle)
    .map((a: { handle: string; display_name: string; description: string }) =>
      `@${a.handle} (${a.display_name})${a.description ? `: ${a.description}` : ""}`
    )
    .join("\n");

  // Load workspace universal instructions
  const { data: wsInstructions } = await supabase
    .from("workspace_instructions")
    .select("content, excluded_agent_ids")
    .eq("workspace_id", WORKSPACE_ID)
    .maybeSingle();

  // Build effective system prompt
  const enabledTools = (agent.tools as string[]) ?? [];
  const promptParts: string[] = [];

  if (wsInstructions?.content && !(wsInstructions.excluded_agent_ids ?? []).includes(agent.id)) {
    promptParts.push(`[Universal Instructions]\n${wsInstructions.content}`);
  }

  promptParts.push(`[Your Instructions]\n${agent.system_prompt}`);

  if (agentDirectory) {
    promptParts.push(`[Available Agents — you can suggest or delegate to them]\n${agentDirectory}`);
  }

  if (enabledTools.includes("run_code") || enabledTools.includes("e2b_sandbox")) {
    promptParts.push(getSandboxPrompt(enabledTools.includes("e2b_sandbox")).trim());
    promptParts.push(DEBUG_INSTRUCTION.trim());
  }

  if (enabledTools.includes("delegate")) {
    promptParts.push(DELEGATION_SYSTEM_PROMPT.trim());
  }

  // Unconditional build capabilities
  promptParts.push(
    `## Code & Workspace Tooling\nYou can ALWAYS ask the '@build' agent to write/execute visual code or create scaffolding and subagents for you.\nUse this syntax to delegate to it:\n<<<DELEGATE:{"to":"build","task":"<what you need>"}>>>`
  );

  const effectiveSystemPrompt = promptParts.join("\n\n---\n\n");

  // Build conversation messages
  const conversationMessages = history.map((msg: { sender_type: string; sender_id: string; content: string }) => {
    if (msg.sender_type === "agent") {
      const handle = agentMap.get(msg.sender_id) ?? "agent";
      return {
        role: "assistant" as const,
        content: `[@${handle}]: ${msg.content}`,
      };
    }
    return {
      role: "user" as const,
      content: msg.content,
    };
  });

  // Set up broadcast channel for streaming tokens
  const broadcastClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const broadcastChannel = broadcastClient.channel(`stream:${channelId}`);
  await broadcastChannel.subscribe();

  // Create agent_run record
  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      agent_id: agent.id,
      channel_id: channelId,
      status: "running",
      input_summary: (history[history.length - 1]?.content ?? "").slice(0, 500),
      model_used: agent.model,
      started_at: new Date().toISOString(),
      steps: [{ step: "started", timestamp: new Date().toISOString() }],
    })
    .select()
    .single();

  const runId = run?.id;

  // ─── Helper: silent debug loop via generateText ─────────────────────
  async function runDebugLoop(draftText: string): Promise<string> {
    const debugMatch = /<ask_debugger>([\s\S]*?)<\/ask_debugger>/g;
    const matches = [...draftText.matchAll(debugMatch)];

    if (matches.length === 0) return draftText;

    // Send a "thinking" status to update broadcast
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
        content: "🔍 *Reviewing code for errors before delivering...*",
        done: false,
        runId,
      },
    });

    // Update run status
    if (runId) {
      await supabase.from("agent_runs").update({
        steps: [
          { step: "started" },
          { step: "draft_generated" },
          { step: "debugging_code", timestamp: new Date().toISOString() },
        ],
      }).eq("id", runId);
    }

    // Validate each code block silently
    let debugFeedback = "";
    for (const m of matches) {
      const codeToTest = m[1];
      const debugValidation = await generateText({
        model: getModel("google:gemini-2.5-flash"),
        system: `You are @debugger, a merciless Python code reviewer specialized in Pyodide browser execution. Evaluate the provided code for:
1. Missing imports
2. Syntax errors
3. Bad indentation
4. Pyodide/browser incompatibility (e.g. FuncAnimation with plt.show() crashes — must use to_jshtml() or savefig instead)
5. Using features not available in Pyodide

If the code is 100% bug-free and robust, reply EXACTLY with 'CODE_APPROVED'.
Otherwise, explain the exact error and write the corrected complete code.`,
        prompt: codeToTest,
      });
      debugFeedback += `\n\n--- Debugger Feedback ---\n${debugValidation.text}\n`;
    }

    // Feed the debug results back into the agent for a second generation
    const correctionResult = await generateText({
      model: getModel(agent.model),
      system: effectiveSystemPrompt,
      messages: [
        ...conversationMessages,
        {
          role: "assistant" as const,
          content: draftText,
        },
        {
          role: "user" as const,
          content: `[SYSTEM — INTERNAL DEBUG REVIEW RESULTS]\n${debugFeedback}\n\nAnalyze the feedback above. If the debugger approved it, output your FINAL response with the <sandbox> block now. If the debugger found bugs, apply ALL fixes and output the corrected response with the fixed <sandbox> block. Do NOT include <ask_debugger> tags in this final response. Only output the polished user-facing response.`,
        },
      ],
      temperature: agent.temperature,
    });

    // Strip any remaining <ask_debugger> tags just in case
    return correctionResult.text.replace(/<ask_debugger>[\s\S]*?<\/ask_debugger>/g, "");
  }

  // ─── Main execution ─────────────────────────────────────────────────
  let fullContent = "";

  try {
    // Phase 1: Collect the full first-turn response (non-streaming) to check for debug tags
    const firstResult = await generateText({
      model: getModel(agent.model),
      system: effectiveSystemPrompt,
      messages: conversationMessages,
      temperature: agent.temperature,
    });

    let rawOutput = firstResult.text;

    // Phase 2: If debug tags found, run the silent loop
    const hasDebugTags = /<ask_debugger>[\s\S]*?<\/ask_debugger>/.test(rawOutput);
    if (hasDebugTags) {
      rawOutput = await runDebugLoop(rawOutput);
    }

    fullContent = rawOutput;

    // Phase 3: Stream the final clean result to the user token-by-token for a live feel
    const words = fullContent.split(/(?<=\s)/); // split preserving whitespace
    let streamed = "";
    for (let i = 0; i < words.length; i++) {
      streamed += words[i];
      // Broadcast every ~5 words to avoid overwhelming
      if (i % 5 === 0 || i === words.length - 1) {
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
            content: streamed,
            done: false,
            runId,
          },
        });
      }
    }

    // Post-process: handle delegation blocks
    const delegationBlocks = extractDelegationBlocks(fullContent);
    const cleanContent = delegationBlocks.length > 0
      ? stripDelegationBlocks(fullContent)
      : fullContent;

    // Handle @build agent spec — create agent programmatically
    if (hasAgentSpecBlock(fullContent)) {
      const spec = extractAgentSpecBlock(fullContent);
      if (spec) {
        await supabase.from("agents").insert({
          workspace_id: WORKSPACE_ID,
          handle: spec.handle,
          display_name: spec.display_name,
          avatar_emoji: spec.avatar_emoji ?? "🤖",
          color: spec.color ?? "#378ADD",
          model: spec.model ?? "google:gemini-2.5-flash",
          temperature: 0.7,
          is_active: true,
          agent_type: spec.agent_type ?? "thinking",
          description: spec.description ?? null,
          system_prompt: spec.system_prompt,
          tools: spec.tools ?? [],
        });
      }
    }

    const durationMs = Date.now() - startTime;

    // Insert final message
    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: cleanContent,
      metadata: {
        model: agent.model,
        run_id: runId,
        duration_ms: durationMs,
        tokens: (firstResult.usage?.inputTokens ?? 0) + (firstResult.usage?.outputTokens ?? 0),
      },
    });

    // Update agent_run to completed
    if (runId) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output_summary: cleanContent.slice(0, 2000),
        token_count_input: firstResult.usage?.inputTokens ?? 0,
        token_count_output: firstResult.usage?.outputTokens ?? 0,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
        steps: [
          { step: "started" },
          ...(hasDebugTags ? [{ step: "debug_loop_completed" }] : []),
          { step: "completed", durationMs },
        ],
      }).eq("id", runId);
    }

    // Send done signal
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: cleanContent,
        done: true,
        runId,
      },
    });

    // Fire delegation sub-invocations (async, max 1 level)
    if (delegationBlocks.length > 0) {
      for (const delegation of delegationBlocks) {
        // Post a delegation notice
        await supabase.from("messages").insert({
          channel_id: channelId,
          sender_type: "system",
          sender_id: agent.id,
          content: `🔀 **${agent.display_name}** delegated to **@${delegation.to}**: "${delegation.task.slice(0, 100)}"`,
          metadata: { type: "delegation" },
        });

        // Spawn sub-invocation (fire and forget — response streams back independently)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        fetch(`${appUrl}/api/agent/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId,
            agentHandle: delegation.to,
          }),
        }).catch(console.error);

        // Also inject the delegation task as context
        await supabase.from("messages").insert({
          channel_id: channelId,
          sender_type: "user",
          sender_id: "system",
          content: delegation.task,
          metadata: { type: "delegation_task", from: agent.handle },
        });
      }
    }
  } catch (err) {
    console.error(`Agent @${agentHandle} stream error:`, err);

    if (runId) {
      await supabase.from("agent_runs").update({
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: `⚠️ Error generating response: ${err instanceof Error ? err.message : "Unknown error"}`,
        done: true,
        runId,
      },
    });
  } finally {
    broadcastClient.removeChannel(broadcastChannel);
  }

  return NextResponse.json({ success: true, runId });
}
