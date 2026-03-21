"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { AgentRun } from "@/lib/types";

export function useAgentRuns(channelId: string | null) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch runs for a channel
  useEffect(() => {
    if (!channelId) {
      setRuns([]);
      return;
    }

    const supabase = createClient();
    setLoading(true);

    async function fetchRuns() {
      const { data } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setRuns(data);
      setLoading(false);
    }

    fetchRuns();

    // Subscribe to realtime changes on agent_runs for this channel
    const channel = supabase
      .channel(`agent-runs:${channelId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setRuns((prev) => [payload.new as AgentRun, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRuns((prev) =>
              prev.map((r) =>
                r.id === (payload.new as AgentRun).id
                  ? (payload.new as AgentRun)
                  : r
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const activeRuns = runs.filter(
    (r) => r.status === "running" || r.status === "pending"
  );

  const completedRuns = runs.filter(
    (r) => r.status === "completed" || r.status === "failed" || r.status === "cancelled"
  );

  return { runs, activeRuns, completedRuns, loading };
}
