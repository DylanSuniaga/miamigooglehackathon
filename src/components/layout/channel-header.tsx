"use client";

import { Hash, Bell, Smile, SlidersHorizontal, BookOpen, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

interface ChannelHeaderProps {
  channelName: string;
  channelDescription?: string | null;
  memberCount?: number;
  contextPanelOpen?: boolean;
  onToggleContextPanel?: () => void;
}

export function ChannelHeader({
  channelName,
  channelDescription,
  contextPanelOpen,
  onToggleContextPanel,
}: ChannelHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-[49px] items-center justify-between border-b border-[var(--hm-border)] bg-[var(--hm-bg)] px-4">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <Hash className="h-4 w-4 text-[var(--hm-muted)]" />
          <h2 className="text-[16px] font-bold text-[var(--hm-text)]">
            {channelName}
          </h2>
        </div>
        {channelDescription && (
          <>
            <div className="h-4 w-px bg-[var(--hm-border)] shrink-0" />
            <span className="text-[13px] text-[var(--hm-muted)] truncate">
              {channelDescription}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleContextPanel}
          className={`transition-colors ${
            contextPanelOpen
              ? "text-[#BA7517]"
              : "text-[var(--hm-muted)] hover:text-[var(--hm-text)]"
          }`}
          title="Toggle context panel"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button className="relative text-[var(--hm-muted)] hover:text-[var(--hm-text)]">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            2
          </span>
        </button>
        <button className="text-[var(--hm-muted)] hover:text-[var(--hm-text)]">
          <Smile className="h-4 w-4" />
        </button>
        <button className="text-[var(--hm-muted)] hover:text-[var(--hm-text)]">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-[var(--hm-muted)] hover:text-[var(--hm-text)] transition-colors"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
