"use client";

import { Hash, ChevronDown, Plus } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  unread: number;
}

interface DMUser {
  id: string;
  name: string;
  avatarColor: string;
  you?: boolean;
}

interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId: string;
  onChannelSelect: (id: string) => void;
  onCreateChannel?: () => void;
  dmUsers?: DMUser[];
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onChannelSelect,
  onCreateChannel,
  dmUsers = [],
}: ChannelSidebarProps) {
  return (
    <div className="flex w-[240px] flex-col border-r border-[#E0E0E0] bg-[#F8F8F8]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0E0]">
        <button className="flex items-center gap-1">
          <h1 className="text-[15px] font-bold text-[#1D1C1D]">Messages</h1>
          <ChevronDown className="h-3.5 w-3.5 text-[#1D1C1D]" />
        </button>
        <button
          onClick={onCreateChannel}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#616061] hover:bg-[#E0E0E0]/50 hover:text-[#1D1C1D]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels section */}
        <div className="px-3 py-1">
          <button className="flex w-full items-center gap-1 text-[13px] font-semibold text-[#616061] hover:text-[#1D1C1D]">
            <ChevronDown className="h-3 w-3" />
            Channels
          </button>
        </div>

        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onChannelSelect(channel.id)}
            className={`flex w-full items-center gap-2 px-4 py-[5px] text-[14px] transition-colors ${
              activeChannelId === channel.id
                ? "font-bold text-[#1D1C1D]"
                : "text-[#1D1C1D] hover:bg-[#E0E0E0]/50"
            }`}
          >
            <Hash className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{channel.name}</span>
            {channel.unread > 0 && activeChannelId !== channel.id && (
              <span className="ml-auto rounded-md bg-[#E0E0E0] px-[6px] py-[1px] text-[11px] font-semibold text-[#616061]">
                {channel.unread}
              </span>
            )}
          </button>
        ))}

        {/* Direct Messages section */}
        {dmUsers.length > 0 && (
          <>
            <div className="px-3 py-1 mt-3">
              <button className="flex w-full items-center gap-1 text-[13px] font-semibold text-[#616061] hover:text-[#1D1C1D]">
                <ChevronDown className="h-3 w-3" />
                Direct Messages
              </button>
            </div>

            {dmUsers.map((user) => (
              <button
                key={user.id}
                className="flex w-full items-center gap-2 px-4 py-[5px] text-[14px] text-[#1D1C1D] hover:bg-[#E0E0E0]/50"
              >
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">
                  {user.name}
                  {user.you && (
                    <span className="text-[#616061] text-[12px]"> (you)</span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
