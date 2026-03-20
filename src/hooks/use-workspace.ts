"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { DEMO_USER } from "@/lib/demo-user";
import type { Channel, Agent } from "@/lib/types";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export function useWorkspace() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      const [channelsRes, agentsRes] = await Promise.all([
        supabase
          .from("channels")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("created_at", { ascending: true }),
        supabase
          .from("agents")
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .eq("is_active", true)
          .order("handle", { ascending: true }),
      ]);

      if (channelsRes.data) setChannels(channelsRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      setLoading(false);
    }

    fetchData();

    // Subscribe to channel changes (INSERT + DELETE)
    const channel = supabase
      .channel("workspace:channels")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channels",
          filter: `workspace_id=eq.${WORKSPACE_ID}`,
        },
        (payload) => {
          const newChannel = payload.new as Channel;
          setChannels((prev) => {
            if (prev.some((c) => c.id === newChannel.id)) return prev;
            return [...prev, newChannel];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "channels",
        },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setChannels((prev) => prev.filter((c) => c.id !== oldId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createChannel = useCallback(
    async (name: string, description: string) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("channels")
        .insert({
          workspace_id: WORKSPACE_ID,
          name,
          description: description || null,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Add demo user as channel member
      if (data) {
        await supabase.from("channel_members").insert({
          channel_id: data.id,
          member_type: "user",
          member_id: DEMO_USER.id,
        });
      }

      return data as Channel;
    },
    []
  );

  return { channels, agents, loading, createChannel };
}
