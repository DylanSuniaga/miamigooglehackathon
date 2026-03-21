"use client";

import type { Agent } from "@/lib/types";
import { Plus } from "lucide-react";

interface AgentListProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agent: Agent) => void;
  onCreateClick: () => void;
}

export function AgentList({
  agents,
  selectedAgentId,
  onSelect,
  onCreateClick,
}: AgentListProps) {
  return (
    <div className="flex w-[260px] flex-col border-r border-[#E0E0E0] bg-[#F8F8F8]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0E0]">
        <h2 className="text-[15px] font-bold text-[#1D1C1D]">Agents</h2>
        <button
          onClick={onCreateClick}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#616061] hover:bg-[#E0E0E0]/50 hover:text-[#1D1C1D] transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-2">
        {agents.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-white border-l-2"
                  : "hover:bg-[#E0E0E0]/30 border-l-2 border-transparent"
              }`}
              style={isSelected ? { borderLeftColor: agent.color } : undefined}
            >
              {/* Avatar */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: `${agent.color}15` }}
              >
                {agent.avatar_emoji}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#1D1C1D] truncate">
                    {agent.display_name}
                  </span>
                  {/* Status dot */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      agent.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#E0E0E0]/60 text-[#616061] font-medium">
                    {agent.agent_type}
                  </span>
                  <span className="text-[11px] text-[#ABABAD] truncate font-mono">
                    {agent.model.split(":").pop()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {agents.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#616061]">
            No agents yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
