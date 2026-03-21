// POST /api/agents — Create a new agent programmatically
// Used by @build meta-agent and can also be called from the UI.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    display_name,
    handle,
    avatar_emoji,
    color,
    model,
    temperature,
    description,
    system_prompt,
    tools,
    agent_type,
  } = body;

  if (!display_name || !handle || !system_prompt) {
    return NextResponse.json(
      { error: "display_name, handle, and system_prompt are required" },
      { status: 400 }
    );
  }

  // Validate handle is unique in workspace
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Agent handle @${handle} already exists in this workspace` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("agents")
    .insert({
      workspace_id: WORKSPACE_ID,
      handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      display_name,
      avatar_emoji: avatar_emoji ?? "🤖",
      color: color ?? "#378ADD",
      model: model ?? "google:gemini-2.5-flash",
      temperature: temperature ?? 0.7,
      is_active: true,
      agent_type: agent_type ?? "thinking",
      description: description ?? null,
      system_prompt,
      tools: tools ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
