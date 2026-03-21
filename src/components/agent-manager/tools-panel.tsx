"use client";

import { useState } from "react";
import { Wrench, ExternalLink, CheckCircle2, Circle, Lock } from "lucide-react";

export interface ToolDefinition {
  id: string;
  label: string;
  description: string;
  requiresKey?: string;
  category: "core" | "data" | "external" | "agent";
}

export const ALL_TOOLS: ToolDefinition[] = [
  // Core
  {
    id: "run_code",
    label: "Run Code (Sandbox)",
    description: "Execute Python, JavaScript, or HTML inline in chat. Shows charts, DataFrames, animations, and raw output to all channel members.",
    category: "core",
  },
  {
    id: "read_docs",
    label: "Read Context Docs",
    description: "Load this agent's own context documents before generating a response.",
    category: "core",
  },
  {
    id: "query_channel",
    label: "Query Channel",
    description: "Read recent channel messages for additional context before responding.",
    category: "core",
  },
  {
    id: "delegate",
    label: "Delegate to Agents",
    description: "Hand off subtasks to other workspace agents using <<<DELEGATE:{}>>> markers. Great for orchestrator agents.",
    category: "agent",
  },
  // Data / External
  {
    id: "web_search",
    label: "Web Search",
    description: "Search the live web via Tavily for up-to-date information.",
    requiresKey: "TAVILY_API_KEY",
    category: "data",
  },
  {
    id: "context7",
    label: "Library Docs (Context7)",
    description: "Look up real-time, version-specific documentation for any programming library (Next.js, React, Supabase, etc.).",
    requiresKey: "CONTEXT7_MCP_API_TOKEN",
    category: "external",
  },
  {
    id: "e2b_sandbox",
    label: "E2B Sandbox (Server)",
    description: "Persistent server-side sandbox. Can install packages, write files, and maintain state across steps. Use for Dev agents.",
    requiresKey: "E2B_API_KEY",
    category: "external",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Create branches, commit files, and open pull requests on GitHub repositories.",
    requiresKey: "GITHUB_TOKEN",
    category: "external",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core Tools",
  agent: "Agent Orchestration",
  data: "Data & Search",
  external: "External Integrations",
};

interface ToolsPanelProps {
  enabledTools: string[];
  onChange: (tools: string[]) => void;
}

export function ToolsPanel({ enabledTools, onChange }: ToolsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  function toggle(id: string) {
    if (enabledTools.includes(id)) {
      onChange(enabledTools.filter((t) => t !== id));
    } else {
      onChange([...enabledTools, id]);
    }
  }

  const categories = ["core", "agent", "data", "external"] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[13px] font-semibold text-[#1D1C1D]">
          Tools
        </label>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-[#616061] hover:text-[#1D1C1D] transition-colors"
        >
          {expanded ? "collapse" : "expand"}
        </button>
      </div>

      {!expanded ? (
        <div className="flex flex-wrap gap-1.5">
          {enabledTools.length === 0 ? (
            <span className="text-[12px] text-[#ABABAD]">No tools enabled</span>
          ) : (
            enabledTools.map((id) => {
              const tool = ALL_TOOLS.find((t) => t.id === id);
              return (
                <span key={id} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[#EBF5FF] text-[#1264A3] font-mono">
                  <Wrench className="h-2.5 w-2.5" />
                  {tool?.label ?? id}
                </span>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[#E0E0E0] overflow-hidden divide-y divide-[#E0E0E0]">
          {categories.map((cat) => {
            const catTools = ALL_TOOLS.filter((t) => t.category === cat);
            return (
              <div key={cat} className="bg-white">
                <div className="px-3 py-1.5 bg-[#F8F8F8] border-b border-[#E0E0E0]">
                  <span className="text-[10px] font-semibold text-[#ABABAD] uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>
                {catTools.map((tool) => {
                  const enabled = enabledTools.includes(tool.id);
                  return (
                    <label
                      key={tool.id}
                      className="flex items-start gap-3 px-3 py-2.5 hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                    >
                      <div className="mt-0.5 shrink-0">
                        {enabled ? (
                          <CheckCircle2 className="h-4 w-4 text-[#1264A3]" />
                        ) : (
                          <Circle className="h-4 w-4 text-[#D4D4D4]" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggle(tool.id)}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-[#1D1C1D]">
                            {tool.label}
                          </span>
                          {tool.requiresKey && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFF7E6] text-[#BA7517] font-mono">
                              <Lock className="h-2.5 w-2.5" />
                              {tool.requiresKey}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#616061] mt-0.5 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Docs hint */}
      <p className="text-[11px] text-[#ABABAD] mt-1.5 flex items-center gap-1">
        <ExternalLink className="h-2.5 w-2.5" />
        Tools with 🔒 require env vars — see README for setup
      </p>
    </div>
  );
}
