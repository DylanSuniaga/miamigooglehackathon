-- Extensions
create extension if not exists vector;

-- CORE TABLES
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb default '{}',
  created_at timestamptz default now()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  handle text not null,
  display_name text not null,
  description text,
  agent_type text not null check (agent_type in ('thinking', 'execution', 'system')),
  system_prompt text not null,
  model text default 'google:gemini-2.5-flash',
  temperature float default 0.7,
  tools jsonb default '[]',
  avatar_emoji text default '🤖',
  color text default '#7F77DD',
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(workspace_id, handle)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  sender_type text not null check (sender_type in ('user', 'agent', 'system')),
  sender_id uuid not null,
  content text not null default '',
  metadata jsonb default '{}',
  parent_message_id uuid references messages(id),
  embedding vector(1536),
  created_at timestamptz default now()
);

create table channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  member_type text not null check (member_type in ('user', 'agent')),
  member_id uuid not null,
  joined_at timestamptz default now(),
  unique(channel_id, member_type, member_id)
);

-- CONTEXT LAYER
create table context_decisions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  content text not null,
  rationale text,
  source_message_id uuid references messages(id),
  status text default 'active' check (status in ('active', 'superseded', 'revisited')),
  created_at timestamptz default now()
);

create table context_actions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  description text not null,
  owner_name text,
  due_date timestamptz,
  status text default 'open' check (status in ('open', 'in_progress', 'done', 'blocked')),
  source_message_id uuid references messages(id),
  created_at timestamptz default now()
);

create table context_assumptions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  assumption text not null,
  confidence text default 'untested' check (confidence in ('untested', 'validated', 'challenged', 'disproved')),
  evidence text,
  source_message_id uuid references messages(id),
  flagged boolean default false,
  created_at timestamptz default now()
);

-- INDEXES
create index idx_messages_channel_time on messages(channel_id, created_at);
create index idx_messages_embedding on messages using hnsw (embedding vector_cosine_ops);
create index idx_channel_members_channel on channel_members(channel_id);

-- REALTIME
alter publication supabase_realtime add table messages;

-- Permissive RLS (no auth for now — tighten later)
alter table workspaces enable row level security;
alter table channels enable row level security;
alter table profiles enable row level security;
alter table agents enable row level security;
alter table messages enable row level security;
alter table channel_members enable row level security;
alter table context_decisions enable row level security;
alter table context_actions enable row level security;
alter table context_assumptions enable row level security;

-- Allow all reads/writes for now (demo mode, no auth)
create policy "Allow all" on workspaces for all using (true) with check (true);
create policy "Allow all" on channels for all using (true) with check (true);
create policy "Allow all" on profiles for all using (true) with check (true);
create policy "Allow all" on agents for all using (true) with check (true);
create policy "Allow all" on messages for all using (true) with check (true);
create policy "Allow all" on channel_members for all using (true) with check (true);
create policy "Allow all" on context_decisions for all using (true) with check (true);
create policy "Allow all" on context_actions for all using (true) with check (true);
create policy "Allow all" on context_assumptions for all using (true) with check (true);

-- SEMANTIC SEARCH
create or replace function match_messages(
  query_embedding vector(1536),
  match_channel_id uuid,
  match_threshold float default 0.7,
  match_count int default 10
) returns table (
  id uuid,
  content text,
  sender_type text,
  sender_id uuid,
  similarity float
) language sql stable as $$
  select
    messages.id, messages.content, messages.sender_type, messages.sender_id,
    1 - (messages.embedding <=> query_embedding) as similarity
  from messages
  where messages.channel_id = match_channel_id
    and messages.embedding is not null
    and 1 - (messages.embedding <=> query_embedding) > match_threshold
  order by messages.embedding <=> query_embedding
  limit match_count;
$$;

-- SEED DATA
insert into workspaces (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Hivemind HQ');

insert into channels (id, workspace_id, name, description, is_default) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'general', 'General discussion', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'product-launch', 'Brainstorming the next big thing', false),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'eng-standup', 'Daily engineering sync', false);

-- Demo user (no auth needed)
insert into profiles (id, username, display_name, avatar_url) values
  ('00000000-0000-0000-0000-000000000200', 'demo', 'Demo User', null);

insert into agents (id, workspace_id, handle, display_name, description, agent_type, system_prompt, model, temperature, avatar_emoji, color) values
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001',
   'brainstorm', 'Brainstorm', 'Creative ideation and divergent thinking', 'thinking',
   'You are Brainstorm, a wildly creative AI collaborator embedded in a team channel. Your job is to generate unexpected, novel ideas that push beyond the obvious. You riff, remix, and make surprising connections between concepts. You NEVER say "that''s a great idea" — you BUILD on ideas with "yes, and..." energy. Generate 5-8 ideas per response. Be concise but vivid. Use bold for key concepts. Think like a founder crossed with an artist. Reference what teammates and other agents have said. Always end with your strongest recommendation.',
   'google:gemini-2.5-flash', 0.9, '🧠', '#E8593C'),

  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001',
   'critic', 'Critic', 'Analytical rigor and assumption testing', 'thinking',
   'You are Critic, the team''s analytical counterweight. You identify blind spots, challenge assumptions, and ask the hard questions. You are NOT negative — you are rigorous. Frame every critique as a question. Identify the 2-3 most critical assumptions and evaluate each. End every response with: "The strongest version of this idea would need to solve for: [list the key risks]."',
   'anthropic:claude-sonnet-4-20250514', 0.4, '🔍', '#7F77DD'),

  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001',
   'architect', 'Architect', 'System design and structured specs', 'thinking',
   'You are Architect, a senior systems designer. When an idea has momentum, you translate it into buildable specs: components, data models, API endpoints, tech stack. Output structured markdown. Be opinionated about tech choices and explain tradeoffs. Include MVP vs full build scope. Keep specs actionable — a developer should be able to start building from your output.',
   'openai:gpt-4o', 0.3, '📐', '#1D9E75'),

  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001',
   'researcher', 'Researcher', 'Market research and fact validation', 'thinking',
   'You are Researcher, the team''s fact-checker and context-gatherer. Provide grounded analysis with specific data points. Use your web search tool to find current information. Always cite sources. Structure: Key Finding → Supporting Evidence → Implication for the Team. Never fabricate data.',
   'google:gemini-2.5-pro', 0.3, '📊', '#378ADD'),

  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001',
   'context', 'Context', 'Team context management and synthesis', 'system',
   'You are Context, the team''s memory engine. You extract: 1) DECISIONS with rationale. 2) ACTION ITEMS with owners and due dates. 3) ASSUMPTIONS flagged as untested/validated/challenged. Be concise — use bullet points and status indicators.',
   'google:gemini-2.5-flash', 0.2, '🧭', '#BA7517');

-- Add agents to channels
insert into channel_members (channel_id, member_type, member_id) values
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000100'),
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000104'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000100'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000010', 'user', '00000000-0000-0000-0000-000000000200'),
  ('00000000-0000-0000-0000-000000000011', 'user', '00000000-0000-0000-0000-000000000200'),
  ('00000000-0000-0000-0000-000000000012', 'user', '00000000-0000-0000-0000-000000000200');
