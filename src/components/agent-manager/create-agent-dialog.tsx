"use client";

import { useState } from "react";

const AVAILABLE_MODELS = [
  { value: "google:gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google:gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "google:gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "anthropic:claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "openai:gpt-4o", label: "GPT-4o" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o Mini" },
];

const AGENT_COLORS = [
  "#E8593C", "#7F77DD", "#1D9E75", "#378ADD", "#BA7517",
  "#9B59B6", "#E74C3C", "#2ECC71", "#3498DB", "#F39C12",
];

const EMOJI_OPTIONS = [
  "🤖", "🧠", "🔍", "📐", "📊", "🧭", "⚡", "🎯", "💡", "🔧",
  "📝", "🛡️", "🎨", "🚀", "🔬", "📈", "🗂️", "💬", "🏗️", "🧪",
];

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (agent: {
    handle: string;
    display_name: string;
    description?: string;
    agent_type: "thinking" | "execution" | "system";
    system_prompt: string;
    model: string;
    temperature: number;
    avatar_emoji: string;
    color: string;
  }) => Promise<unknown>;
}

export function CreateAgentDialog({ open, onClose, onCreate }: CreateAgentDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [agentType, setAgentType] = useState<"thinking" | "execution" | "system">("thinking");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("google:gemini-2.5-flash");
  const [temperature, setTemperature] = useState(0.7);
  const [emoji, setEmoji] = useState("🤖");
  const [color, setColor] = useState("#7F77DD");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  function generateHandle(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleCreate() {
    if (!displayName.trim() || !systemPrompt.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        handle: handle || generateHandle(displayName),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        agent_type: agentType,
        system_prompt: systemPrompt.trim(),
        model,
        temperature,
        avatar_emoji: emoji,
        color,
      });
      // Reset form
      setDisplayName("");
      setHandle("");
      setDescription("");
      setSystemPrompt("");
      setModel("google:gemini-2.5-flash");
      setTemperature(0.7);
      setEmoji("🤖");
      setColor("#7F77DD");
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-[560px] max-h-[85vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#E0E0E0]">
          <h2 className="text-[17px] font-bold text-[#1D1C1D]">Create Agent</h2>
          <p className="text-[13px] text-[#616061] mt-0.5">
            Ship a new agent in 30 seconds.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Emoji + Name row */}
          <div className="flex gap-4">
            {/* Emoji picker */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
                Emoji
              </label>
              <div className="grid grid-cols-5 gap-1 p-2 border border-[#E0E0E0] rounded-md">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`h-8 w-8 flex items-center justify-center rounded text-lg transition-colors ${
                      emoji === e ? "bg-[#E8E8E8]" : "hover:bg-[#F0F0F0]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Handle */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (!handle) setHandle(generateHandle(e.target.value));
                  }}
                  placeholder="e.g. Code Reviewer"
                  className="w-full px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none text-[#1D1C1D] placeholder-[#ABABAD]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
                  Handle
                </label>
                <div className="flex items-center">
                  <span className="text-[14px] text-[#ABABAD] mr-1">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="code-reviewer"
                    className="flex-1 px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none text-[#1D1C1D] font-mono placeholder-[#ABABAD]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              Description <span className="font-normal text-[#ABABAD]">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this agent does"
              className="w-full px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none text-[#1D1C1D] placeholder-[#ABABAD]"
            />
          </div>

          {/* Type + Model + Temp */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">Type</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as typeof agentType)}
                className="w-full px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none bg-white text-[#1D1C1D]"
              >
                <option value="thinking">Thinking</option>
                <option value="execution">Execution</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-[14px] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none bg-white text-[#1D1C1D]"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
                Temp: {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full mt-2 accent-[#1D1C1D]"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">Color</label>
            <div className="flex gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    color === c ? "border-[#1D1C1D] scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1C1D] mb-1.5">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter the agent's system prompt — define its personality, role, and behavior..."
              rows={6}
              className="w-full px-3 py-2.5 text-[13px] leading-[1.6] border border-[#E0E0E0] rounded-md focus:border-[#1264A3] outline-none resize-y font-mono text-[#1D1C1D] placeholder-[#ABABAD]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E0E0E0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#616061] rounded-md hover:bg-[#F0F0F0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!displayName.trim() || !systemPrompt.trim() || creating}
            className="px-5 py-2 text-[14px] font-medium rounded-md bg-[#1D1C1D] text-white hover:bg-[#333] disabled:bg-[#E0E0E0] disabled:text-[#ABABAD] transition-colors"
          >
            {creating ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
