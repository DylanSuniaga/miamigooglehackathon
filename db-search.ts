import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./src/lib/embeddings";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function run() {
  const query = "What did we say about Redis?";
  const embedding = await generateEmbedding(query);

  const { data: messages } = await supabase.from("messages").select("id, content, embedding");
  
  const results = [];
  for (const m of messages || []) {
    if (m.embedding) {
      let embArray = typeof m.embedding === "string" ? JSON.parse(m.embedding) : m.embedding;
      if (embArray.length === embedding.length) {
        const sim = cosineSimilarity(embArray, embedding);
        results.push({ content: m.content.slice(0, 50), sim });
      }
    }
  }

  results.sort((a, b) => b.sim - a.sim);
  
  console.log(`Global Top 15 matches for "${query}":`);
  results.slice(0, 15).forEach((m) => {
    console.log(`[Sim: ${m.sim.toFixed(4)}] ${m.content}`);
  });
}
run();
