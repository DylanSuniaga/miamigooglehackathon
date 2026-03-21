"use client";

import { useState, useRef, useMemo } from "react";
import { ArrowUp, Smile, Paperclip, AtSign, Type } from "lucide-react";

interface AgentInfo {
  handle: string;
  emoji: string;
  color: string;
}

interface MessageInputProps {
  channelName: string;
  onSend: (content: string) => void;
  agents?: AgentInfo[];
  onInvokeAgent?: (agentHandle: string) => void;
}

export function MessageInput({
  channelName,
  onSend,
  agents = [],
  onInvokeAgent,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = message.trim().length > 0;

  // Filter agents based on what's typed after @
  const filteredAgents = useMemo(() => {
    if (!showDropdown) return [];
    if (!mentionQuery) return agents;
    return agents.filter((a) =>
      a.handle.toLowerCase().startsWith(mentionQuery.toLowerCase())
    );
  }, [showDropdown, mentionQuery, agents]);

  function getMentionContext(text: string, cursorPos: number) {
    // Look backwards from cursor for an @ that starts a mention
    const before = text.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      return { active: true, query: match[1], start: before.length - match[0].length };
    }
    return { active: false, query: "", start: -1 };
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setMessage(val);

    const ctx = getMentionContext(val, cursor);
    if (ctx.active) {
      setShowDropdown(true);
      setMentionQuery(ctx.query);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
      setMentionQuery("");
    }
  }

  function selectAgent(agent: AgentInfo) {
    const cursor = textareaRef.current?.selectionStart ?? message.length;
    const ctx = getMentionContext(message, cursor);
    if (ctx.start >= 0) {
      const before = message.slice(0, ctx.start);
      const after = message.slice(cursor);
      setMessage(`${before}@${agent.handle} ${after}`);
    } else {
      setMessage((prev) => `${prev}@${agent.handle} `);
    }
    setShowDropdown(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  }

  function handleSend() {
    if (!hasContent) return;
    const content = message.trim();
    onSend(content);
    setMessage("");
    setShowDropdown(false);

    // Detect @mentions and invoke agents
    if (onInvokeAgent) {
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        const handles = new Set(
          mentions.map((m) => m.slice(1).toLowerCase())
        );
        const validHandles = agents
          .map((a) => a.handle)
          .filter((h) => handles.has(h));
        for (const handle of validHandles) {
          onInvokeAgent(handle);
        }
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredAgents.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectAgent(filteredAgents[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="bg-white px-5 py-3">
      {/* Input area */}
      <div className="relative rounded-lg border border-[#E0E0E0] focus-within:border-[#1264A3] focus-within:shadow-[0_0_0_1px_#1264A3]">
        {/* Agent mention dropdown */}
        {showDropdown && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-[#E0E0E0] bg-white shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-[#616061] uppercase tracking-wide border-b border-[#F0F0F0]">
              Agents
            </div>
            {filteredAgents.map((agent, i) => (
              <button
                key={agent.handle}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex ? "bg-[#1264A3] text-white" : "hover:bg-[#F8F8F8] text-[#1D1C1D]"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur
                  selectAgent(agent);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="text-lg">{agent.emoji}</span>
                <span className="text-[14px] font-medium">
                  @{agent.handle}
                </span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 text-[14px] text-[#1D1C1D] placeholder-[#616061] outline-none"
          onKeyDown={handleKeyDown}
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
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-[#616061] hover:bg-[#F0F0F0] hover:text-[#1D1C1D]"
              onClick={() => {
                // Insert @ at cursor and trigger dropdown
                const textarea = textareaRef.current;
                if (textarea) {
                  const cursor = textarea.selectionStart ?? message.length;
                  const before = message.slice(0, cursor);
                  const after = message.slice(cursor);
                  const newMsg = `${before}@${after}`;
                  setMessage(newMsg);
                  setShowDropdown(true);
                  setMentionQuery("");
                  setSelectedIndex(0);
                  setTimeout(() => {
                    textarea.focus();
                    textarea.selectionStart = cursor + 1;
                    textarea.selectionEnd = cursor + 1;
                  }, 0);
                }
              }}
            >
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
            onClick={handleSend}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
