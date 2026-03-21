import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: agent } = await supabase.from("agents").select("system_prompt").eq("handle", "context").single();
  console.log("Agent Prompt:");
  console.log(agent?.system_prompt);
}
run();
