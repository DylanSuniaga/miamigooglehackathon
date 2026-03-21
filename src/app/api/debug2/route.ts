import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const query = "What did we say about Redis?";
    const embedding = await generateEmbedding(query);
    
    // Find the channel ID from the most recent message
    const { data: latestMsgs } = await supabase.from("messages").select("channel_id, content, embedding").order("created_at", { ascending: false }).limit(10);
    const channelId = latestMsgs?.[0]?.channel_id;

    // Call match_messages with a negative threshold so it returns EVERYTHING
    const { data: matches, error } = await supabase.rpc("match_messages", {
      query_embedding: JSON.stringify(embedding),
      match_channel_id: channelId,
      match_threshold: -1.0, 
      match_count: 5,
    });

    const debugMatches = matches?.map((m: any) => ({
      similarity: m.similarity,
      content: m.content.substring(0, 100),
    }));

    return NextResponse.json({
      query,
      channelId,
      matches: debugMatches,
      error,
      embeddingLength: embedding.length,
      sample_latest_messages: latestMsgs?.map(m => ({ content: m.content, has_embedding: !!m.embedding, len: m.embedding?.length })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
