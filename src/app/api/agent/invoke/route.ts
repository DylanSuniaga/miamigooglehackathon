import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { streamText } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assembleContext } from "@/lib/brain/assemble-context";
import { webSearch } from "@/lib/agents/tools";
import { generateImage } from "@/lib/agents/nanobanana";
import { persistImageFromUrl } from "@/lib/supabase/storage";

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

  // Assemble channel context and enhance system prompt
  const contextBlock = await assembleContext(supabase, channelId, agent.id);
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
      const content = `**${caption}**\n\n![Generated image](${permanentUrl})`;

      // Insert message with attachments metadata
      await supabase.from("messages").insert({
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
      });

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
    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: fullContent,
      metadata: {
        model: agent.model,
        ...(searchSources.length > 0 && { sources: searchSources }),
      },
    });

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
