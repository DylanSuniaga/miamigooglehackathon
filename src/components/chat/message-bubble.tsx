"use client";

import React from "react";
import { Trash2, FileText, Download, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { hasSandboxBlock, stripSandboxBlocks } from "@/lib/sandbox/extract-sandbox-block";
import { SandboxOutputCard } from "@/components/chat/sandbox-output-card";
import type { Attachment } from "@/lib/types";

interface AgentInfo {
  handle: string;
  emoji: string;
  color: string;
}

interface MessageBubbleProps {
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
  agents?: AgentInfo[];
  onDelete?: () => void;
}

export function MessageBubble({
  id,
  senderName,
  senderType,
  avatar,
  avatarColor,
  color,
  model,
  content,
  timestamp,
  attachments,
  metadata,
  agents = [],
  onDelete,
}: MessageBubbleProps) {
  const isAgent = senderType === "agent";
  const modelShort = model?.includes(":") ? model.split(":")[1] : model;
  const execution = metadata?.execution as { language?: string; code?: string; html?: string } | undefined;
  const hasHtmlPreview = execution?.html;

  // Detect and strip sandbox blocks for separate rendering
  const hasSandbox = isAgent && hasSandboxBlock(content);
  const displayContent = hasSandbox ? stripSandboxBlocks(content) : content;

  return (
    <div
      className="group relative flex gap-3 px-5 py-3 hover:bg-[var(--hm-surface-light)]"
      style={isAgent && color ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {isAgent ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hm-surface)] text-lg">
            {avatar}
          </div>
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: avatarColor || "#1264A3" }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[var(--hm-text)]">
            {senderName}
          </span>
          <span className="text-[12px] text-[var(--hm-muted-light)]">{timestamp}</span>
          {isAgent && modelShort && (
            <span className="rounded bg-[var(--hm-surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--hm-muted)]">
              {modelShort}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[15px] leading-[1.5] text-[var(--hm-text)]">
          {isAgent ? (
            <div className="prose-sm max-w-none">
              {displayContent && (
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={markdownComponents}
                >
                  {displayContent}
                </ReactMarkdown>
              )}
              {/* Sandbox output card — auto-runs code from <<<SANDBOX:{}>>> blocks */}
              {hasSandbox && <SandboxOutputCard messageContent={content} autoRun={true} />}
            </div>
          ) : (
            <span className="whitespace-pre-wrap">
              {renderUserContent(content, agents)}
            </span>
          )}
          {hasHtmlPreview && (
            <div className="mt-2">
              <a
                href={`/preview/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hm-border)] bg-[var(--hm-surface-light)] px-3 py-1.5 text-[13px] font-medium text-[var(--hm-text)] hover:bg-[var(--hm-surface)] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Live Preview
              </a>
            </div>
          )}
          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((att, i) =>
                att.contentType.startsWith("image/") ? (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-w-md rounded-lg border border-[var(--hm-border)] cursor-pointer hover:shadow-md transition-shadow"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--hm-border)] bg-[var(--hm-surface-light)] px-3 py-2 hover:bg-[var(--hm-surface)] transition-colors"
                  >
                    <FileText className="h-5 w-5 text-[var(--hm-muted)]" />
                    <div>
                      <div className="text-[13px] font-medium text-[var(--hm-text)]">{att.filename}</div>
                      <div className="text-[11px] text-[var(--hm-muted)]">{formatBytes(att.size)}</div>
                    </div>
                    <Download className="h-4 w-4 text-[var(--hm-muted)]" />
                  </a>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      {onDelete && (
        <div className="absolute right-4 top-2 hidden group-hover:flex items-center gap-0.5 rounded-md border border-[var(--hm-border)] bg-[var(--hm-bg)] shadow-sm">
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--hm-muted)] hover:bg-[#FDE8E8] hover:text-red-600"
            title="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderUserContent(content: string, agents: AgentInfo[]) {
  const agentMap = new Map(agents.map((a) => [a.handle.toLowerCase(), a]));

  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const handle = part.slice(1).toLowerCase();
      const agent = agentMap.get(handle);
      if (agent) {
        return (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[13px] font-semibold align-baseline"
            style={{
              backgroundColor: `${agent.color}18`,
              color: agent.color,
            }}
          >
            <span className="text-[12px]">{agent.emoji}</span>
            {part}
          </span>
        );
      }
    }
    return part;
  });
}

const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1 className="text-xl font-bold mt-4 mb-2 text-[var(--hm-text)]" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2 className="text-lg font-bold mt-3 mb-1.5 text-[var(--hm-text)]" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3 className="text-base font-bold mt-2 mb-1 text-[var(--hm-text)]" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentProps<"p">) => (
    <p className="mb-2 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li className="leading-[1.5]" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.ComponentProps<"em">) => (
    <em className="italic" {...props}>{children}</em>
  ),
  code: ({ children, className, ...props }: React.ComponentProps<"code">) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`block bg-[var(--hm-code-bg)] rounded p-3 my-2 text-[13px] font-mono overflow-x-auto whitespace-pre ${className}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[var(--hm-code-bg)] rounded px-1 py-0.5 text-[13px] font-mono text-[var(--hm-code-text)]" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }: React.ComponentProps<"pre">) => (
    <pre className="bg-[var(--hm-code-bg)] rounded-md my-2 overflow-x-auto" {...props}>{children}</pre>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote className="border-l-4 border-[var(--hm-border)] pl-3 my-2 text-[var(--hm-muted)] italic" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a className="text-[var(--hm-link)] hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  img: ({ alt, src, ...props }: React.ComponentProps<"img">) => {
    const srcStr = typeof src === "string" ? src : undefined;
    return (
      <a href={srcStr} target="_blank" rel="noopener noreferrer">
        <img
          alt={alt}
          src={srcStr}
          className="max-w-md rounded-lg border border-[var(--hm-border)] my-2 cursor-pointer hover:shadow-md transition-shadow"
          {...props}
        />
      </a>
    );
  },
};
