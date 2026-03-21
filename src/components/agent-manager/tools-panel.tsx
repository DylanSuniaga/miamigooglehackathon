"use client";

import { useState } from "react";
import { Wrench, ExternalLink, CheckCircle2, Circle, Lock, Sparkles } from "lucide-react";
import {
  TOOL_REGISTRY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ToolSpec,
} from "@/lib/tools/tool-registry";

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
              const tool = TOOL_REGISTRY.find((t) => t.id === id);
              return (
                <span key={id} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[#EBF5FF] text-[#1264A3] font-mono">
                  <Wrench className="h-2.5 w-2.5" />
                  {tool?.name ?? id}
                </span>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[#E0E0E0] overflow-hidden divide-y divide-[#E0E0E0]">
          {CATEGORY_ORDER.map((cat) => {
            const catTools = TOOL_REGISTRY.filter((t) => t.category === cat);
            if (catTools.length === 0) return null;
            return (
              <div key={cat} className="bg-white">
                <div className="px-3 py-1.5 bg-[#F8F8F8] border-b border-[#E0E0E0]">
                  <span className="text-[10px] font-semibold text-[#ABABAD] uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>
                {catTools.map((tool) => {
                  const enabled = enabledTools.includes(tool.id);
                  const isDeterministic = tool.codegen != null;
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
                            {tool.name}
                          </span>
                          {isDeterministic && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1D9E75] font-mono">
                              <Sparkles className="h-2.5 w-2.5" />
                              Auto-gen
                            </span>
                          )}
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
        <Sparkles className="h-2.5 w-2.5" />
        <span className="text-[#1D9E75]">Auto-gen</span> tools generate bug-free code from templates
        <span className="mx-1">·</span>
        <Lock className="h-2.5 w-2.5" />
        Tools with 🔒 require env vars
      </p>
    </div>
  );
}
