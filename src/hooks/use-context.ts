"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type {
  ContextDecision,
  ContextAction,
  ContextAssumption,
} from "@/lib/types";

export function useContext(channelId: string | null) {
  const [decisions, setDecisions] = useState<ContextDecision[]>([]);
  const [actions, setActions] = useState<ContextAction[]>([]);
  const [assumptions, setAssumptions] = useState<ContextAssumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  // Fetch all context on mount / channel change
  useEffect(() => {
    if (!channelId) {
      setDecisions([]);
      setActions([]);
      setAssumptions([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    setLoading(true);

    async function fetchContext() {
      const [d, a, as] = await Promise.all([
        supabase
          .from("context_decisions")
          .select("*")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true }),
        supabase
          .from("context_actions")
          .select("*")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true }),
        supabase
          .from("context_assumptions")
          .select("*")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true }),
      ]);

      setDecisions(d.data ?? []);
      setActions(a.data ?? []);
      setAssumptions(as.data ?? []);
      setLoading(false);
    }

    fetchContext();

    // Subscribe to realtime inserts on all three tables
    const channel = supabase
      .channel(`context:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "context_decisions",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const item = payload.new as ContextDecision;
          setDecisions((prev) =>
            prev.some((d) => d.id === item.id) ? prev : [...prev, item]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "context_actions",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const item = payload.new as ContextAction;
          setActions((prev) =>
            prev.some((a) => a.id === item.id) ? prev : [...prev, item]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "context_assumptions",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const item = payload.new as ContextAssumption;
          setAssumptions((prev) =>
            prev.some((a) => a.id === item.id) ? prev : [...prev, item]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "context_decisions",
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setDecisions((prev) => prev.filter((d) => d.id !== id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "context_actions",
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setActions((prev) => prev.filter((a) => a.id !== id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "context_assumptions",
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setAssumptions((prev) => prev.filter((a) => a.id !== id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "context_decisions",
        },
        (payload) => {
          const updated = payload.new as ContextDecision;
          setDecisions((prev) =>
            prev.map((d) => (d.id === updated.id ? updated : d))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "context_actions",
        },
        (payload) => {
          const updated = payload.new as ContextAction;
          setActions((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "context_assumptions",
        },
        (payload) => {
          const updated = payload.new as ContextAssumption;
          setAssumptions((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const triggerExtraction = useCallback(async () => {
    if (!channelId) return;
    setExtracting(true);
    try {
      await fetch("/api/context/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
    } catch (err) {
      console.error("Context extraction failed:", err);
    } finally {
      setExtracting(false);
    }
  }, [channelId]);

  const updateDecisionStatus = useCallback(
    async (id: string, status: ContextDecision["status"]) => {
      const supabase = createClient();
      await supabase
        .from("context_decisions")
        .update({ status })
        .eq("id", id);
    },
    []
  );

  const updateActionStatus = useCallback(
    async (id: string, status: ContextAction["status"]) => {
      const supabase = createClient();
      await supabase
        .from("context_actions")
        .update({ status })
        .eq("id", id);
    },
    []
  );

  const updateAssumptionConfidence = useCallback(
    async (id: string, confidence: ContextAssumption["confidence"]) => {
      const supabase = createClient();
      await supabase
        .from("context_assumptions")
        .update({ confidence })
        .eq("id", id);
    },
    []
  );

  const deleteItem = useCallback(
    async (table: "context_decisions" | "context_actions" | "context_assumptions", id: string) => {
      const supabase = createClient();
      await supabase.from(table).delete().eq("id", id);
    },
    []
  );

  return {
    decisions,
    actions,
    assumptions,
    loading,
    extracting,
    triggerExtraction,
    updateDecisionStatus,
    updateActionStatus,
    updateAssumptionConfidence,
    deleteItem,
  };
}
