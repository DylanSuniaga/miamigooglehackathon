"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { IconRail, type AppView } from "@/components/layout/icon-rail";
import { ChannelSidebar } from "@/components/layout/channel-sidebar";
import { ChannelHeader } from "@/components/layout/channel-header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { AgentManagerLayout } from "@/components/agent-manager/agent-manager-layout";
import { AgentLauncherModal } from "@/components/agent-manager/agent-launcher-modal";
import { ContextPanel } from "@/components/context-panel/context-panel";
import { useWorkspace } from "@/hooks/use-workspace";
import { useChannelMessages } from "@/hooks/use-channel-messages";
import { useAgentStreaming, type StreamingMessage as StreamingMessageType } from "@/hooks/use-agent-streaming";
import { useAgentRuns } from "@/hooks/use-agent-runs";

const MOCK_DM_USERS = [
  { id: "d1", name: "Blake Anderson", avatarColor: "#7F77DD", you: true },
  { id: "d2", name: "Benjamin Chen", avatarColor: "#1D9E75" },
  { id: "d3", name: "Jay 10x", avatarColor: "#E8593C" },
  { id: "d4", name: "Ben Wang", avatarColor: "#378ADD" },
];

export default function Home() {
  const { channels, agents, loading: workspaceLoading, createChannel } = useWorkspace();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [pendingAgents, setPendingAgents] = useState<StreamingMessageType[]>([]);
  const [activeView, setActiveView] = useState<AppView>("messages");
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [showLauncher, setShowLauncher] = useState(false);

  // Set default channel once loaded
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      const defaultChannel = channels.find((c) => c.is_default) ?? channels[0];
      setActiveChannelId(defaultChannel.id);
    }
  }, [channels, activeChannelId]);

  const { messages, sendMessage, deleteMessage } =
    useChannelMessages(activeChannelId);

  const { streamingMessages } = useAgentStreaming(activeChannelId);

  const { activeRuns } = useAgentRuns(activeChannelId);

  // Build enriched runs with agent metadata
  const enrichedRuns = useMemo(() => {
    return activeRuns.map((run) => {
      const agent = agents.find((a) => a.id === run.agent_id);
      return {
        ...run,
        agentName: agent?.display_name,
        agentEmoji: agent?.avatar_emoji,
        agentColor: agent?.color,
      };
    });
  }, [activeRuns, agents]);

  // Remove pending agents once real streaming starts
  useEffect(() => {
    if (streamingMessages.length > 0) {
      const streamingIds = new Set(streamingMessages.map((m) => m.agentId));
      setPendingAgents((prev) => prev.filter((p) => !streamingIds.has(p.agentId)));
    }
  }, [streamingMessages]);

  // Merge pending + streaming for display
  const allStreamingMessages = useMemo(() => {
    const streamingIds = new Set(streamingMessages.map((m) => m.agentId));
    const activePending = pendingAgents.filter((p) => !streamingIds.has(p.agentId));
    return [...activePending, ...streamingMessages];
  }, [pendingAgents, streamingMessages]);

  const sidebarChannels = channels.map((c) => ({
    id: c.id,
    name: c.name,
    unread: 0,
  }));

  const currentChannel = channels.find((c) => c.id === activeChannelId);

  const agentPills = agents.map((a) => ({
    handle: a.handle,
    emoji: a.avatar_emoji,
    color: a.color,
  }));

  const invokeAgent = useCallback(
    async (agentHandle: string) => {
      if (!activeChannelId) return;

      // Find the agent info to show pending indicator immediately
      const agent = agents.find((a) => a.handle === agentHandle);
      if (agent) {
        setPendingAgents((prev) => [
          ...prev,
          {
            agentId: agent.id,
            agentHandle: agent.handle,
            agentName: agent.display_name,
            agentEmoji: agent.avatar_emoji,
            agentColor: agent.color,
            model: agent.model,
            content: "",
          },
        ]);
      }

      try {
        // When @context is invoked, fire both the chat response AND extraction in parallel
        const promises: Promise<unknown>[] = [
          fetch("/api/agent/invoke", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId: activeChannelId,
              agentHandle,
            }),
          }),
        ];

        if (agentHandle === "context") {
          promises.push(
            fetch("/api/context/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channelId: activeChannelId }),
            })
          );
          // Auto-open the context panel
          setContextPanelOpen(true);
        }

        await Promise.all(promises);
      } catch (err) {
        console.error("Failed to invoke agent:", err);
        // Remove pending on error
        if (agent) {
          setPendingAgents((prev) => prev.filter((p) => p.agentId !== agent.id));
        }
      }
    },
    [activeChannelId, agents]
  );

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
      <IconRail activeView={activeView} onViewChange={setActiveView} />

      {activeView === "messages" ? (
        <>
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
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={() => setContextPanelOpen((prev) => !prev)}
              onLaunchAgent={() => setShowLauncher(true)}
            />
            <MessageList
              messages={messages}
              streamingMessages={allStreamingMessages}
              agents={agentPills}
              activeRuns={enrichedRuns}
              onDeleteMessage={deleteMessage}
            />
            <MessageInput
              channelName={currentChannel?.name ?? ""}
              onSend={sendMessage}
              agents={agentPills}
              onInvokeAgent={invokeAgent}
            />
          </div>

          {contextPanelOpen && activeChannelId && (
            <ContextPanel
              channelId={activeChannelId}
              onClose={() => setContextPanelOpen(false)}
            />
          )}

          <CreateChannelDialog
            open={showCreateChannel}
            onClose={() => setShowCreateChannel(false)}
            onCreate={handleCreateChannel}
          />
        </>
      ) : (
        <AgentManagerLayout />
      )}

      {/* Agent Launcher Modal */}
      <AgentLauncherModal
        open={showLauncher}
        onClose={() => setShowLauncher(false)}
        agents={agents}
        channelId={activeChannelId ?? ""}
        channelName={currentChannel?.name ?? ""}
      />
    </div>
  );
}
