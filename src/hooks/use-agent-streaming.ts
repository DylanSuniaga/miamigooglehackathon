"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export interface StreamingMessage {
  agentId: string;
  agentHandle: string;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  model: string;
  content: string;
  status?: string;
}

export function useAgentStreaming(channelId: string | null) {
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);

  useEffect(() => {
    if (!channelId) {
      setStreamingMessages([]);
      return;
    }

    const supabase = createClient();

    const channel = supabase.channel(`stream:${channelId}`);

    channel
      .on("broadcast", { event: "token" }, (payload) => {
        const data = payload.payload as {
          agentId: string;
          agentHandle: string;
          agentName?: string;
          agentEmoji?: string;
          agentColor?: string;
          model?: string;
          content: string;
          status?: string;
          done: boolean;
        };

        if (data.done) {
          // Remove this agent's streaming message — the DB INSERT will add the final message
          setStreamingMessages((prev) =>
            prev.filter((m) => m.agentId !== data.agentId)
          );
        } else {
          setStreamingMessages((prev) => {
            const existing = prev.find((m) => m.agentId === data.agentId);
            if (existing) {
              return prev.map((m) =>
                m.agentId === data.agentId
                  ? { ...m, content: data.content, status: data.status }
                  : m
              );
            }
            return [
              ...prev,
              {
                agentId: data.agentId,
                agentHandle: data.agentHandle,
                agentName: data.agentName ?? data.agentHandle,
                agentEmoji: data.agentEmoji ?? "🤖",
                agentColor: data.agentColor ?? "#7F77DD",
                model: data.model ?? "",
                content: data.content,
                status: data.status,
              },
            ];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const clearStreaming = useCallback(() => {
    setStreamingMessages([]);
  }, []);

  return { streamingMessages, clearStreaming };
}
