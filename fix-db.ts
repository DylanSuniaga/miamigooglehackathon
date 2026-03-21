import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./src/lib/embeddings";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: messages } = await supabase.from("messages").select("id, content");
  
  if (!messages) return;

  for (const m of messages) {
    if (m.content && m.content.length > 5) {
      try {
        const embedding = await generateEmbedding(m.content);
        await supabase
          .from("messages")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", m.id);
        console.log(`Updated message ${m.id}`);
      } catch (err) {
        console.log(`Failed for ${m.id}`, err);
      }
    }
  }
}
run();
