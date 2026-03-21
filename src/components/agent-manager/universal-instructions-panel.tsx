"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/lib/types";
import { Save, Loader2, RefreshCw, Info } from "lucide-react";

interface WorkspaceInstructions {
  content: string;
  excluded_agent_ids: string[];
}

interface UniversalInstructionsPanelProps {
  agents: Agent[];
}

export function UniversalInstructionsPanel({ agents }: UniversalInstructionsPanelProps) {
  const [instructions, setInstructions] = useState<WorkspaceInstructions>({
    content: "",
    excluded_agent_ids: [],
  });
  const [content, setContent] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/instructions");
      if (res.ok) {
        const data: WorkspaceInstructions = await res.json();
        setInstructions(data);
        setContent(data.content);
        setExcludedIds(data.excluded_agent_ids ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasChanges =
    content !== instructions.content ||
    JSON.stringify(excludedIds.sort()) !== JSON.stringify((instructions.excluded_agent_ids ?? []).sort());

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/instructions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, excluded_agent_ids: excludedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        setInstructions(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(id: string) {
    setExcludedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const charCount = content.length;
  const activeCount = agents.length - excludedIds.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E0E0E0]">
        <div>
          <h2 className="text-[15px] font-bold text-[#1D1C1D]">Universal Instructions</h2>
          <p className="text-[12px] text-[#616061] mt-0.5">
            Prepended to every agent's system prompt — applies to{" "}
            <strong>{activeCount}</strong> of {agents.length} agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 rounded-md text-[#ABABAD] hover:text-[#616061] hover:bg-[#F0F0F0] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              saved
                ? "bg-green-500 text-white"
                : hasChanges
                ? "bg-[#1D1C1D] text-white hover:bg-[#333]"
                : "bg-[#E0E0E0] text-[#ABABAD] cursor-not-allowed"
            }`}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#ABABAD]" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Tip */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#F3F8FF] border border-[#D0E4FF]">
            <Info className="h-3.5 w-3.5 text-[#1264A3] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#1264A3] leading-relaxed">
              These instructions are <strong>prepended silently</strong> to every qualifying agent's system prompt.
              Use them to set team conventions, product context, or tone that applies across all agents.
              Example: <em>"Our product is Gibert. Always respond concisely. Prefer bullet points."</em>
            </p>
          </div>

          {/* Instructions textarea */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              Instructions
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Add shared context and conventions for your team's agents...

Examples:
- Our product is called Gibert. It is a channel-based AI workspace.
- Our tech stack is Next.js + Supabase + TypeScript.
- Always respond clearly and concisely. Prefer bullet points over paragraphs.
- When uncertain, ask a clarifying question before assuming."
              className="w-full px-3 py-2.5 text-[13px] leading-[1.6] text-[#1D1C1D] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] focus:ring-1 focus:ring-[#1264A3] outline-none resize-y placeholder-[#ABABAD]"
            />
            <p className="text-[11px] text-[#ABABAD] mt-1">{charCount} characters</p>
          </div>

          {/* Agent scope */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-0.5">
              Apply to agents
            </label>
            <p className="text-[12px] text-[#616061] mb-3">
              Uncheck agents you want to exclude from these instructions.
            </p>
            <div className="space-y-1.5">
              {agents.map((a) => {
                const included = !excludedIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:border-[#E0E0E0] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleAgent(a.id)}
                      className="rounded border-[#D4D4D4] accent-[#1264A3]"
                    />
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-base"
                      style={{ backgroundColor: `${a.color}20` }}
                    >
                      {a.avatar_emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-[#1D1C1D]">{a.display_name}</span>
                      <span className="ml-2 text-[11px] text-[#ABABAD] font-mono">@{a.handle}</span>
                    </div>
                    {!included && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#FFEBE8] text-[#E8593C] rounded-full">
                        excluded
                      </span>
                    )}
                  </label>
                );
              })}
              {agents.length === 0 && (
                <p className="text-[13px] text-[#ABABAD] px-3">No agents found.</p>
              )}
            </div>
          </div>

          {/* Preview */}
          {content && (
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
                Preview — how it gets injected
              </label>
              <div className="rounded-md border border-[#E0E0E0] overflow-hidden">
                <div className="px-3 py-1.5 bg-[#F8F8F8] border-b border-[#E0E0E0] text-[11px] font-mono text-[#ABABAD]">
                  effective system prompt
                </div>
                <pre className="px-3 py-2.5 text-[11px] font-mono text-[#616061] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-auto">
{`[Universal Instructions]\n${content}\n\n[Agent System Prompt]\n(agent's own system prompt follows)`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
