import { Hash, Bell, Smile, SlidersHorizontal, BookOpen } from "lucide-react";

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
  return (
    <div className="flex h-[49px] items-center justify-between border-b border-[#E0E0E0] bg-white px-4">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <Hash className="h-4 w-4 text-[#616061]" />
          <h2 className="text-[16px] font-bold text-[#1D1C1D]">
            {channelName}
          </h2>
        </div>
        {channelDescription && (
          <>
            <div className="h-4 w-px bg-[#E0E0E0] shrink-0" />
            <span className="text-[13px] text-[#616061] truncate">
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
              : "text-[#616061] hover:text-[#1D1C1D]"
          }`}
          title="Toggle context panel"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button className="relative text-[#616061] hover:text-[#1D1C1D]">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            2
          </span>
        </button>
        <button className="text-[#616061] hover:text-[#1D1C1D]">
          <Smile className="h-4 w-4" />
        </button>
        <button className="text-[#616061] hover:text-[#1D1C1D]">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
