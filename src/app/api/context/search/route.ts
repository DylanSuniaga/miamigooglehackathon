import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  const { query, channelId, threshold = 0.5, limit = 10 } = await req.json();

  if (!query || !channelId) {
    return NextResponse.json(
      { error: "query and channelId are required" },
      { status: 400 }
    );
  }

  try {
    const embedding = await generateEmbedding(query);
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc("match_messages", {
      query_embedding: JSON.stringify(embedding),
      match_channel_id: channelId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("Semantic search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    console.error("Semantic search failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
