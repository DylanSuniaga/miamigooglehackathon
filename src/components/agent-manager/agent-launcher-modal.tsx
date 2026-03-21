"use client";

import { useState } from "react";
import type { Agent } from "@/lib/types";
import { Rocket, X, ChevronDown, Check } from "lucide-react";

type ContextScope = "both" | "chat_only" | "docs_only";

interface AgentLauncherModalProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  channelId: string;
  channelName: string;
}

export function AgentLauncherModal({
  open,
  onClose,
  agents,
  channelId,
  channelName,
}: AgentLauncherModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [taskDescription, setTaskDescription] = useState("");
  const [contextScope, setContextScope] = useState<ContextScope>("both");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!open) return null;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  async function handleLaunch() {
    if (!selectedAgentId || !taskDescription.trim()) return;
    setLaunching(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          agentId: selectedAgentId,
          taskDescription: taskDescription.trim(),
          contextScope,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Launch failed");
      }

      // Reset and close
      setTaskDescription("");
      setSelectedAgentId("");
      setContextScope("both");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-[520px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-[#1D1C1D]" />
            <h2 className="text-[17px] font-bold text-[#1D1C1D]">Launch Agent</h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-[#616061] hover:bg-[#E0E0E0]/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Agent selector — custom dropdown */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              Agent
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex w-full items-center justify-between px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none bg-white text-[#1D1C1D] hover:bg-[#FAFAFA]"
              >
                {selectedAgent ? (
                  <span className="flex items-center gap-2">
                    <span>{selectedAgent.avatar_emoji}</span>
                    <span className="font-medium">{selectedAgent.display_name}</span>
                    <span className="text-[12px] text-[#ABABAD]">
                      {selectedAgent.model.split(":").pop()}
                    </span>
                  </span>
                ) : (
                  <span className="text-[#ABABAD]">Select an agent...</span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-[#ABABAD] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-[#E0E0E0] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {agents.length === 0 && (
                    <div className="px-3 py-2 text-[13px] text-[#ABABAD]">No agents available</div>
                  )}
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(a.id);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-[#F8F8F8] transition-colors ${
                        selectedAgentId === a.id ? "bg-[#F0F0F0]" : ""
                      }`}
                    >
                      <span className="text-base">{a.avatar_emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-[#1D1C1D]">{a.display_name}</span>
                        <span className="ml-2 text-[11px] text-[#ABABAD] font-mono">
                          {a.model.split(":").pop()}
                        </span>
                      </div>
                      {selectedAgentId === a.id && (
                        <Check className="h-3.5 w-3.5 text-[#1264A3] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedAgent && (
              <p className="text-[12px] text-[#616061] mt-1">
                {selectedAgent.description || "No description"}
              </p>
            )}
          </div>

          {/* Task description */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              Task
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              rows={5}
              className="w-full px-3 py-2.5 text-[13px] leading-[1.6] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none resize-y text-[#1D1C1D] placeholder-[#ABABAD]"
            />
          </div>

          {/* Context scope */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              Context Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "both", label: "Chat + Docs", desc: "Full context" },
                { value: "chat_only", label: "Chat Only", desc: `#${channelName} history` },
                { value: "docs_only", label: "Docs Only", desc: "Agent context docs" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setContextScope(opt.value)}
                  className={`px-3 py-2 text-left rounded-lg border transition-colors ${
                    contextScope === opt.value
                      ? "border-[#1D1C1D] bg-[#F8F8F8]"
                      : "border-[#E0E0E0] hover:border-[#ABABAD]"
                  }`}
                >
                  <span className="block text-[12px] font-medium text-[#1D1C1D]">
                    {opt.label}
                  </span>
                  <span className="block text-[10px] text-[#ABABAD] mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 text-[13px] text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E0E0E0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#616061] rounded-md hover:bg-[#F0F0F0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!selectedAgentId || !taskDescription.trim() || launching}
            className="flex items-center gap-1.5 px-5 py-2 text-[14px] font-medium rounded-md bg-[#1D1C1D] text-white hover:bg-[#333] disabled:bg-[#E0E0E0] disabled:text-[#ABABAD] transition-colors"
          >
            <Rocket className="h-3.5 w-3.5" />
            {launching ? "Launching..." : "Launch"}
          </button>
        </div>
      </div>
    </div>
  );
}
