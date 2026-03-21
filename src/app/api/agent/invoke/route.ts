import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { streamText } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assembleContext } from "@/lib/brain/assemble-context";
import { embedMessage } from "@/lib/embeddings";
import { webSearch } from "@/lib/agents/tools";
import { generateImage } from "@/lib/agents/nanobanana";
import { persistImageFromUrl } from "@/lib/supabase/storage";
import { executeCode } from "@/lib/agents/e2b-sandbox";
import {
  createCalendarEvent,
  listCalendarEvents,
  deleteCalendarEvent,
} from "@/lib/agents/calendar-tools";
import { generateObject } from "ai";
import { z } from "zod";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

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

  // Load agents lookup for prefixing agent names in context
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, handle")
    .eq("workspace_id", WORKSPACE_ID);

  const agentMap = new Map(
    (allAgents ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle])
  );

  // Build conversation messages
  // All history is passed as user-role messages with speaker labels so the
  // model doesn't mimic the "[@handle]: …" prefix in its own output.
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
  let enhancedSystemPrompt = agent.system_prompt + contextBlock;

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
    })
    .select("id")
    .single();

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
    },
  });

  // ===== @artist: image generation (skip streamText entirely) =====
  const isArtist = agent.handle === "artist";
  if (isArtist) {
    try {
      // Broadcast generating_image status
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
        },
      });

      // Extract prompt from last user message
      const lastUserMsg = history.filter((m: { sender_type: string }) => m.sender_type === "user").pop();
      const imagePrompt = lastUserMsg?.content?.replace(/@\w+/g, "").trim() ?? "";

      if (!imagePrompt) {
        throw new Error("No image prompt provided");
      }

      // Generate image via Nanobanana
      const result = await generateImage(imagePrompt);

      // Persist to Supabase Storage (Nanobanana URLs expire)
      const permanentUrl = await persistImageFromUrl(supabase, result.imageUrl, channelId);

      // Build message content with markdown image
      const caption = result.revisedPrompt || imagePrompt;
      const content = `**${caption}**`;

      // Insert message with attachments metadata
      const { data: artistMsg } = await supabase.from("messages").insert({
        channel_id: channelId,
        sender_type: "agent",
        sender_id: agent.id,
        content,
        metadata: {
          model: agent.model,
          original_prompt: imagePrompt,
          attachments: [{
            url: permanentUrl,
            filename: "generated-image.png",
            contentType: "image/png",
            size: 0,
          }],
        },
      }).select("id").single();

      // Fire-and-forget embedding
      if (artistMsg?.id) {
        embedMessage(artistMsg.id, content).catch(() => {});
      }

      // Update agent run
      if (agentRun?.id) {
        const durationMs = Date.now() - new Date(runStartedAt).getTime();
        await supabase.from("agent_runs").update({
          status: "completed",
          output_summary: `Generated image: ${caption.slice(0, 200)}`,
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
      }

      // Broadcast done
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id,
          agentHandle: agent.handle,
          content,
          done: true,
        },
      });
    } catch (err) {
      console.error("@artist error:", err);
      if (agentRun?.id) {
        const durationMs = Date.now() - new Date(runStartedAt).getTime();
        await supabase.from("agent_runs").update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
      }
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id,
          agentHandle: agent.handle,
          content: `⚠️ Error generating image: ${err instanceof Error ? err.message : "Unknown error"}`,
          done: true,
        },
      });
    } finally {
      broadcastClient.removeChannel(broadcastChannel);
    }
    return NextResponse.json({ success: true });
  }

  // ===== @coder: code generation + sandboxed execution =====
  const isCoder = agent.handle === "coder";
  if (isCoder) {
    try {
      // Stream the LLM response so the user sees code being written
      let fullContent = "";
      const result = streamText({
        model: getModel(agent.model),
        system: enhancedSystemPrompt,
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

      // Extract code block from response
      const codeMatch = fullContent.match(/```(\w+)?\n([\s\S]*?)```/);
      let executionResult = null;

      // Detect if the code is HTML — skip sandbox execution, store for preview
      let isHtml = false;

      if (codeMatch) {
        const language = (codeMatch[1] || "python") as "python" | "javascript" | "r" | "bash" | "html";
        const code = codeMatch[2].trim();
        isHtml = language === "html" || (code.includes("<!DOCTYPE") || code.includes("<html"));

        if (isHtml) {
          // No execution needed — store raw HTML for iframe preview
          fullContent += "\n\n---\n**Live preview available** — click \"View Live Preview\" below.";
        } else {
          // Broadcast executing status
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
              status: "executing_code",
              done: false,
            },
          });

          // Execute in sandbox
          executionResult = await executeCode(code, language as "python" | "javascript" | "r" | "bash");

          // Append execution output to message
          fullContent += "\n\n---\n**Execution Output**";
          if (executionResult.stdout) {
            fullContent += `\n\`\`\`\n${executionResult.stdout}\n\`\`\``;
          }
          if (executionResult.stderr) {
            fullContent += `\n\n**Stderr**\n\`\`\`\n${executionResult.stderr}\n\`\`\``;
          }
          if (executionResult.error) {
            fullContent += `\n\n**Error**\n\`\`\`\n${executionResult.error}\n\`\`\``;
          }
          if (!executionResult.stdout && !executionResult.stderr && !executionResult.error) {
            fullContent += "\n\n_No output produced._";
          }
          fullContent += `\n\n_Executed in ${executionResult.executionTimeMs}ms_`;
        }
      }

      // Insert message
      const { data: coderMsg } = await supabase.from("messages").insert({
        channel_id: channelId,
        sender_type: "agent",
        sender_id: agent.id,
        content: fullContent,
        metadata: {
          model: agent.model,
          ...(isHtml && codeMatch && {
            execution: {
              language: "html",
              code: codeMatch[2].trim(),
              html: codeMatch[2].trim(),
            },
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

      // Fire-and-forget embedding
      if (coderMsg?.id) {
        embedMessage(coderMsg.id, fullContent).catch(() => {});
      }

      // Update agent run
      if (agentRun?.id) {
        const durationMs = Date.now() - new Date(runStartedAt).getTime();
        await supabase.from("agent_runs").update({
          status: "completed",
          output_summary: fullContent.slice(0, 500),
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
      }

      // Broadcast done
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id,
          agentHandle: agent.handle,
          content: fullContent,
          done: true,
        },
      });
    } catch (err) {
      console.error("@coder error:", err);
      if (agentRun?.id) {
        const durationMs = Date.now() - new Date(runStartedAt).getTime();
        await supabase.from("agent_runs").update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
      }
      await broadcastChannel.send({
        type: "broadcast",
        event: "token",
        payload: {
          agentId: agent.id,
          agentHandle: agent.handle,
          content: `⚠️ Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          done: true,
        },
      });
    } finally {
      broadcastClient.removeChannel(broadcastChannel);
    }
    return NextResponse.json({ success: true });
  }

  // ===== @assistant: calendar management =====
  const isAssistant = agent.handle === "assistant";
  if (isAssistant) {
    // Broadcast "scheduling..." status
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
        status: "scheduling",
        done: false,
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
          enhancedSystemPrompt += `\n\n--- CALENDAR RESULT ---\n${calendarResult}\n--- END CALENDAR RESULT ---\n\nNarrate what you did (or found) to the user in a friendly, concise way. Do NOT repeat raw IDs or ISO timestamps — use human-readable dates and times.`;
        }
      } catch (err) {
        console.error("@assistant calendar error:", err);
        enhancedSystemPrompt += `\n\n--- CALENDAR ERROR ---\nFailed to process calendar action: ${err instanceof Error ? err.message : "Unknown error"}\n--- END ---\n\nLet the user know the action failed and suggest they try again.`;
      }
    }
  }

  // For researcher agent: search the web first and inject results into context
  const isResearcher = agent.handle === "researcher";
  let searchSources: { title: string; url: string }[] = [];

  if (isResearcher) {
    // Broadcast "searching" status
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
        status: "searching",
        done: false,
      },
    });

    // Extract the user's latest message as the search query
    const lastUserMsg = history.filter((m: { sender_type: string }) => m.sender_type === "user").pop();
    const searchQuery = lastUserMsg?.content?.replace(/@\w+/g, "").trim() ?? "";

    if (searchQuery) {
      const searchResult = await webSearch(searchQuery);
      searchSources = searchResult.results.map((r) => ({ title: r.title, url: r.url }));

      // Inject search results into the system prompt
      const sourcesBlock = searchResult.results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
        .join("\n\n");
      enhancedSystemPrompt += `\n\n--- WEB SEARCH RESULTS ---\nQuery: "${searchQuery}"\n${searchResult.answer ? `Summary: ${searchResult.answer}\n` : ""}\n${sourcesBlock}\n--- END SEARCH RESULTS ---\n\nUse the above search results to ground your response. Cite sources using markdown links.`;
    }
  }

  // Stream the response
  let fullContent = "";

  try {
    const result = streamText({
      model: getModel(agent.model),
      system: enhancedSystemPrompt,
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

    // Append sources section for researcher
    if (searchSources.length > 0) {
      const uniqueSources = searchSources.filter(
        (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i
      );
      const sourcesSection = uniqueSources
        .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
        .join("\n");
      fullContent += `\n\n---\n**Sources**\n${sourcesSection}`;
    }

    // Insert final message into DB
    const { data: agentMsg } = await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: fullContent,
      metadata: {
        model: agent.model,
        ...(searchSources.length > 0 && { sources: searchSources }),
      },
    }).select("id").single();

    // Fire-and-forget embedding
    if (agentMsg?.id) {
      embedMessage(agentMsg.id, fullContent).catch(() => {});
    }

    // Update agent run as completed
    if (agentRun?.id) {
      const durationMs = Date.now() - new Date(runStartedAt).getTime();
      await supabase
        .from("agent_runs")
        .update({
          status: "completed",
          output_summary: fullContent.slice(0, 500),
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", agentRun.id);
    }

    // Send done signal
    await broadcastChannel.send({
      type: "broadcast",
      event: "token",
      payload: {
        agentId: agent.id,
        agentHandle: agent.handle,
        content: fullContent,
        done: true,
      },
    });
  } catch (err) {
    console.error(`Agent @${agentHandle} stream error:`, err);
    // Update agent run as failed
    if (agentRun?.id) {
      const durationMs = Date.now() - new Date(runStartedAt).getTime();
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", agentRun.id);
    }
    // Send error as broadcast so client knows streaming failed
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
