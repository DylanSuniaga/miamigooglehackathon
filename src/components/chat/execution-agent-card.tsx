"use client";

import { useState } from "react";
import type { AgentRun } from "@/lib/types";
import { ChevronDown, ChevronRight, Zap, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface ExecutionAgentCardProps {
  run: AgentRun;
  agentName?: string;
  agentEmoji?: string;
  agentColor?: string;
}

const STATUS_CONFIG: Record<
  AgentRun["status"],
  { icon: typeof CheckCircle; color: string; bg: string; label: string }
> = {
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "Running" },
  completed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  cancelled: { icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-50", label: "Cancelled" },
};

export function ExecutionAgentCard({
  run,
  agentName,
  agentEmoji,
  agentColor,
}: ExecutionAgentCardProps) {
  const [expanded, setExpanded] = useState(run.status === "running");

  const status = STATUS_CONFIG[run.status];
  const StatusIcon = status.icon;
  const isRunning = run.status === "running";

  const durationText =
    run.duration_ms != null
      ? run.duration_ms >= 1000
        ? `${(run.duration_ms / 1000).toFixed(1)}s`
        : `${run.duration_ms}ms`
      : null;

  return (
    <div
      className="mx-4 my-2 rounded-lg border overflow-hidden transition-all"
      style={{ borderColor: agentColor ? `${agentColor}40` : "#E0E0E0" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        {/* Agent avatar */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
          style={{ backgroundColor: agentColor ? `${agentColor}15` : "#F8F8F8" }}
        >
          {agentEmoji || "🤖"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1D1C1D]">
              {agentName || "Agent"} — Execution
            </span>
            <span
              className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}
            >
              <StatusIcon className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} />
              {status.label}
            </span>
          </div>
          <p className="text-[12px] text-[#616061] truncate mt-0.5">
            {run.input_summary || "No task description"}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          {durationText && (
            <span className="flex items-center gap-1 text-[11px] text-[#ABABAD]">
              <Zap className="h-3 w-3" />
              {durationText}
            </span>
          )}
          {run.model_used && (
            <span className="text-[10px] text-[#ABABAD] font-mono bg-[#F8F8F8] px-1.5 py-0.5 rounded border border-[#E0E0E0]">
              {run.model_used.split(":").pop()}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#ABABAD]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#ABABAD]" />
          )}
        </div>
      </button>

      {/* Progress bar for running state */}
      {isRunning && (
        <div className="h-0.5 bg-[#E0E0E0] overflow-hidden">
          <div className="h-full bg-blue-500 animate-indeterminate-progress" />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#F0F0F0]">
          {/* Token counts */}
          {(run.token_count_input != null || run.token_count_output != null) && (
            <div className="flex gap-4 pt-3 text-[12px] text-[#616061]">
              {run.token_count_input != null && (
                <span>Input: {run.token_count_input.toLocaleString()} tokens</span>
              )}
              {run.token_count_output != null && (
                <span>Output: {run.token_count_output.toLocaleString()} tokens</span>
              )}
            </div>
          )}

          {/* Output */}
          {run.output_summary && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-[#616061] mb-1">Output</p>
              <pre className="text-[12px] leading-[1.5] text-[#1D1C1D] font-mono whitespace-pre-wrap bg-[#F8F8F8] rounded-md p-3 max-h-[300px] overflow-y-auto border border-[#E0E0E0]">
                {run.output_summary}
              </pre>
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-red-600 mb-1">Error</p>
              <pre className="text-[12px] leading-[1.5] text-red-700 font-mono whitespace-pre-wrap bg-red-50 rounded-md p-3 border border-red-200">
                {run.error}
              </pre>
            </div>
          )}

          {/* Steps */}
          {run.steps && (run.steps as Record<string, unknown>[]).length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-[#616061] mb-1">
                Steps ({(run.steps as Record<string, unknown>[]).length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(run.steps as Record<string, unknown>[]).map((step, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-1 rounded-md bg-[#F0F0F0] text-[#616061] font-mono"
                  >
                    {(step as { step?: string }).step ?? JSON.stringify(step)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
