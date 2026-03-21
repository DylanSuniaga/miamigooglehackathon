import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { generateText, streamText, generateObject } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assembleContext } from "@/lib/brain/assemble-context";
import { embedMessage, generateEmbedding } from "@/lib/embeddings";
import { webSearch } from "@/lib/agents/tools";
import { generateImage } from "@/lib/agents/nanobanana";
import { persistImageFromUrl } from "@/lib/supabase/storage";
import { executeCode } from "@/lib/agents/e2b-sandbox";
import {
  createCalendarEvent,
  listCalendarEvents,
  deleteCalendarEvent,
} from "@/lib/agents/calendar-tools";
import {
  extractDelegationBlocks,
  stripDelegationBlocks,
  extractAgentSpecBlock,
  hasAgentSpecBlock,
} from "@/lib/agents/delegation-parser";
import { z } from "zod";

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

  let effectiveSystemPrompt = promptParts.join("\n\n---\n\n");

  // Build conversation messages
  const conversationMessages = history.map((msg: { sender_type: string; sender_id: string; content: string }) => {
    let speaker: string;
    if (msg.sender_type === "agent") {
      const handle = agentMap.get(msg.sender_id) ?? "agent";
      speaker = `@${handle}`;
    } else if (msg.sender_type === "system") {
      speaker = "system";
    } else {
      speaker = "user";
    }
    return {
      role: "user" as const,
      content: `[${speaker}]: ${msg.content}`,
    };
  });

  // Extract focus query from last user message (for semantic search)
  const lastUserMsg = history
    .filter((m: { sender_type: string }) => m.sender_type === "user")
    .pop();
  const focusQuery = lastUserMsg?.content?.replace(/@\w+/g, "").trim() || undefined;

  // Assemble channel context and enhance system prompt
  const contextBlock = await assembleContext(supabase, channelId, agent.id, focusQuery);
  effectiveSystemPrompt += contextBlock;

  // Insert agent run record
  const runStartedAt = new Date().toISOString();
  const { data: agentRun } = await supabase
    .from("agent_runs")
    .insert({
      agent_id: agent.id,
      channel_id: channelId,
      status: "running",
      input_summary: history.length > 0 ? history[history.length - 1]?.content?.slice(0, 200) : null,
      model_used: agent.model,
      started_at: runStartedAt,
      steps: [{ step: "started", timestamp: runStartedAt }],
    })
    .select("id")
    .single();
  const runId = agentRun?.id;

  // Set up broadcast channel for streaming tokens
  const broadcastClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const broadcastChannel = broadcastClient.channel(`stream:${channelId}`);
  await broadcastChannel.subscribe();

  // Broadcast initial "thinking" state so ALL clients see the loading indicator
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
      content: "",
      done: false,
      runId,
    },
  });

  // ===== @artist: image generation (skip streamText entirely) =====
  const isArtist = agent.handle === "artist";
  if (isArtist) {
    try {
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
          content: "",
          status: "generating_image",
          done: false,
          runId,
        },
      });

      const lastUserMsg = history.filter((m: { sender_type: string }) => m.sender_type === "user").pop();
      const imagePrompt = lastUserMsg?.content?.replace(/@\w+/g, "").trim() ?? "";

      if (!imagePrompt) throw new Error("No image prompt provided");

      const result = await generateImage(imagePrompt);
      const permanentUrl = await persistImageFromUrl(supabase, result.imageUrl, channelId);

      const caption = result.revisedPrompt || imagePrompt;
      const content = `**${caption}**`;

      const { data: artistMsg } = await supabase.from("messages").insert({
        channel_id: channelId,
        sender_type: "agent",
        sender_id: agent.id,
        content,
        metadata: {
          model: agent.model,
          run_id: runId,
          original_prompt: imagePrompt,
          attachments: [{
            url: permanentUrl,
            filename: "generated-image.png",
            contentType: "image/png",
            size: 0,
          }],
        },
      }).select("id").single();

      if (artistMsg?.id) embedMessage(artistMsg.id, content).catch(() => {});

      if (runId) {
        const durationMs = Date.now() - new Date(runStartedAt).getTime();
        await supabase.from("agent_runs").update({
          status: "completed",
          output_summary: `Generated image: ${caption.slice(0, 200)}`,
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        }).eq("id", runId);
      }

      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: { agentId: agent.id, agentHandle: agent.handle, content, done: true, runId },
      });
    } catch (err) {
      console.error("@artist error:", err);
      if (runId) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
          duration_ms: Date.now() - new Date(runStartedAt).getTime(),
          completed_at: new Date().toISOString(),
        }).eq("id", runId);
      }
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id, agentHandle: agent.handle,
          content: `⚠️ Error generating image: ${err instanceof Error ? err.message : "Unknown error"}`,
          done: true, runId,
        },
      });
    } finally {
      broadcastClient.removeChannel(broadcastChannel);
    }
    return NextResponse.json({ success: true, runId });
  }

  // ===== @context: semantic search across full history =====
  const isContextAgent = agent.handle === "context";

  if (isContextAgent && focusQuery) {
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
        content: "",
        status: "searching_memory",
        done: false,
        runId,
      },
    });

    try {
      const embedding = await generateEmbedding(focusQuery);

      const { data: matches, error: searchError } = await supabase.rpc("match_messages", {
        query_embedding: JSON.stringify(embedding),
        match_channel_id: channelId,
        match_threshold: 0.3,
        match_count: 20,
      });

      if (!searchError && matches && matches.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memoryBlock = matches.map((m: any) => `[${m.sender_type}] ${m.content}`).join("\n\n");
        effectiveSystemPrompt = `You are the team's all-knowing Context Agent. The user is asking a direct question about the past channel history.

ABANDON YOUR STANDARD EXTRACTION BEHAVIOR. Your ONLY goal right now is to answer the user's question completely using the exact memories retrieved below. Be conversational and cite what was said.

--- SEMANTIC SEARCH MEMORY (FULL HISTORY) ---
Query: "${focusQuery}"
${memoryBlock}
--- END SEMANTIC SEARCH ---

` + contextBlock;
      } else {
        effectiveSystemPrompt = `You are the Context Agent. The user asked about "${focusQuery}", but a semantic search of the full database history found ZERO mentions of this topic. Inform the user gracefully that it has never been discussed.`;
      }
    } catch (err) {
      console.error("Context agent semantic search failed:", err);
    }
  }

  // ===== @coder: code generation + sandboxed execution =====
  const isCoder = agent.handle === "coder";
  if (isCoder) {
    try {
      let fullContent = "";
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
            agentId: agent.id, agentHandle: agent.handle,
            agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
            agentColor: agent.color, model: agent.model,
            content: fullContent, done: false, runId,
          },
        });
      }

      const codeMatch = fullContent.match(/```(\w+)?\n([\s\S]*?)```/);
      let executionResult = null;
      let isHtml = false;

      if (codeMatch) {
        const language = (codeMatch[1] || "python") as "python" | "javascript" | "r" | "bash" | "html";
        const code = codeMatch[2].trim();
        isHtml = language === "html" || (code.includes("<!DOCTYPE") || code.includes("<html"));

        if (isHtml) {
          fullContent += "\n\n---\n**Live preview available** — click \"View Live Preview\" below.";
        } else {
          await broadcastChannel.send({
            type: "broadcast",
            event: "token",
            payload: {
              agentId: agent.id, agentHandle: agent.handle,
              agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
              agentColor: agent.color, model: agent.model,
              content: fullContent, status: "executing_code", done: false, runId,
            },
          });

          executionResult = await executeCode(code, language as "python" | "javascript" | "r" | "bash");

          fullContent += "\n\n---\n**Execution Output**";
          if (executionResult.stdout) fullContent += `\n\`\`\`\n${executionResult.stdout}\n\`\`\``;
          if (executionResult.stderr) fullContent += `\n\n**Stderr**\n\`\`\`\n${executionResult.stderr}\n\`\`\``;
          if (executionResult.error) fullContent += `\n\n**Error**\n\`\`\`\n${executionResult.error}\n\`\`\``;
          if (!executionResult.stdout && !executionResult.stderr && !executionResult.error) fullContent += "\n\n_No output produced._";
          fullContent += `\n\n_Executed in ${executionResult.executionTimeMs}ms_`;
        }
      }

      const { data: coderMsg } = await supabase.from("messages").insert({
        channel_id: channelId,
        sender_type: "agent",
        sender_id: agent.id,
        content: fullContent,
        metadata: {
          model: agent.model,
          run_id: runId,
          ...(isHtml && codeMatch && {
            execution: { language: "html", code: codeMatch[2].trim(), html: codeMatch[2].trim() },
          }),
          ...(!isHtml && executionResult && {
            execution: {
              language: codeMatch?.[1] || "python",
              code: codeMatch?.[2]?.trim(),
              stdout: executionResult.stdout,
              stderr: executionResult.stderr,
              error: executionResult.error,
              executionTimeMs: executionResult.executionTimeMs,
            },
          }),
        },
      }).select("id").single();

      if (coderMsg?.id) embedMessage(coderMsg.id, fullContent).catch(() => {});

      if (runId) {
        await supabase.from("agent_runs").update({
          status: "completed",
          output_summary: fullContent.slice(0, 500),
          duration_ms: Date.now() - new Date(runStartedAt).getTime(),
          completed_at: new Date().toISOString(),
        }).eq("id", runId);
      }

      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: { agentId: agent.id, agentHandle: agent.handle, content: fullContent, done: true, runId },
      });
    } catch (err) {
      console.error("@coder error:", err);
      if (runId) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
          duration_ms: Date.now() - new Date(runStartedAt).getTime(),
          completed_at: new Date().toISOString(),
        }).eq("id", runId);
      }
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id, agentHandle: agent.handle,
          content: `⚠️ Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          done: true, runId,
        },
      });
    } finally {
      broadcastClient.removeChannel(broadcastChannel);
    }
    return NextResponse.json({ success: true, runId });
  }

  // ===== @assistant: calendar management (pre-process then fall through to stream) =====
  const isAssistant = agent.handle === "assistant";
  if (isAssistant) {
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id, agentHandle: agent.handle,
        agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
        agentColor: agent.color, model: agent.model,
        content: "", status: "scheduling", done: false, runId,
      },
    });

    const lastUserMsg2 = history
      .filter((m: { sender_type: string }) => m.sender_type === "user")
      .pop();
    const userQuery = lastUserMsg2?.content?.replace(/@\w+/g, "").trim() ?? "";

    if (userQuery) {
      try {
        const now = new Date();
        const { object: intent } = await generateObject({
          model: getModel("google:gemini-2.5-flash"),
          schema: z.object({
            action: z.enum(["create", "list", "delete", "none"]),
            title: z.string().optional(),
            description: z.string().optional(),
            start_time: z.string().optional(),
            end_time: z.string().optional(),
            all_day: z.boolean().optional(),
            event_id: z.string().optional(),
          }),
          prompt: `Current date/time: ${now.toISOString()}. User request: "${userQuery}"\n\nExtract the calendar intent. For "create", infer reasonable start_time and end_time as ISO 8601 strings. For "list", set start_time and end_time to the date range requested (e.g. "this week" = Monday to Sunday). For "delete", set event_id if identifiable. If no calendar action is needed, use "none".`,
        });

        let calendarResult = "";

        if (intent.action === "create" && intent.title && intent.start_time) {
          const endTime = intent.end_time || new Date(new Date(intent.start_time).getTime() + 3600000).toISOString();
          const event = await createCalendarEvent({
            title: intent.title,
            description: intent.description,
            start_time: intent.start_time,
            end_time: endTime,
            all_day: intent.all_day,
            channel_id: channelId,
            agent_id: agent.id,
            created_by: "00000000-0000-0000-0000-000000000200",
          });
          calendarResult = `CALENDAR ACTION COMPLETED: Created event "${event.title}" on ${new Date(event.start_time).toLocaleString()}${event.all_day ? " (all day)" : ` to ${new Date(event.end_time).toLocaleTimeString()}`}.`;
        } else if (intent.action === "list" && intent.start_time && intent.end_time) {
          const events = await listCalendarEvents({
            start_date: intent.start_time,
            end_date: intent.end_time,
          });
          if (events.length === 0) {
            calendarResult = "CALENDAR QUERY: No events found in the requested time range.";
          } else {
            const eventList = events
              .map((e) => `- "${e.title}" on ${new Date(e.start_time).toLocaleString()}${e.all_day ? " (all day)" : ` to ${new Date(e.end_time).toLocaleTimeString()}`}${e.description ? ` — ${e.description}` : ""}`)
              .join("\n");
            calendarResult = `CALENDAR QUERY: Found ${events.length} event(s):\n${eventList}`;
          }
        } else if (intent.action === "delete" && intent.event_id) {
          await deleteCalendarEvent(intent.event_id);
          calendarResult = `CALENDAR ACTION COMPLETED: Deleted event ${intent.event_id}.`;
        }

        if (calendarResult) {
          effectiveSystemPrompt += `\n\n--- CALENDAR RESULT ---\n${calendarResult}\n--- END CALENDAR RESULT ---\n\nNarrate what you did (or found) to the user in a friendly, concise way. Do NOT repeat raw IDs or ISO timestamps — use human-readable dates and times.`;
        }
      } catch (err) {
        console.error("@assistant calendar error:", err);
        effectiveSystemPrompt += `\n\n--- CALENDAR ERROR ---\nFailed to process calendar action: ${err instanceof Error ? err.message : "Unknown error"}\n--- END ---\n\nLet the user know the action failed and suggest they try again.`;
      }
    }
  }

  // ===== @researcher: web search pre-processing =====
  const isResearcher = agent.handle === "researcher";
  let searchSources: { title: string; url: string }[] = [];

  if (isResearcher) {
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id, agentHandle: agent.handle,
        agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
        agentColor: agent.color, model: agent.model,
        content: "", status: "searching", done: false, runId,
      },
    });

    const searchQuery = lastUserMsg?.content?.replace(/@\w+/g, "").trim() ?? "";

    if (searchQuery) {
      const searchResult = await webSearch(searchQuery);
      searchSources = searchResult.results.map((r) => ({ title: r.title, url: r.url }));

      const sourcesBlock = searchResult.results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
        .join("\n\n");
      effectiveSystemPrompt += `\n\n--- WEB SEARCH RESULTS ---\nQuery: "${searchQuery}"\n${searchResult.answer ? `Summary: ${searchResult.answer}\n` : ""}\n${sourcesBlock}\n--- END SEARCH RESULTS ---\n\nUse the above search results to ground your response. Cite sources using markdown links.`;
    }
  }

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
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id, agentHandle: agent.handle,
          agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
          agentColor: agent.color, model: agent.model,
          content: "🔍 *Reviewing code for Pyodide compatibility...*",
          done: false, runId,
        },
      });

      const reviewResult = await generateText({
        model: getModel("google:gemini-3-flash-preview"),
        system: PYODIDE_REVIEW_PROMPT,
        prompt: code,
      });

      const feedback = reviewResult.text.trim();

      if (feedback === "CODE_APPROVED") continue;

      const cleanedCode = feedback
        .replace(/^```python\n?/m, "")
        .replace(/^```\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      result = replaceSandboxCode(result, code, cleanedCode);
    }

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
      rawOutput = rawOutput.replace(/<ask_debugger>[\s\S]*?<\/ask_debugger>/g, "");
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
              agentId: agent.id, agentHandle: agent.handle,
              agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
              agentColor: agent.color, model: agent.model,
              content: streamed, done: false, runId,
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
            agentId: agent.id, agentHandle: agent.handle,
            agentName: agent.display_name, agentEmoji: agent.avatar_emoji,
            agentColor: agent.color, model: agent.model,
            content: fullContent, done: false, runId,
          },
        });
      }
    }

    // ─── Post-processing (shared for both paths) ──────────────────────

    // Handle delegation blocks
    const delegationBlocks = extractDelegationBlocks(fullContent);
    let cleanContent = delegationBlocks.length > 0
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

    // Append sources section for researcher
    if (searchSources.length > 0) {
      const uniqueSources = searchSources.filter(
        (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i
      );
      const sourcesSection = uniqueSources
        .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
        .join("\n");
      cleanContent += `\n\n---\n**Sources**\n${sourcesSection}`;
    }

    const durationMs = Date.now() - startTime;

    // Insert final message
    const { data: agentMsg } = await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: cleanContent,
      metadata: {
        model: agent.model,
        run_id: runId,
        duration_ms: durationMs,
        ...(searchSources.length > 0 && { sources: searchSources }),
      },
    }).select("id").single();

    // Fire-and-forget embedding
    if (agentMsg?.id) {
      embedMessage(agentMsg.id, cleanContent).catch(() => {});
    }

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
