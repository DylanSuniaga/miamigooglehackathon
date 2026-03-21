"use client";

import { Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextDecision } from "@/lib/types";

const STATUS_STYLES: Record<ContextDecision["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
  superseded: { bg: "bg-gray-100", text: "text-gray-500", label: "Superseded" },
  revisited: { bg: "bg-amber-100", text: "text-amber-700", label: "Revisited" },
};

const STATUSES: ContextDecision["status"][] = ["active", "superseded", "revisited"];

interface DecisionsTabProps {
  decisions: ContextDecision[];
  onUpdateStatus: (id: string, status: ContextDecision["status"]) => void;
  onDelete: (id: string) => void;
}

export function DecisionsTab({ decisions, onUpdateStatus, onDelete }: DecisionsTabProps) {
  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <span className="text-2xl mb-2">📋</span>
        <p className="text-sm text-[var(--hm-muted)]">No decisions extracted yet.</p>
        <p className="text-xs text-[var(--hm-muted)] mt-1">
          Use @context or click Extract to find decisions in the conversation.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-3">
        {decisions.map((d) => {
          const style = STATUS_STYLES[d.status];
          return (
            <div
              key={d.id}
              className="rounded-lg border border-[var(--hm-border)] bg-[var(--hm-bg)] p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-[var(--hm-text)] flex-1">{d.content}</p>
                <button
                  onClick={() => onDelete(d.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--hm-muted)] hover:text-red-500 transition-opacity shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {d.rationale && (
                <p className="text-xs text-[var(--hm-muted)] mt-1">{d.rationale}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                {STATUSES.map((s) => {
                  const st = STATUS_STYLES[s];
                  const isActive = d.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(d.id, s)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        isActive
                          ? `${st.bg} ${st.text}`
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
