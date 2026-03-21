"use client";

import { Trash2, Flag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextAssumption } from "@/lib/types";

const CONFIDENCE_STYLES: Record<
  ContextAssumption["confidence"],
  { bg: string; text: string; label: string }
> = {
  untested: { bg: "bg-gray-100", text: "text-gray-600", label: "Untested" },
  validated: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Validated" },
  challenged: { bg: "bg-amber-100", text: "text-amber-700", label: "Challenged" },
  disproved: { bg: "bg-red-100", text: "text-red-700", label: "Disproved" },
};

const CONFIDENCES: ContextAssumption["confidence"][] = [
  "untested",
  "validated",
  "challenged",
  "disproved",
];

interface AssumptionsTabProps {
  assumptions: ContextAssumption[];
  onUpdateConfidence: (id: string, confidence: ContextAssumption["confidence"]) => void;
  onDelete: (id: string) => void;
  onToggleFlag: (id: string, flagged: boolean) => void;
}

export function AssumptionsTab({
  assumptions,
  onUpdateConfidence,
  onDelete,
  onToggleFlag,
}: AssumptionsTabProps) {
  if (assumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <span className="text-2xl mb-2">💡</span>
        <p className="text-sm text-[var(--hm-muted)]">No assumptions tracked yet.</p>
        <p className="text-xs text-[var(--hm-muted)] mt-1">
          Assumptions will be extracted and tracked for validation.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-3">
        {assumptions.map((a) => {
          const style = CONFIDENCE_STYLES[a.confidence];
          return (
            <div
              key={a.id}
              className={`rounded-lg border bg-[var(--hm-bg)] p-3 group ${
                a.flagged ? "border-amber-300" : "border-[var(--hm-border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-[var(--hm-text)] flex-1">{a.assumption}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggleFlag(a.id, !a.flagged)}
                    className={`transition-colors ${
                      a.flagged
                        ? "text-amber-500"
                        : "opacity-0 group-hover:opacity-100 text-[var(--hm-muted)] hover:text-amber-500"
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" fill={a.flagged ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--hm-muted)] hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {a.evidence && (
                <p className="text-xs text-[var(--hm-muted)] mt-1">{a.evidence}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                {CONFIDENCES.map((c) => {
                  const cs = CONFIDENCE_STYLES[c];
                  const isActive = a.confidence === c;
                  return (
                    <button
                      key={c}
                      onClick={() => onUpdateConfidence(a.id, c)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        isActive
                          ? `${cs.bg} ${cs.text}`
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {cs.label}
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
