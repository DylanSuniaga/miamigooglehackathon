import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { streamText } from "ai";
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
<<<SANDBOX:{"language":"python","code":"<full runnable code>","title":"<short descriptive title>"${isServer ? ',"mode":"server"' : ''}}>>>
3. ${isServer ? "You are running in a persistent Ubuntu server sandbox with 'pip install' and full filesystem access." : "Python + matplotlib is preferred for charts/plots. Use numpy for math. Use pandas for data."}
4. After the sandbox block, you may add brief explanation text.
5. For multi-step tasks: produce a <<<SANDBOX:{}>>> block for each executable component.
`;

// Delegation prompt — appended when agent has delegate tool enabled
const DELEGATION_SYSTEM_PROMPT = `
## Agent Delegation
To delegate a subtask to another agent, emit:
<<<DELEGATE:{"to":"<handle>","task":"<clear task description}>>>
The system will invoke that agent and stream their response. Max one level of delegation.
`;

export async function POST(req: NextRequest) {
  const { channelId, agentHandle } = await req.json();

  if (!channelId || !agentHandle) {
    return NextResponse.json(
      { error: "channelId and agentHandle are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

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
  }

  if (enabledTools.includes("delegate")) {
    promptParts.push(DELEGATION_SYSTEM_PROMPT.trim());
  }

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

  // Stream the response
  let fullContent = "";

  try {
    const result = streamText({
      model: getModel(agent.model),
      system: effectiveSystemPrompt,
      messages: conversationMessages,
      temperature: agent.temperature,
    });

    for await (const chunk of result.textStream) {
      fullContent += chunk;
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
        },
      });
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

    // Insert final message
    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: cleanContent,
      metadata: { model: agent.model },
    });

    // Send done signal
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: cleanContent,
        done: true,
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
            // Inject the task as the last user message by posting it first
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
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: `⚠️ Error generating response: ${err instanceof Error ? err.message : "Unknown error"}`,
        done: true,
      },
    });
  } finally {
    broadcastClient.removeChannel(broadcastChannel);
  }

  return NextResponse.json({ success: true });
}
