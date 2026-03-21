"use client";

import { useState, useCallback } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useContext } from "@/hooks/use-context";
import { DecisionsTab } from "./decisions-tab";
import { ActionsTab } from "./actions-tab";
import { AssumptionsTab } from "./assumptions-tab";
import { createClient } from "@/utils/supabase/client";

interface ContextPanelProps {
  channelId: string;
  onClose: () => void;
}

export function ContextPanel({ channelId, onClose }: ContextPanelProps) {
  const {
    decisions,
    actions,
    assumptions,
    loading,
    extracting,
    triggerExtraction,
    updateDecisionStatus,
    updateActionStatus,
    updateAssumptionConfidence,
    deleteItem,
  } = useContext(channelId);

  const [activeTab, setActiveTab] = useState(0);

  const toggleFlag = useCallback(
    async (id: string, flagged: boolean) => {
      const supabase = createClient();
      await supabase
        .from("context_assumptions")
        .update({ flagged })
        .eq("id", id);
    },
    []
  );

  const totalItems = decisions.length + actions.length + assumptions.length;

  return (
    <div className="w-[320px] border-l border-[var(--hm-border)] bg-[var(--hm-bg)] flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between h-[49px] px-4 border-b border-[var(--hm-border)] shrink-0">
        <h3 className="text-sm font-bold text-[var(--hm-text)]">Context</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerExtraction}
            disabled={extracting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--hm-surface-light)] text-[var(--hm-text)] hover:bg-[var(--hm-surface-hover)] disabled:opacity-50 transition-colors"
          >
            {extracting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {extracting ? "Extracting..." : "Extract"}
          </button>
          <button
            onClick={onClose}
            className="text-[var(--hm-muted)] hover:text-[var(--hm-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary line */}
      {totalItems > 0 && (
        <div className="px-4 py-2 text-xs text-[var(--hm-muted)] border-b border-[var(--hm-border)]">
          {decisions.length} decision{decisions.length !== 1 ? "s" : ""} · {actions.length} action{actions.length !== 1 ? "s" : ""} · {assumptions.length} assumption{assumptions.length !== 1 ? "s" : ""}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--hm-muted)]" />
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as number)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList variant="line" className="w-full px-2 shrink-0">
            <TabsTrigger value={0} className="text-xs">
              Decisions{decisions.length > 0 ? ` (${decisions.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value={1} className="text-xs">
              Actions{actions.length > 0 ? ` (${actions.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value={2} className="text-xs">
              Assumptions{assumptions.length > 0 ? ` (${assumptions.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={0} className="flex-1 min-h-0">
            <DecisionsTab
              decisions={decisions}
              onUpdateStatus={updateDecisionStatus}
              onDelete={(id) => deleteItem("context_decisions", id)}
            />
          </TabsContent>

          <TabsContent value={1} className="flex-1 min-h-0">
            <ActionsTab
              actions={actions}
              onUpdateStatus={updateActionStatus}
              onDelete={(id) => deleteItem("context_actions", id)}
            />
          </TabsContent>

          <TabsContent value={2} className="flex-1 min-h-0">
            <AssumptionsTab
              assumptions={assumptions}
              onUpdateConfidence={updateAssumptionConfidence}
              onDelete={(id) => deleteItem("context_assumptions", id)}
              onToggleFlag={toggleFlag}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
