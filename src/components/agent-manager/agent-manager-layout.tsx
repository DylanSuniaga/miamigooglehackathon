"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentManager } from "@/hooks/use-agent-manager";
import { AgentList } from "./agent-list";
import { AgentConfigEditor } from "./agent-config-editor";
import { ContextDocumentsPanel } from "./context-documents-panel";
import { AgentRunHistory } from "./agent-run-history";
import { CreateAgentDialog } from "./create-agent-dialog";
import { AgentVisualMap } from "./agent-visual-map";
import { UniversalInstructionsPanel } from "./universal-instructions-panel";
import { Map, Settings2, Globe } from "lucide-react";
import type { Agent } from "@/lib/types";

type EditorTab = "config" | "runs" | "instructions";
type ConfigViewMode = "form" | "map";

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
  const [configViewMode, setConfigViewMode] = useState<ConfigViewMode>("form");

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
        <span className="text-[var(--hm-muted)] text-sm">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 h-full overflow-hidden relative">
      {/* Left: Agent List */}
      <AgentList
        agents={agents}
        selectedAgentId={selectedAgent?.id ?? null}
        onSelect={handleSelectAgent}
        onCreateClick={() => setShowCreateDialog(true)}
      />

      {/* Center: Config Editor or Run History */}
      {selectedAgent ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--hm-bg)]">
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-[var(--hm-border)] bg-[var(--hm-bg)] px-6">
            <div className="flex">
              <button
                onClick={() => setActiveTab("config")}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === "config"
                    ? "border-[var(--hm-text)] text-[var(--hm-text)]"
                    : "border-transparent text-[var(--hm-muted)] hover:text-[var(--hm-text)]"
                }`}
              >
                Configuration
              </button>
              <button
                onClick={() => setActiveTab("runs")}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === "runs"
                    ? "border-[var(--hm-text)] text-[var(--hm-text)]"
                    : "border-transparent text-[var(--hm-muted)] hover:text-[var(--hm-text)]"
                }`}
              >
                Run History
                {runs.length > 0 && (
                  <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--hm-border)] text-[var(--hm-muted)]">
                    {runs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("instructions")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === "instructions"
                    ? "border-[#1264A3] text-[#1264A3]"
                    : "border-transparent text-[#616061] hover:text-[#1D1C1D]"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Instructions
              </button>
            </div>

            {/* View Mode Toggle (Only show in Config tab) */}
            {activeTab === "config" && (
              <div className="flex items-center p-0.5 bg-[var(--hm-surface-light)] border border-[var(--hm-border)] rounded-md">
                <button
                  onClick={() => setConfigViewMode("form")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors ${
                    configViewMode === "form"
                      ? "bg-[var(--hm-bg)] text-[var(--hm-text)] shadow-sm border border-[var(--hm-border)]"
                      : "text-[var(--hm-muted)] hover:text-[var(--hm-text)] border border-transparent"
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Form
                </button>
                <button
                  onClick={() => setConfigViewMode("map")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors ${
                    configViewMode === "map"
                      ? "bg-[var(--hm-bg)] text-[var(--hm-text)] shadow-sm border border-[var(--hm-border)]"
                      : "text-[var(--hm-muted)] hover:text-[var(--hm-text)] border border-transparent"
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  Visual Map
                </button>
              </div>
            )}
          </div>

          {activeTab === "config" ? (
            configViewMode === "form" ? (
              <AgentConfigEditor
                agent={selectedAgent}
                onSave={updateAgent}
              />
            ) : (
              <div className="flex-1 overflow-hidden">
                <AgentVisualMap
                  agent={selectedAgent}
                  contextDocs={contextDocs}
                  allAgents={agents}
                  onNodeDoubleClick={() => {
                    setConfigViewMode("form");
                  }}
                />
              </div>
            )
          ) : activeTab === "runs" ? (
            <AgentRunHistory
              runs={runs}
              agentName={selectedAgent.display_name}
            />
          ) : (
            <UniversalInstructionsPanel agents={agents} />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[var(--hm-bg)]">
          <div className="text-center">
            <p className="text-[15px] text-[var(--hm-muted)]">
              Select an agent to configure
            </p>
            <p className="text-[13px] text-[var(--hm-muted-light)] mt-1">
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
