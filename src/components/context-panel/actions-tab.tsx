"use client";

import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextAction } from "@/lib/types";

const STATUS_STYLES: Record<ContextAction["status"], { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-100", text: "text-blue-700", label: "Open" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", label: "In Progress" },
  done: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Done" },
  blocked: { bg: "bg-red-100", text: "text-red-700", label: "Blocked" },
};

const STATUSES: ContextAction["status"][] = ["open", "in_progress", "done", "blocked"];

interface ActionsTabProps {
  actions: ContextAction[];
  onUpdateStatus: (id: string, status: ContextAction["status"]) => void;
  onDelete: (id: string) => void;
}

export function ActionsTab({ actions, onUpdateStatus, onDelete }: ActionsTabProps) {
  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <span className="text-2xl mb-2">✅</span>
        <p className="text-sm text-[#616061]">No action items yet.</p>
        <p className="text-xs text-[#616061] mt-1">
          Action items will appear here when extracted from conversations.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-3">
        {actions.map((a) => {
          const style = STATUS_STYLES[a.status];
          const isDone = a.status === "done";
          return (
            <div
              key={a.id}
              className="rounded-lg border border-[#E0E0E0] bg-white p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-sm flex-1 ${
                    isDone
                      ? "line-through text-[#616061]"
                      : "text-[#1D1C1D]"
                  }`}
                >
                  {a.description}
                </p>
                <button
                  onClick={() => onDelete(a.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#616061] hover:text-red-500 transition-opacity shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-[#616061]">
                {a.owner_name && <span>{a.owner_name}</span>}
                {a.owner_name && a.due_date && <span>·</span>}
                {a.due_date && (
                  <span>{format(new Date(a.due_date), "MMM d")}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {STATUSES.map((s) => {
                  const st = STATUS_STYLES[s];
                  const isActive = a.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(a.id, s)}
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
