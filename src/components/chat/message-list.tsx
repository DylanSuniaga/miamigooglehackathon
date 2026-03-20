"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";

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
}

interface MessageListProps {
  messages: Message[];
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageList({ messages, onDeleteMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#616061]">
            <span className="text-[15px]">No messages yet. Start the conversation!</span>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            {...message}
            onDelete={
              onDeleteMessage ? () => onDeleteMessage(message.id) : undefined
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
