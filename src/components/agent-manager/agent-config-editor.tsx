"use client";

import { useState, useEffect } from "react";
import type { Agent } from "@/lib/types";
import { Save, RotateCcw } from "lucide-react";
import { ToolsPanel } from "./tools-panel";

const AVAILABLE_MODELS = [
  { value: "google:gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (Code)" },
  { value: "google:gemini-3-flash-preview", label: "Gemini 3 Flash Preview (Fast)" },
  { value: "google:gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google:gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const AGENT_COLORS = [
  "#E8593C", "#7F77DD", "#1D9E75", "#378ADD", "#BA7517",
  "#9B59B6", "#E74C3C", "#2ECC71", "#3498DB", "#F39C12",
];

interface AgentConfigEditorProps {
  agent: Agent;
  onSave: (agentId: string, updates: Partial<Agent>) => Promise<unknown>;
}

export function AgentConfigEditor({ agent, onSave }: AgentConfigEditorProps) {
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [color, setColor] = useState(agent.color);
  const [isActive, setIsActive] = useState(agent.is_active);
  const [description, setDescription] = useState(agent.description ?? "");
  const [tools, setTools] = useState<string[]>((agent.tools as string[]) ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset form when agent changes
  useEffect(() => {
    setSystemPrompt(agent.system_prompt);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setColor(agent.color);
    setIsActive(agent.is_active);
    setDescription(agent.description ?? "");
    setTools((agent.tools as string[]) ?? []);
    setSaved(false);
  }, [agent]);

  const hasChanges =
    systemPrompt !== agent.system_prompt ||
    model !== agent.model ||
    temperature !== agent.temperature ||
    color !== agent.color ||
    isActive !== agent.is_active ||
    description !== (agent.description ?? "") ||
    JSON.stringify(tools.sort()) !== JSON.stringify(((agent.tools as string[]) ?? []).sort());

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(agent.id, {
        system_prompt: systemPrompt,
        model,
        temperature,
        color,
        is_active: isActive,
        description: description || null,
        tools,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSystemPrompt(agent.system_prompt);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setColor(agent.color);
    setIsActive(agent.is_active);
    setDescription(agent.description ?? "");
    setTools((agent.tools as string[]) ?? []);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--hm-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--hm-border)]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl"
            style={{ backgroundColor: `${color}15` }}
          >
            {agent.avatar_emoji}
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[var(--hm-text)]">
              {agent.display_name}
            </h2>
            <span className="text-[12px] text-[var(--hm-muted-light)] font-mono">
              @{agent.handle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--hm-muted)] hover:text-[var(--hm-text)] rounded-md hover:bg-[var(--hm-surface)] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              saved
                ? "bg-green-500 text-white"
                : hasChanges
                ? "bg-[var(--hm-text)] text-white hover:bg-[#333]"
                : "bg-[var(--hm-border)] text-[var(--hm-muted-light)] cursor-not-allowed"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[13px] font-semibold text-[var(--hm-text)]">
              Active
            </label>
            <p className="text-[12px] text-[var(--hm-muted)] mt-0.5">
              Inactive agents won&apos;t appear in channels
            </p>
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isActive ? "bg-green-500" : "bg-[#D4D4D4]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--hm-bg)] shadow transition-transform ${
                isActive ? "left-5.5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[13px] font-semibold text-[var(--hm-text)] mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent do?"
            className="w-full px-3 py-2 text-[14px] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] focus:ring-1 focus:ring-[var(--hm-focus)] outline-none placeholder-[var(--hm-muted-light)]"
          />
        </div>

        {/* Model + Temperature row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[var(--hm-text)] mb-1.5">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-[14px] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] focus:ring-1 focus:ring-[var(--hm-focus)] outline-none bg-[var(--hm-bg)]"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[var(--hm-text)] mb-1.5">
              Temperature: {temperature.toFixed(1)}
            </label>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-[var(--hm-muted-light)]">Precise</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-[var(--hm-border)] rounded-full appearance-none cursor-pointer accent-[var(--hm-text)]"
              />
              <span className="text-[11px] text-[var(--hm-muted-light)]">Creative</span>
            </div>
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-[13px] font-semibold text-[var(--hm-text)] mb-1.5">
            Agent Color
          </label>
          <div className="flex gap-2">
            {AGENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  color === c
                    ? "border-[var(--hm-text)] scale-110"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* System prompt */}
        <div>
          <label className="block text-[13px] font-semibold text-[var(--hm-text)] mb-1.5">
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={12}
            className="w-full px-3 py-2.5 text-[13px] leading-[1.6] text-[var(--hm-text)] border border-[var(--hm-border)] rounded-md focus:border-[var(--hm-focus)] focus:ring-1 focus:ring-[var(--hm-focus)] outline-none resize-y font-mono placeholder-[var(--hm-muted-light)]"
            placeholder="Enter the agent's system prompt..."
          />
          <p className="text-[11px] text-[var(--hm-muted-light)] mt-1">
            {systemPrompt.length} characters
          </p>
        </div>

        {/* Tools */}
        <div>
          <ToolsPanel enabledTools={tools} onChange={setTools} />
        </div>
      </div>
    </div>
  );
}
