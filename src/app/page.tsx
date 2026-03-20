"use client";

import { useState } from "react";
import { IconRail } from "@/components/layout/icon-rail";
import { ChannelSidebar } from "@/components/layout/channel-sidebar";
import { ChannelHeader } from "@/components/layout/channel-header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";

const MOCK_CHANNELS = [
  { id: "1", name: "general", unread: 1 },
  { id: "2", name: "core-app", unread: 0 },
  { id: "3", name: "hiring", unread: 0 },
  { id: "4", name: "random", unread: 0 },
];

const MOCK_DM_USERS = [
  { id: "d1", name: "Blake Anderson", avatarColor: "#7F77DD", you: true },
  { id: "d2", name: "Benjamin Chen", avatarColor: "#1D9E75" },
  { id: "d3", name: "Jay 10x", avatarColor: "#E8593C" },
  { id: "d4", name: "Ben Wang", avatarColor: "#378ADD" },
];

const MOCK_MESSAGES = [
  {
    id: "m1",
    senderName: "Benjamin Chen",
    senderType: "user" as const,
    avatar: null,
    avatarColor: "#1D9E75",
    content:
      "Hey team, just pushed the latest updates to the main branch. Can everyone pull and test?",
    timestamp: "10:32 AM",
  },
  {
    id: "m2",
    senderName: "Jay 10x",
    senderType: "user" as const,
    avatar: null,
    avatarColor: "#E8593C",
    content:
      "On it! I'll run the test suite now and report back.",
    timestamp: "10:33 AM",
  },
  {
    id: "m3",
    senderName: "Blake Anderson",
    senderType: "user" as const,
    avatar: null,
    avatarColor: "#7F77DD",
    content:
      "Looks great so far. I noticed the sidebar layout needs some tweaks — the spacing between sections is a bit tight. I'll open a PR for that.",
    timestamp: "10:34 AM",
  },
  {
    id: "m4",
    senderName: "Ben Wang",
    senderType: "user" as const,
    avatar: null,
    avatarColor: "#378ADD",
    content:
      "Agreed, the header icons could use some cleanup too. Let's sync on the design after lunch.",
    timestamp: "10:35 AM",
  },
];

export default function Home() {
  const [activeChannel, setActiveChannel] = useState("1");
  const currentChannel = MOCK_CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <div className="flex h-full">
      <IconRail />
      <ChannelSidebar
        channels={MOCK_CHANNELS}
        activeChannelId={activeChannel}
        onChannelSelect={setActiveChannel}
        dmUsers={MOCK_DM_USERS}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <ChannelHeader channelName={currentChannel.name} />
        <MessageList messages={MOCK_MESSAGES} />
        <MessageInput channelName={currentChannel.name} />
      </div>
    </div>
  );
}
