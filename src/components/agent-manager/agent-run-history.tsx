"use client";

import type { AgentRun } from "@/lib/types";
import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Zap } from "lucide-react";

interface AgentRunHistoryProps {
  runs: AgentRun[];
  agentName: string;
}

const STATUS_STYLES: Record<AgentRun["status"], { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Pending" },
  running: { bg: "bg-blue-50", text: "text-blue-700", label: "Running" },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  cancelled: { bg: "bg-gray-50", text: "text-gray-500", label: "Cancelled" },
};

export function AgentRunHistory({ runs, agentName }: AgentRunHistoryProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center bg-[var(--hm-bg)]">
        <Clock className="h-8 w-8 text-[var(--hm-border)] mb-3" />
        <p className="text-[14px] text-[var(--hm-muted)]">
          No run history for {agentName}
        </p>
        <p className="text-[12px] text-[var(--hm-muted-light)] mt-1">
          Runs will appear here when agents are invoked.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--hm-bg)]">
      <div className="divide-y divide-[var(--hm-surface)]">
        {runs.map((run) => {
          const isExpanded = expandedRun === run.id;
          const status = STATUS_STYLES[run.status];
          const timestamp = run.started_at
            ? new Date(run.started_at).toLocaleString()
            : new Date(run.created_at).toLocaleString();

          return (
            <div key={run.id}>
              <button
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--hm-surface-light)] transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--hm-muted-light)] shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--hm-muted-light)] shrink-0" />
                )}

                {/* Status badge */}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
                  {status.label}
                </span>

                {/* Input preview */}
                <span className="text-[13px] text-[var(--hm-text)] truncate flex-1">
                  {run.input_summary ?? "No input recorded"}
                </span>

                {/* Meta info */}
                <div className="flex items-center gap-3 shrink-0">
                  {run.model_used && (
                    <span className="text-[11px] text-[var(--hm-muted-light)] font-mono">
                      {run.model_used.split(":").pop()}
                    </span>
                  )}
                  {run.duration_ms && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--hm-muted-light)]">
                      <Zap className="h-3 w-3" />
                      {(run.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--hm-muted-light)]">{timestamp}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 ml-5 space-y-3">
                  {/* Tokens */}
                  {(run.token_count_input || run.token_count_output) && (
                    <div className="flex gap-4 text-[12px] text-[var(--hm-muted)]">
                      {run.token_count_input && (
                        <span>Input: {run.token_count_input.toLocaleString()} tokens</span>
                      )}
                      {run.token_count_output && (
                        <span>Output: {run.token_count_output.toLocaleString()} tokens</span>
                      )}
                    </div>
                  )}

                  {/* Output */}
                  {run.output_summary && (
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--hm-muted)] mb-1">Output</p>
                      <pre className="text-[12px] leading-[1.5] text-[var(--hm-text)] font-mono whitespace-pre-wrap bg-[var(--hm-surface-light)] rounded-md p-3 max-h-[200px] overflow-y-auto border border-[var(--hm-border)]">
                        {run.output_summary}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {run.error && (
                    <div>
                      <p className="text-[11px] font-semibold text-red-600 mb-1">Error</p>
                      <pre className="text-[12px] leading-[1.5] text-red-700 font-mono whitespace-pre-wrap bg-red-50 rounded-md p-3 border border-red-200">
                        {run.error}
                      </pre>
                    </div>
                  )}

                  {/* Steps */}
                  {run.steps && (run.steps as Record<string, unknown>[]).length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--hm-muted)] mb-1">
                        Steps ({(run.steps as Record<string, unknown>[]).length})
                      </p>
                      <div className="space-y-1">
                        {(run.steps as Record<string, unknown>[]).map((step, i) => (
                          <div
                            key={i}
                            className="text-[12px] text-[var(--hm-muted)] bg-[var(--hm-surface-light)] rounded px-2.5 py-1.5 font-mono"
                          >
                            {JSON.stringify(step, null, 2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
