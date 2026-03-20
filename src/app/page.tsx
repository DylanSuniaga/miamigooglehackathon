"use client";

import { useState, useEffect } from "react";
import { IconRail } from "@/components/layout/icon-rail";
import { ChannelSidebar } from "@/components/layout/channel-sidebar";
import { ChannelHeader } from "@/components/layout/channel-header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { useChannelMessages } from "@/hooks/use-channel-messages";

const MOCK_DM_USERS = [
  { id: "d1", name: "Blake Anderson", avatarColor: "#7F77DD", you: true },
  { id: "d2", name: "Benjamin Chen", avatarColor: "#1D9E75" },
  { id: "d3", name: "Jay 10x", avatarColor: "#E8593C" },
  { id: "d4", name: "Ben Wang", avatarColor: "#378ADD" },
];

export default function Home() {
  const { channels, loading: workspaceLoading, createChannel } = useWorkspace();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  // Set default channel once loaded
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      const defaultChannel = channels.find((c) => c.is_default) ?? channels[0];
      setActiveChannelId(defaultChannel.id);
    }
  }, [channels, activeChannelId]);

  const { messages, sendMessage, deleteMessage } =
    useChannelMessages(activeChannelId);

  const sidebarChannels = channels.map((c) => ({
    id: c.id,
    name: c.name,
    unread: 0,
  }));

  const currentChannel = channels.find((c) => c.id === activeChannelId);

  async function handleCreateChannel(name: string, description: string) {
    const newChannel = await createChannel(name, description);
    setActiveChannelId(newChannel.id);
  }

  if (workspaceLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[#616061] text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <IconRail />
      <ChannelSidebar
        channels={sidebarChannels}
        activeChannelId={activeChannelId ?? ""}
        onChannelSelect={setActiveChannelId}
        onCreateChannel={() => setShowCreateChannel(true)}
        dmUsers={MOCK_DM_USERS}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <ChannelHeader
          channelName={currentChannel?.name ?? ""}
          channelDescription={currentChannel?.description}
        />
        <MessageList messages={messages} onDeleteMessage={deleteMessage} />
        <MessageInput
          channelName={currentChannel?.name ?? ""}
          onSend={sendMessage}
        />
      </div>

      <CreateChannelDialog
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreate={handleCreateChannel}
      />
    </div>
  );
}
