"use client";

import {
  MessageSquare,
  Users,
  Bot,
  FileText,
  Mail,
  Calendar,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type AppView = "messages" | "agents" | "calendar";

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Messages", view: "messages" as AppView },
  { icon: Bot, label: "Agents", view: "agents" as AppView },
  { icon: Users, label: "People" },
  { icon: FileText, label: "Documents" },
  { icon: Mail, label: "Mail" },
  { icon: Calendar, label: "Calendar", view: "calendar" as AppView },
];

interface IconRailProps {
  activeView?: AppView;
  onViewChange?: (view: AppView) => void;
}

export function IconRail({ activeView = "messages", onViewChange }: IconRailProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex w-[60px] flex-col items-center bg-[var(--hm-icon-rail)] border-r border-[var(--hm-icon-rail)] py-4">
      {/* Logo */}
      <img src="/logo2.png" alt="Hivemind" className="mb-4 h-9 w-9 rounded-full object-cover" />

      <div className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.view ? activeView === item.view : false;
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger
                onClick={() => {
                  if (item.view && onViewChange) {
                    onViewChange(item.view);
                  }
                }}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Theme toggle pinned to bottom */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{theme === "dark" ? "Light mode" : "Dark mode"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
