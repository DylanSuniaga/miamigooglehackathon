import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/embeddings";

export async function assembleContext(
  supabase: SupabaseClient,
  channelId: string,
  agentId: string,
  focusQuery?: string
): Promise<string> {
  const [decisions, actions, assumptions, docs] = await Promise.all([
    supabase
      .from("context_decisions")
      .select("content, rationale")
      .eq("channel_id", channelId)
      .eq("status", "active"),
    supabase
      .from("context_actions")
      .select("description, owner_name, status")
      .eq("channel_id", channelId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("context_assumptions")
      .select("assumption, confidence, evidence")
      .eq("channel_id", channelId)
      .or("flagged.eq.true,confidence.in.(untested,challenged)"),
    supabase
      .from("agent_context_documents")
      .select("title, content")
      .eq("agent_id", agentId)
      .eq("is_active", true),
  ]);

  const sections: string[] = [];

  if (decisions.data?.length) {
    sections.push(
      "## Team Decisions\n" +
        decisions.data
          .map(
            (d: { content: string; rationale: string | null }) =>
              `- ${d.content}${d.rationale ? ` (Rationale: ${d.rationale})` : ""}`
          )
          .join("\n")
    );
  }

  if (actions.data?.length) {
    sections.push(
      "## Open Action Items\n" +
        actions.data
          .map(
            (a: {
              description: string;
              owner_name: string | null;
              status: string;
            }) =>
              `- [${a.status}] ${a.description}${a.owner_name ? ` (Owner: ${a.owner_name})` : ""}`
          )
          .join("\n")
    );
  }

  if (assumptions.data?.length) {
    sections.push(
      "## Flagged Assumptions\n" +
        assumptions.data
          .map(
            (a: {
              assumption: string;
              confidence: string;
              evidence: string | null;
            }) =>
              `- [${a.confidence}] ${a.assumption}${a.evidence ? ` — Evidence: ${a.evidence}` : ""}`
          )
          .join("\n")
    );
  }

  if (docs.data?.length) {
    sections.push(
      "## Agent Reference Documents\n" +
        docs.data
          .map(
            (d: { title: string; content: string }) =>
              `### ${d.title}\n${d.content}`
          )
          .join("\n\n")
    );
  }

  // Semantic search for relevant earlier messages
  if (focusQuery && focusQuery.length >= 10) {
    try {
      const embedding = await generateEmbedding(focusQuery);
      const { data: matches } = await supabase.rpc("match_messages", {
        query_embedding: JSON.stringify(embedding),
        match_channel_id: channelId,
        match_threshold: 0.5,
        match_count: 5,
      });

      if (matches?.length) {
        sections.push(
          "## Relevant Earlier Messages\n" +
            matches
              .map(
                (m: { sender_type: string; content: string; similarity: number }) =>
                  `- [${m.sender_type}] (${Math.round(m.similarity * 100)}% relevant): ${m.content.slice(0, 300)}${m.content.length > 300 ? "…" : ""}`
              )
              .join("\n")
        );
      }
    } catch (err) {
      console.error("Semantic search in context assembly failed:", err);
    }
  }

  if (sections.length === 0) return "";

  return (
    "\n\n---\n# Channel Context (auto-injected)\nThe following context has been extracted from this channel's conversation. Use it to inform your response.\n\n" +
    sections.join("\n\n")
  );
}
