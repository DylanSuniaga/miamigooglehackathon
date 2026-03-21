"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentManager } from "@/hooks/use-agent-manager";
import { AgentList } from "./agent-list";
import { AgentConfigEditor } from "./agent-config-editor";
import { ContextDocumentsPanel } from "./context-documents-panel";
import { AgentRunHistory } from "./agent-run-history";
import { CreateAgentDialog } from "./create-agent-dialog";
import type { Agent } from "@/lib/types";

type EditorTab = "config" | "runs";

export function AgentManagerLayout() {
  const {
    agents,
    contextDocs,
    runs,
    loading,
    fetchContextDocs,
    fetchRuns,
    updateAgent,
    createAgent,
    deleteAgent,
    addContextDoc,
    updateContextDoc,
    deleteContextDoc,
  } = useAgentManager();

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("config");

  // Auto-select first agent when loaded
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0]);
    }
  }, [agents, selectedAgent]);

  // Fetch context docs and runs when agent is selected
  const handleSelectAgent = useCallback(
    (agent: Agent) => {
      setSelectedAgent(agent);
      setActiveTab("config");
      fetchContextDocs(agent.id);
      fetchRuns(agent.id);
    },
    [fetchContextDocs, fetchRuns]
  );

  // Trigger initial fetch when auto-selected
  useEffect(() => {
    if (selectedAgent) {
      fetchContextDocs(selectedAgent.id);
      fetchRuns(selectedAgent.id);
    }
  }, [selectedAgent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[#616061] text-sm">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0">
      {/* Left: Agent List */}
      <AgentList
        agents={agents}
        selectedAgentId={selectedAgent?.id ?? null}
        onSelect={handleSelectAgent}
        onCreateClick={() => setShowCreateDialog(true)}
      />

      {/* Center: Config Editor or Run History */}
      {selectedAgent ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-[#E0E0E0] bg-white px-6">
            <button
              onClick={() => setActiveTab("config")}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === "config"
                  ? "border-[#1D1C1D] text-[#1D1C1D]"
                  : "border-transparent text-[#616061] hover:text-[#1D1C1D]"
              }`}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === "runs"
                  ? "border-[#1D1C1D] text-[#1D1C1D]"
                  : "border-transparent text-[#616061] hover:text-[#1D1C1D]"
              }`}
            >
              Run History
              {runs.length > 0 && (
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-[#E0E0E0] text-[#616061]">
                  {runs.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "config" ? (
            <AgentConfigEditor
              agent={selectedAgent}
              onSave={updateAgent}
            />
          ) : (
            <AgentRunHistory
              runs={runs}
              agentName={selectedAgent.display_name}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <p className="text-[15px] text-[#616061]">
              Select an agent to configure
            </p>
            <p className="text-[13px] text-[#ABABAD] mt-1">
              Or create a new one with the + button
            </p>
          </div>
        </div>
      )}

      {/* Right: Context Documents */}
      {selectedAgent && activeTab === "config" && (
        <ContextDocumentsPanel
          agentName={selectedAgent.display_name}
          agentColor={selectedAgent.color}
          documents={contextDocs}
          onAdd={addContextDoc}
          onUpdate={updateContextDoc}
          onDelete={deleteContextDoc}
          agentId={selectedAgent.id}
        />
      )}

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={createAgent}
      />
    </div>
  );
}
