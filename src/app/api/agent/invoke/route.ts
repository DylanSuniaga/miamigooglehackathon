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

// Delegation prompt
const DELEGATION_SYSTEM_PROMPT = `
## Agent Delegation
To delegate a subtask to another agent, emit:
<<<DELEGATE:{"to":"<handle>","task":"<clear task description}>>>
The system will invoke that agent and stream their response. Max one level of delegation.
`;

// Pyodide-specific review prompt used for @build's self-review loop
const PYODIDE_REVIEW_PROMPT = `You are reviewing Python code that will run inside Pyodide (Python in the browser via WebAssembly). Check for these CRITICAL issues:

## MUST FIX
1. **FuncAnimation + plt.show() CRASHES Pyodide.** The TimerWasm backend does not support it.
   - For animations: generate multiple static frames and display a single representative frame with plt.savefig, OR use matplotlib's to_jshtml() 
   - NEVER call plt.show() — it is monkey-patched to no-op but FuncAnimation still crashes internally
   - If the code uses FuncAnimation, REPLACE it with a static multi-panel plot or a loop that generates frame snapshots
2. **plt.show() must NEVER appear** — the system captures figures automatically via savefig
3. **Missing imports** — check every function/class is imported
4. **Syntax errors** — check indentation, brackets, quotes
5. **scipy.special.hermite** returns a poly1d — ensure it's called correctly
6. **No input() or blocking I/O** — Pyodide doesn't support it

## RESPONSE FORMAT
If the code is perfect, reply with EXACTLY: CODE_APPROVED
If there are bugs, reply with ONLY the complete corrected Python code (no explanation, no markdown fences, just the raw code).`;

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

  // Load agent directory
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, handle, display_name, description, tools")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("is_active", true);

  const agentMap = new Map(
    (allAgents ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle])
  );

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

  promptParts.push(
    `## Code & Workspace Tooling\nYou can ALWAYS ask the '@build' agent to write/execute visual code or create scaffolding and subagents for you.\nUse this syntax to delegate to it:\n<<<DELEGATE:{"to":"build","task":"<what you need>"}>>>`
  );

  const effectiveSystemPrompt = promptParts.join("\n\n---\n\n");

  // Build conversation messages
  const conversationMessages = history.map((msg: { sender_type: string; sender_id: string; content: string }) => {
    if (msg.sender_type === "agent") {
      const handle = agentMap.get(msg.sender_id) ?? "agent";
      return { role: "assistant" as const, content: `[@${handle}]: ${msg.content}` };
    }
    return { role: "user" as const, content: msg.content };
  });

  // Set up broadcast channel
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

  // ─── Determine if this agent should use the self-review loop ──────
  const isBuildAgent = agentHandle === "build";
  const hasSandboxCapability = enabledTools.includes("run_code") || enabledTools.includes("e2b_sandbox");
  const shouldSelfReview = isBuildAgent && hasSandboxCapability;

  // ─── Helper: extract Python code from <sandbox> blocks ────────────
  function extractSandboxPythonCode(text: string): string[] {
    const blocks: string[] = [];
    const regex = /<sandbox[^>]*language="python"[^>]*>([\s\S]*?)<\/sandbox>/g;
    for (const m of text.matchAll(regex)) {
      blocks.push(m[1].trim());
    }
    return blocks;
  }

  // ─── Helper: replace sandbox code in the original text ────────────
  function replaceSandboxCode(text: string, _oldCode: string, newCode: string): string {
    // Find the sandbox block containing this code and replace it
    const regex = /<sandbox([^>]*language="python"[^>]*)>([\s\S]*?)<\/sandbox>/;
    const match = text.match(regex);
    if (match) {
      return text.replace(match[0], `<sandbox${match[1]}>\n${newCode}\n</sandbox>`);
    }
    return text;
  }

  // ─── Helper: self-review loop for @build ───────────────────────────
  async function selfReviewCode(fullText: string): Promise<string> {
    const sandboxCodes = extractSandboxPythonCode(fullText);
    if (sandboxCodes.length === 0) return fullText;

    let result = fullText;

    for (const code of sandboxCodes) {
      // Send a "reviewing" status
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
          content: "🔍 *Reviewing code for Pyodide compatibility...*",
          done: false,
          runId,
        },
      });

      // Self-review: ask a fast model to check the code
      const reviewResult = await generateText({
        model: getModel("google:gemini-3-flash-preview"),
        system: PYODIDE_REVIEW_PROMPT,
        prompt: code,
      });

      const feedback = reviewResult.text.trim();

      if (feedback === "CODE_APPROVED") {
        // Code is clean, no changes needed
        continue;
      }

      // Debugger returned corrected code — swap it in
      // Strip any markdown fences the model might accidentally include
      const cleanedCode = feedback
        .replace(/^```python\n?/m, "")
        .replace(/^```\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      result = replaceSandboxCode(result, code, cleanedCode);
    }

    // Also strip any <ask_debugger> tags that might have leaked
    result = result.replace(/<ask_debugger>[\s\S]*?<\/ask_debugger>/g, "");

    return result;
  }

  // ─── Main execution ───────────────────────────────────────────────
  let fullContent = "";

  try {
    if (shouldSelfReview) {
      // ─── @build path: generate → self-review → stream clean result ──
      const firstResult = await generateText({
        model: getModel(agent.model),
        system: effectiveSystemPrompt,
        messages: conversationMessages,
        temperature: agent.temperature,
      });

      let rawOutput = firstResult.text;

      // Strip any <ask_debugger> tags (legacy prompt might still produce them)
      rawOutput = rawOutput.replace(/<ask_debugger>[\s\S]*?<\/ask_debugger>/g, "");

      // Self-review any sandbox Python blocks
      rawOutput = await selfReviewCode(rawOutput);

      fullContent = rawOutput;

      // Simulate streaming the final clean result
      const words = fullContent.split(/(?<=\s)/);
      let streamed = "";
      for (let i = 0; i < words.length; i++) {
        streamed += words[i];
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
    } else {
      // ─── All other agents: standard real-time streaming ─────────────
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
            runId,
          },
        });
      }
    }

    // ─── Post-processing (shared for both paths) ──────────────────────

    // Handle delegation blocks
    const delegationBlocks = extractDelegationBlocks(fullContent);
    const cleanContent = delegationBlocks.length > 0
      ? stripDelegationBlocks(fullContent)
      : fullContent;

    // Handle @build agent spec
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
      },
    });

    // Update agent_run to completed
    if (runId) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output_summary: cleanContent.slice(0, 2000),
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
        steps: [
          { step: "started" },
          ...(shouldSelfReview ? [{ step: "code_self_review" }] : []),
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

    // Fire delegation sub-invocations
    if (delegationBlocks.length > 0) {
      for (const delegation of delegationBlocks) {
        await supabase.from("messages").insert({
          channel_id: channelId,
          sender_type: "system",
          sender_id: agent.id,
          content: `🔀 **${agent.display_name}** delegated to **@${delegation.to}**: "${delegation.task.slice(0, 100)}"`,
          metadata: { type: "delegation" },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        fetch(`${appUrl}/api/agent/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, agentHandle: delegation.to }),
        }).catch(console.error);

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
    console.error(`Agent @${agentHandle} invoke error:`, err);

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
