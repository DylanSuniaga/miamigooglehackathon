"use client";

import { useState } from "react";
import { ArrowUp, Smile, Paperclip, AtSign, Type } from "lucide-react";

interface MessageInputProps {
  channelName: string;
  onSend: (content: string) => void;
  agents?: { handle: string; emoji: string; color: string }[];
}

export function MessageInput({ channelName, onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");

  const hasContent = message.trim().length > 0;

  return (
    <div className="bg-white px-5 py-3">
      {/* Input area */}
      <div className="rounded-lg border border-[#E0E0E0] focus-within:border-[#1264A3] focus-within:shadow-[0_0_0_1px_#1264A3]">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 text-[14px] text-[#1D1C1D] placeholder-[#616061] outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (hasContent) {
                onSend(message);
                setMessage("");
              }
            }
          }}
        />

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#F0F0F0]">
          <div className="flex items-center gap-1.5">
            <button className="flex h-7 w-7 items-center justify-center rounded text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]">
              <Paperclip className="h-4 w-4" />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]">
              <Smile className="h-4 w-4" />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]">
              <AtSign className="h-4 w-4" />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]">
              <Type className="h-4 w-4" />
            </button>
          </div>

          <button
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              hasContent
                ? "bg-[#1D1C1D] text-white"
                : "bg-[#E0E0E0] text-white"
            }`}
            disabled={!hasContent}
            onClick={() => {
              if (hasContent) {
                onSend(message);
                setMessage("");
              }
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
