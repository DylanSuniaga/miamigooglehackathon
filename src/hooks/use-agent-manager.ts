"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Agent, AgentContextDocument, AgentRun } from "@/lib/types";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export function useAgentManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contextDocs, setContextDocs] = useState<AgentContextDocument[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all agents for the workspace
  useEffect(() => {
    const supabase = createClient();

    async function fetchAgents() {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .order("handle", { ascending: true });

      if (data) setAgents(data);
      setLoading(false);
    }

    fetchAgents();
  }, []);

  // Fetch context docs for a specific agent
  const fetchContextDocs = useCallback(async (agentId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("agent_context_documents")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (data) setContextDocs(data);
    return data ?? [];
  }, []);

  // Fetch runs for a specific agent
  const fetchRuns = useCallback(async (agentId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setRuns(data);
    return data ?? [];
  }, []);

  // Update an agent's config
  const updateAgent = useCallback(
    async (agentId: string, updates: Partial<Agent>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agents")
        .update(updates)
        .eq("id", agentId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, ...data } : a))
        );
      }
      return data;
    },
    []
  );

  // Create a new agent
  const createAgent = useCallback(
    async (agent: {
      handle: string;
      display_name: string;
      description?: string;
      agent_type: "thinking" | "execution" | "system";
      system_prompt: string;
      model: string;
      temperature: number;
      avatar_emoji: string;
      color: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agents")
        .insert({ ...agent, workspace_id: WORKSPACE_ID })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setAgents((prev) => [...prev, data]);
      }
      return data;
    },
    []
  );

  // Delete an agent
  const deleteAgent = useCallback(async (agentId: string) => {
    const supabase = createClient();
    await supabase.from("agents").delete().eq("id", agentId);
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  }, []);

  // Context document CRUD
  const addContextDoc = useCallback(
    async (doc: {
      agent_id: string;
      title: string;
      content: string;
      doc_type: AgentContextDocument["doc_type"];
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_context_documents")
        .insert(doc)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setContextDocs((prev) => [data, ...prev]);
      }
      return data;
    },
    []
  );

  const updateContextDoc = useCallback(
    async (docId: string, updates: Partial<AgentContextDocument>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("agent_context_documents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", docId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setContextDocs((prev) =>
          prev.map((d) => (d.id === docId ? data : d))
        );
      }
      return data;
    },
    []
  );

  const deleteContextDoc = useCallback(async (docId: string) => {
    const supabase = createClient();
    await supabase.from("agent_context_documents").delete().eq("id", docId);
    setContextDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  return {
    agents,
    contextDocs,
    runs,
    loading,
    fetchContextDocs,
    fetchRuns,
    updateAgent,
    createAgent,
    deleteAgent,
    addContextDoc,
    updateContextDoc,
    deleteContextDoc,
  };
}
