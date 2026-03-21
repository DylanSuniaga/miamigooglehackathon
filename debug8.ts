import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./src/lib/embeddings";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: messages } = await supabase.from("messages").select("id, content").limit(1);
  if (!messages || messages.length === 0) return;

  const m = messages[0];
  console.log(`Testing update on msg ${m.id}`);
  
  const embedding = await generateEmbedding(m.content);
  console.log(`Generated embedding length: ${embedding.length}`);

  const { error } = await supabase
    .from("messages")
    .update({ embedding: JSON.stringify(embedding) })
    .eq("id", m.id);
  
  if (error) {
    console.error("Update failed with exact error:", error);
  } else {
    console.log("Update succeeded!");
  }
}

run();
