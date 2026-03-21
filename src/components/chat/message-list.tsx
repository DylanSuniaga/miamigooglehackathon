"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { StreamingMessage } from "./streaming-message";
import type { StreamingMessage as StreamingMessageType } from "@/hooks/use-agent-streaming";

import type { Attachment } from "@/lib/types";

interface Message {
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
}

interface AgentInfo {
  handle: string;
  emoji: string;
  color: string;
}

interface MessageListProps {
  messages: Message[];
  streamingMessages?: StreamingMessageType[];
  agents?: AgentInfo[];
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageList({
  messages,
  streamingMessages = [],
  agents = [],
  onDeleteMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const streamingCount = streamingMessages.length;
  const streamingContent = streamingMessages.map((m) => m.content).join("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingCount, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="py-4">
        {messages.length === 0 && streamingMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#616061]">
            <span className="text-[15px]">
              No messages yet. Start the conversation!
            </span>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            {...message}
            agents={agents}
            onDelete={
              onDeleteMessage ? () => onDeleteMessage(message.id) : undefined
            }
          />
        ))}
        {streamingMessages.map((sm) => (
          <StreamingMessage
            key={sm.agentId}
            agentName={sm.agentName}
            agentEmoji={sm.agentEmoji}
            agentColor={sm.agentColor}
            model={sm.model}
            content={sm.content}
            status={sm.status}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
