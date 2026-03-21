"use client";

import { useState } from "react";
import type { AgentContextDocument } from "@/lib/types";
import { Plus, Trash2, ChevronDown, ChevronRight, FileText, Power } from "lucide-react";

interface ContextDocumentsPanelProps {
  agentName: string;
  agentColor: string;
  documents: AgentContextDocument[];
  onAdd: (doc: {
    agent_id: string;
    title: string;
    content: string;
    doc_type: AgentContextDocument["doc_type"];
  }) => Promise<unknown>;
  onUpdate: (docId: string, updates: Partial<AgentContextDocument>) => Promise<unknown>;
  onDelete: (docId: string) => Promise<void>;
  agentId: string;
}

const DOC_TYPE_LABELS: Record<AgentContextDocument["doc_type"], string> = {
  context: "Context",
  prompt_fragment: "Prompt Fragment",
  reference: "Reference",
  rules: "Rules",
};

const DOC_TYPE_COLORS: Record<AgentContextDocument["doc_type"], string> = {
  context: "#378ADD",
  prompt_fragment: "#7F77DD",
  reference: "#1D9E75",
  rules: "#E8593C",
};

export function ContextDocumentsPanel({
  agentName,
  agentColor,
  documents,
  onAdd,
  onUpdate,
  onDelete,
  agentId,
}: ContextDocumentsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDocType, setNewDocType] = useState<AgentContextDocument["doc_type"]>("context");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setAdding(true);
    try {
      await onAdd({
        agent_id: agentId,
        title: newTitle.trim(),
        content: newContent.trim(),
        doc_type: newDocType,
      });
      setNewTitle("");
      setNewContent("");
      setNewDocType("context");
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  }

  const activeCount = documents.filter((d) => d.is_active).length;

  return (
    <div className="flex w-[320px] flex-col border-l border-[var(--hm-border)] bg-[var(--hm-surface-light)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hm-border)]">
        <div>
          <h3 className="text-[14px] font-bold text-[var(--hm-text)]">Context Docs</h3>
          <p className="text-[11px] text-[var(--hm-muted-light)]">
            {activeCount} active · {documents.length} total
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--hm-muted)] hover:bg-[var(--hm-surface-hover)]/50 hover:text-[var(--hm-text)] transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add form */}
        {showAddForm && (
          <div className="border-b border-[var(--hm-border)] p-4 space-y-3 bg-[var(--hm-bg)]">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-1.5 text-[13px] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] outline-none placeholder-[var(--hm-muted-light)]"
            />
            <select
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value as AgentContextDocument["doc_type"])}
              className="w-full px-3 py-1.5 text-[13px] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] outline-none bg-[var(--hm-bg)]"
            >
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste markdown content, prompts, rules, or reference material..."
              rows={6}
              className="w-full px-3 py-2 text-[12px] leading-[1.5] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] outline-none resize-y font-mono placeholder-[var(--hm-muted-light)]"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || !newContent.trim() || adding}
                className="flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md bg-[var(--hm-text)] text-white hover:bg-[#333] disabled:bg-[var(--hm-border)] disabled:text-[var(--hm-muted-light)] transition-colors"
              >
                {adding ? "Adding..." : "Add Document"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-[13px] text-[var(--hm-muted)] rounded-md hover:bg-[var(--hm-surface-hover)]/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Document list */}
        <div className="py-1">
          {documents.map((doc) => {
            const isExpanded = expandedDoc === doc.id;
            return (
              <div key={doc.id} className="border-b border-[var(--hm-surface)]">
                <button
                  onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--hm-bg)] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--hm-muted-light)] shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--hm-muted-light)] shrink-0" />
                  )}
                  <FileText
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: DOC_TYPE_COLORS[doc.doc_type] }}
                  />
                  <span className={`text-[13px] truncate flex-1 ${doc.is_active ? "text-[var(--hm-text)]" : "text-[var(--hm-muted-light)] line-through"}`}>
                    {doc.title}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      color: DOC_TYPE_COLORS[doc.doc_type],
                      backgroundColor: `${DOC_TYPE_COLORS[doc.doc_type]}12`,
                    }}
                  >
                    {DOC_TYPE_LABELS[doc.doc_type]}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 ml-5">
                    <pre className="text-[12px] leading-[1.5] text-[var(--hm-muted)] font-mono whitespace-pre-wrap bg-[var(--hm-surface-light)] rounded-md p-3 max-h-[200px] overflow-y-auto border border-[var(--hm-border)]">
                      {doc.content}
                    </pre>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdate(doc.id, { is_active: !doc.is_active })}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                          doc.is_active
                            ? "text-green-600 hover:bg-green-50"
                            : "text-[var(--hm-muted-light)] hover:bg-[var(--hm-surface)]"
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        {doc.is_active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => onDelete(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {documents.length === 0 && !showAddForm && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[var(--hm-muted-light)]">
                No context documents for {agentName}.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-[13px] font-medium hover:underline"
                style={{ color: agentColor }}
              >
                Add a document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
