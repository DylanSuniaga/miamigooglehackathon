export interface Workspace {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  handle: string;
  display_name: string;
  description: string | null;
  agent_type: "thinking" | "execution" | "system";
  system_prompt: string;
  model: string;
  temperature: number;
  tools: unknown[];
  avatar_emoji: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_type: "user" | "agent" | "system";
  sender_id: string;
  content: string;
  metadata: Record<string, unknown>;
  parent_message_id: string | null;
  created_at: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  member_type: "user" | "agent";
  member_id: string;
  joined_at: string;
}

export interface ContextDecision {
  id: string;
  channel_id: string;
  content: string;
  rationale: string | null;
  source_message_id: string | null;
  status: "active" | "superseded" | "revisited";
  created_at: string;
}

export interface ContextAction {
  id: string;
  channel_id: string;
  description: string;
  owner_name: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "done" | "blocked";
  source_message_id: string | null;
  created_at: string;
}

export interface ContextAssumption {
  id: string;
  channel_id: string;
  assumption: string;
  confidence: "untested" | "validated" | "challenged" | "disproved";
  evidence: string | null;
  source_message_id: string | null;
  flagged: boolean;
  created_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  channel_id: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  input_summary: string | null;
  output_summary: string | null;
  model_used: string | null;
  duration_ms: number | null;
  token_count_input: number | null;
  token_count_output: number | null;
  steps: unknown[] | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Attachment {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface AgentContextDocument {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  doc_type: "context" | "prompt_fragment" | "reference" | "rules";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
