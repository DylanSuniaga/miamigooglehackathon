"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { ArrowUp, Smile, Paperclip, AtSign, Type, X, FileText } from "lucide-react";

interface AgentInfo {
  handle: string;
  emoji: string;
  color: string;
}

interface MessageInputProps {
  channelName: string;
  onSend: (content: string, files?: File[]) => void;
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = message.trim().length > 0 || pendingFiles.length > 0;

  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agents) map[a.handle.toLowerCase()] = a.color;
    return map;
  }, [agents]);

  const renderHighlightedText = useCallback(
    (text: string) => {
      // Split on @mentions, keeping the delimiter
      const parts = text.split(/(@\w+)/g);
      return parts.map((part, i) => {
        if (part.startsWith("@")) {
          const handle = part.slice(1).toLowerCase();
          const color = agentColorMap[handle];
          if (color) {
            return (
              <span key={i} style={{ color }}>
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      });
    },
    [agentColorMap]
  );

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

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function isImageFile(file: File) {
    return file.type.startsWith("image/");
  }

  function handleSend() {
    if (!hasContent) return;
    const content = message.trim();
    onSend(content, pendingFiles.length > 0 ? pendingFiles : undefined);
    setMessage("");
    setPendingFiles([]);
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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="bg-[var(--hm-bg)] px-5 py-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Input area */}
      <div className="relative rounded-lg border border-[var(--hm-border)] focus-within:border-[var(--hm-focus)] focus-within:shadow-[0_0_0_1px_var(--hm-focus)]">
        {/* Agent mention dropdown */}
        {showDropdown && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-[var(--hm-border)] bg-[var(--hm-bg)] shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--hm-muted)] uppercase tracking-wide border-b border-[var(--hm-surface)]">
              Agents
            </div>
            {filteredAgents.map((agent, i) => (
              <button
                key={agent.handle}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex ? "bg-[var(--hm-focus)] text-white" : "hover:bg-[var(--hm-surface-light)] text-[var(--hm-text)]"
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

        {/* File preview strip */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2">
            {pendingFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="relative group flex items-center gap-2 rounded-md border border-[var(--hm-border)] bg-[var(--hm-surface-light)] p-1.5 pr-7"
              >
                {isImageFile(file) ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--hm-border)]">
                    <FileText className="h-5 w-5 text-[var(--hm-muted)]" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-[var(--hm-text)] max-w-[120px]">
                    {file.name}
                  </div>
                  <div className="text-[11px] text-[var(--hm-muted)]">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hm-border)] text-[var(--hm-muted)] hover:bg-[var(--hm-surface-hover)] hover:text-[var(--hm-text)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="relative w-full resize-none bg-transparent px-3 py-2 text-[14px] placeholder-[var(--hm-muted)] outline-none caret-[var(--hm-text)]"
            style={{ color: "transparent", caretColor: "var(--hm-text)" }}
            onKeyDown={handleKeyDown}
          />
          {/* Colored text overlay — must match textarea font exactly */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 text-[14px] text-[var(--hm-text)] font-[inherit]"
          >
            {renderHighlightedText(message)}
            {"\u00A0"}
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--hm-surface)]">
          <div className="flex items-center gap-1.5">
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--hm-muted)] hover:bg-[var(--hm-surface)] hover:text-[var(--hm-text)]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--hm-muted)] hover:bg-[var(--hm-surface)] hover:text-[var(--hm-text)]">
              <Smile className="h-4 w-4" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--hm-muted)] hover:bg-[var(--hm-surface)] hover:text-[var(--hm-text)]"
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
            <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--hm-muted)] hover:bg-[var(--hm-surface)] hover:text-[var(--hm-text)]">
              <Type className="h-4 w-4" />
            </button>
          </div>

          <button
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              hasContent
                ? "bg-[var(--hm-text)] text-white"
                : "bg-[var(--hm-border)] text-white"
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
