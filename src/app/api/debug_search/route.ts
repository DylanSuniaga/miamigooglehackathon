import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // 1. Check if match_messages works with a dummy 1536 vector
    const dummy1536 = new Array(1536).fill(0.1);
    
    const { data: rpcData, error: rpcError } = await supabase.rpc("match_messages", {
      query_embedding: JSON.stringify(dummy1536),
      match_channel_id: "00000000-0000-0000-0000-000000000000",
      match_threshold: 0.1,
      match_count: 5
    });

    // 2. Check the most recent message's embedding status
    const { data: msgData, error: msgError } = await supabase
      .from("messages")
      .select("id, content, embedding")
      .order("created_at", { ascending: false })
      .limit(3);

    const msgs = (msgData || []).map((m) => ({
      id: m.id,
      content: m.content,
      has_embedding: !!m.embedding,
      embedding_length: m.embedding ? (typeof m.embedding === "string" ? JSON.parse(m.embedding).length : m.embedding.length) : null
    }));

    return NextResponse.json({
      rpc_test: {
        success: !rpcError,
        error: rpcError
      },
      recent_messages: msgs
    });
  } catch (err: any) {
    return NextResponse.json({ fatal_error: err.message }, { status: 500 });
  }
}
