interface AgentPill {
  handle: string;
  emoji: string;
  color: string;
}

interface AgentMentionPillsProps {
  agents: AgentPill[];
  onMention: (handle: string) => void;
}

export function AgentMentionPills({ agents, onMention }: AgentMentionPillsProps) {
  if (agents.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-5 pb-1">
      <span className="text-[11px] text-[var(--hm-muted-light)] mr-0.5">Agents:</span>
      {agents.map((agent) => (
        <button
          key={agent.handle}
          onClick={() => onMention(agent.handle)}
          className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium transition-colors hover:bg-opacity-10"
          style={{
            borderColor: agent.color,
            color: agent.color,
          }}
        >
          <span>{agent.emoji}</span>
          <span>@{agent.handle}</span>
        </button>
      ))}
    </div>
  );
}
