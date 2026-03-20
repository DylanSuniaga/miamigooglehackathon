"use client";

import {
  MessageSquare,
  Users,
  Sparkles,
  FileText,
  Mail,
  Calendar,
  Settings,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Messages", active: true },
  { icon: Users, label: "People", badge: true },
  { icon: Sparkles, label: "AI" },
  { icon: FileText, label: "Documents" },
  { icon: Mail, label: "Mail" },
  { icon: Calendar, label: "Calendar" },
];

export function IconRail() {
  return (
    <div className="flex w-[60px] flex-col items-center bg-[#F8F8F8] border-r border-[#E0E0E0] py-4">
      {/* Circular logo */}
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#1D1C1D] text-white font-bold text-sm">
        H
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                item.active
                  ? "text-[#1D1C1D]"
                  : "text-[#616061] hover:bg-[#E0E0E0]/50 hover:text-[#1D1C1D]"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.badge && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#F8F8F8]" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Settings pinned to bottom */}
      <Tooltip>
        <TooltipTrigger className="flex h-9 w-9 items-center justify-center rounded-lg text-[#616061] hover:bg-[#E0E0E0]/50 hover:text-[#1D1C1D] transition-colors">
          <Settings className="h-5 w-5" />
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
