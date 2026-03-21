import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractContext } from "@/lib/agents/context-extractor";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  const { channelId } = await req.json();

  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Load @context agent config
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("handle", "context")
    .eq("workspace_id", WORKSPACE_ID)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Context agent not found" }, { status: 404 });
  }

  // Load existing context for dedup
  const [decisionsRes, actionsRes, assumptionsRes] = await Promise.all([
    supabase.from("context_decisions").select("*").eq("channel_id", channelId),
    supabase.from("context_actions").select("*").eq("channel_id", channelId),
    supabase.from("context_assumptions").select("*").eq("channel_id", channelId),
  ]);

  const existing = {
    decisions: decisionsRes.data ?? [],
    actions: actionsRes.data ?? [],
    assumptions: assumptionsRes.data ?? [],
  };

  // Load last 50 messages
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  const history = (recentMessages ?? []).reverse();

  // Load agent handles for message context
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, handle")
    .eq("workspace_id", WORKSPACE_ID);

  const agentMap = new Map(
    (allAgents ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle])
  );

  const messagesForExtraction = history.map(
    (msg: { sender_type: string; sender_id: string; content: string }) => ({
      sender_type: msg.sender_type,
      sender_id: msg.sender_id,
      content: msg.content,
      handle: msg.sender_type === "agent" ? agentMap.get(msg.sender_id) : undefined,
    })
  );

  // Extract context
  const result = await extractContext(
    messagesForExtraction,
    existing,
    agent.model,
    agent.temperature
  );

  // Batch insert results
  const inserts = [];

  if (result.decisions.length > 0) {
    inserts.push(
      supabase.from("context_decisions").insert(
        result.decisions.map((d) => ({
          channel_id: channelId,
          content: d.content,
          rationale: d.rationale,
          status: "active",
        }))
      )
    );
  }

  if (result.actions.length > 0) {
    inserts.push(
      supabase.from("context_actions").insert(
        result.actions.map((a) => ({
          channel_id: channelId,
          description: a.description,
          owner_name: a.owner_name,
          due_date: a.due_date,
          status: "open",
        }))
      )
    );
  }

  if (result.assumptions.length > 0) {
    inserts.push(
      supabase.from("context_assumptions").insert(
        result.assumptions.map((a) => ({
          channel_id: channelId,
          assumption: a.assumption,
          confidence: a.confidence,
          evidence: a.evidence,
        }))
      )
    );
  }

  await Promise.all(inserts);

  return NextResponse.json({
    summary: result.summary,
    decisions: result.decisions,
    actions: result.actions,
    assumptions: result.assumptions,
  });
}
