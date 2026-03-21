import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, embedding")
    .order("created_at", { ascending: false })
    .limit(10);
    
  console.log(messages?.map(m => ({ 
    content: m.content.slice(0, 30), 
    has_embed: m.embedding !== null, 
    embed_len: m.embedding ? (typeof m.embedding === "string" ? JSON.parse(m.embedding).length : m.embedding.length) : 0
  })));
}

run();
