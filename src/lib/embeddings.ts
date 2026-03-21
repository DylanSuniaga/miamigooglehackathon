import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createServiceClient } from "@/lib/supabase/server";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: text,
  });
  return embedding;
}

export async function embedMessage(
  messageId: string,
  content: string
): Promise<void> {
  if (content.length < 10) return;

  try {
    const embedding = await generateEmbedding(content);
    const supabase = createServiceClient();
    await supabase
      .from("messages")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", messageId);
  } catch (err) {
    console.error(`Failed to embed message ${messageId}:`, err);
  }
}
