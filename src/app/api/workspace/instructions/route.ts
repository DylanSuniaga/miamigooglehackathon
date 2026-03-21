import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("workspace_instructions")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return empty record if not seeded yet
  return NextResponse.json(
    data ?? { workspace_id: WORKSPACE_ID, content: "", excluded_agent_ids: [] }
  );
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { content, excluded_agent_ids } = body;

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("workspace_instructions")
    .upsert(
      {
        workspace_id: WORKSPACE_ID,
        content: content ?? "",
        excluded_agent_ids: excluded_agent_ids ?? [],
      },
      { onConflict: "workspace_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
