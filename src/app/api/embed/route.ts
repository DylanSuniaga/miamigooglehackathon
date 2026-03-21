import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { embedMessage } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  const { messageId } = await req.json();

  if (!messageId) {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: message } = await supabase
    .from("messages")
    .select("content")
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await embedMessage(messageId, message.content);

  return NextResponse.json({ success: true });
}
