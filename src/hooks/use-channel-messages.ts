"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { DEMO_USER } from "@/lib/demo-user";
import { format } from "date-fns";
import type { Message, Profile, Agent, Attachment } from "@/lib/types";

export interface DisplayMessage {
  id: string;
  senderName: string;
  senderType: "user" | "agent" | "system";
  avatar: string | null;
  avatarColor?: string;
  color?: string;
  model?: string;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

function formatTimestamp(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#7F77DD", "#1D9E75", "#E8593C", "#378ADD", "#D4A017", "#9B59B6"];
  return colors[Math.abs(hash) % colors.length];
}

export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const profilesRef = useRef<Map<string, Profile>>(new Map());
  const agentsRef = useRef<Map<string, Agent>>(new Map());
  const lookupsLoadedRef = useRef(false);

  const resolveMessage = useCallback((msg: Message): DisplayMessage => {
    const attachments = (msg.metadata as Record<string, unknown>)?.attachments as Attachment[] | undefined;

    const meta = msg.metadata as Record<string, unknown> | undefined;

    if (msg.sender_type === "agent") {
      const agent = agentsRef.current.get(msg.sender_id);
      return {
        id: msg.id,
        senderName: agent?.display_name ?? "Agent",
        senderType: "agent",
        avatar: agent?.avatar_emoji ?? null,
        color: agent?.color,
        model: agent?.model,
        content: msg.content,
        timestamp: formatTimestamp(msg.created_at),
        attachments,
        metadata: meta,
      };
    }

    const profile = profilesRef.current.get(msg.sender_id);
    return {
      id: msg.id,
      senderName: profile?.display_name ?? profile?.username ?? "User",
      senderType: msg.sender_type,
      avatar: profile?.avatar_url ?? null,
      avatarColor: hashColor(msg.sender_id),
      content: msg.content,
      timestamp: formatTimestamp(msg.created_at),
      attachments,
      metadata: meta,
    };
  }, []);

  // Load lookup tables once
  useEffect(() => {
    if (lookupsLoadedRef.current) return;
    const supabase = createClient();

    async function loadLookups() {
      const [profilesRes, agentsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("agents").select("*"),
      ]);

      if (profilesRes.data) {
        for (const p of profilesRes.data) {
          profilesRef.current.set(p.id, p);
        }
      }
      if (agentsRes.data) {
        for (const a of agentsRes.data) {
          agentsRef.current.set(a.id, a);
        }
      }
      lookupsLoadedRef.current = true;
    }

    loadLookups();
  }, []);

  // Fetch messages + subscribe to realtime
  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    setLoading(true);

    async function fetchMessages() {
      // Wait for lookups if not loaded yet
      while (!lookupsLoadedRef.current) {
        await new Promise((r) => setTimeout(r, 50));
      }

      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data.map(resolveMessage));
      }
      setLoading(false);
    }

    fetchMessages();

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const display = resolveMessage(newMsg);
          setMessages((prev) => {
            if (prev.some((m) => m.id === display.id)) return prev;
            return [...prev, display];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const oldId = (payload.old as { id: string }).id;
          setMessages((prev) => prev.filter((m) => m.id !== oldId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, resolveMessage]);

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (!channelId || (!content.trim() && (!files || files.length === 0))) return;
      const supabase = createClient();

      let metadata: Record<string, unknown> = {};

      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append("channelId", channelId);
        for (const file of files) {
          formData.append("files", file);
        }
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          metadata = { attachments: data.attachments };
        } else {
          console.error("Upload failed:", await res.text());
        }
      }

      const { data: inserted } = await supabase
        .from("messages")
        .insert({
          channel_id: channelId,
          sender_type: "user",
          sender_id: DEMO_USER.id,
          content: content.trim(),
          metadata,
        })
        .select("id")
        .single();

      // Fire-and-forget embedding generation
      if (inserted?.id) {
        fetch("/api/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: inserted.id }),
        }).catch(() => {});
      }
    },
    [channelId]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const supabase = createClient();
      await supabase.from("messages").delete().eq("id", messageId);
    },
    []
  );

  return { messages, loading, sendMessage, deleteMessage };
}
