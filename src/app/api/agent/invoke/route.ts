import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai";
import { streamText } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
      system: agent.system_prompt,
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

    // Insert final message into DB
    await supabase.from("messages").insert({
      channel_id: channelId,
      sender_type: "agent",
      sender_id: agent.id,
      content: fullContent,
      metadata: { model: agent.model },
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
      },
    });
  } catch (err) {
    console.error(`Agent @${agentHandle} stream error:`, err);
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
