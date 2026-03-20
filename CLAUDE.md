# Hivemind — Implementation Plan

## Context

Building **Hivemind** for a hackathon: a channel-based AI workspace where teams collaborate with AI agents as first-class participants. Agents brainstorm, critique, architect, and research alongside humans. Auth is deferred — focus on getting agents and the platform working first.

**Repo:** https://github.com/DylanSuniaga/miamigooglehackathon.git

---

## Design Direction (from reference screenshot)

**Light theme** inspired by the Slack-like reference image:
- Two-level sidebar: narrow icon rail (left edge) + channel list panel
- Channels section with `#` prefix and unread badges
- Messages with circular avatars, bold sender names, muted timestamps
- Clean message input bar with "Message #channel" placeholder
- White/light gray backgrounds, subtle borders
- Icons for notifications, settings in channel header

| Token | Value |
|-------|-------|
| Background | `#FFFFFF` |
| Surface/Sidebar | `#F8F8F8` |
| Icon rail | `#3F0E40` (dark purple, like Slack) |
| Border | `#E0E0E0` |
| Text primary | `#1D1C1D` |
| Text muted | `#616061` |
| Agent: Brainstorm | `#E8593C` |
| Agent: Critic | `#7F77DD` |
| Agent: Architect | `#1D9E75` |
| Agent: Researcher | `#378ADD` |
| Agent: Context | `#BA7517` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| Database | Supabase Postgres |
| Real-time | Supabase Realtime (Broadcast + Postgres Changes) |
| Auth | Deferred — hardcoded demo user for now |
| Web search | Tavily API (Phase 6) |
| Deploy | Vercel + Supabase Cloud |

---

## Progressive Build Steps

### Step 1: Project Scaffold
**Goal:** Empty Next.js 16 app running locally, ready to push to repo.

- `npx create-next-app@canary hivemind --typescript --tailwind --app`
- Install core deps: `@supabase/supabase-js @supabase/ssr ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod react-markdown date-fns`
- `npx shadcn@latest init`
- Add shadcn components: `button input textarea tabs badge scroll-area avatar separator tooltip`
- Create `.env.local` template
- Create `CLAUDE.md`
- Initialize git, connect to team repo

**Files:** `package.json`, `.env.local`, `CLAUDE.md`, `tailwind.config.ts`

**Verify:** `npm run dev` → see default Next.js page at localhost:3000

---

### Step 2: UI Shell (No Data)
**Goal:** Static layout matching the reference screenshot — sidebar + channel view + message input. All hardcoded/mock data.

- Build icon rail (narrow left sidebar with icons: messages, people, starred, etc.)
- Build channel sidebar panel ("Messages" header, "Channels" section with #general, #product-launch, #eng-standup)
- Build channel header ("# general" + icons)
- Build message list with 3-4 hardcoded mock messages (avatars, names, timestamps, content)
- Build message input bar ("Message #general" placeholder, emoji/@ buttons, send button)
- Style everything to match the light theme from the screenshot

**Files:**
- `app/layout.tsx` — root layout
- `app/page.tsx` — main workspace view (no routing needed yet)
- `components/layout/icon-rail.tsx`
- `components/layout/channel-sidebar.tsx`
- `components/layout/channel-header.tsx`
- `components/chat/message-list.tsx`
- `components/chat/message-bubble.tsx`
- `components/chat/message-input.tsx`

**Verify:** localhost:3000 looks like the reference screenshot with mock data

---

### Step 3: Supabase + Database
**Goal:** Real database with schema, seed data, and Supabase client wired up.

- `npx supabase init`
- Create migration with all tables (see schema below)
- Set up Supabase project, get keys, fill `.env.local`
- Create `lib/supabase/client.ts` (browser client)
- Create `lib/supabase/server.ts` (server client with service role)
- Create `lib/types.ts` (TypeScript types matching DB schema)
- Run migration + verify seed data exists

**Files:**
- `supabase/migrations/00001_initial_schema.sql`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/types.ts`

**Verify:** Supabase dashboard shows all tables with seed data (workspace, channels, agents)

---

### Step 4: Live Data + Real-time Chat
**Goal:** Replace mock data with real Supabase data. Messages persist and sync across tabs via Realtime.

- Use a hardcoded demo user (skip auth): `{ id: 'demo-user-id', username: 'demo', display_name: 'Demo User' }`
- Fetch channels from Supabase, render in sidebar
- Fetch messages for selected channel, render in message list
- INSERT messages on send
- Subscribe to Supabase Postgres Changes for new messages (INSERT events)
- Add channel switching (click channel in sidebar → load that channel's messages)
- Auto-scroll on new messages
- Create `hooks/use-channel-messages.ts`
- Create `hooks/use-workspace.ts`

**Files:**
- `hooks/use-channel-messages.ts`
- `hooks/use-workspace.ts`
- Update `components/chat/message-input.tsx` (real send)
- Update `components/chat/message-list.tsx` (real data + realtime)
- Update `components/layout/channel-sidebar.tsx` (real channels)

**Verify:** Open 2 browser tabs. Send a message in tab 1 → appears instantly in tab 2.

---

### Step 5: Thinking Agents (Core AI)
**Goal:** @mention an agent in chat, it streams a response visible to all users in real-time.

- Create `lib/ai.ts` — multi-provider model resolver:
  ```typescript
  import { openai } from '@ai-sdk/openai';
  import { anthropic } from '@ai-sdk/anthropic';
  import { google } from '@ai-sdk/google';

  export function getModel(modelString: string) {
    const [provider, ...rest] = modelString.split(':');
    const modelId = rest.join(':');
    switch (provider) {
      case 'openai': return openai(modelId);
      case 'anthropic': return anthropic(modelId);
      case 'google': return google(modelId);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }
  ```
- Create `POST /api/agent/invoke` route:
  1. Load agent config from Supabase (system_prompt, model, temperature)
  2. Load last 50 messages for conversation context
  3. Call `streamText()` from Vercel AI SDK
  4. Broadcast tokens via Supabase Realtime Broadcast
  5. On completion: INSERT final message into DB
- Create `hooks/use-agent-streaming.ts` — Broadcast subscription for live tokens
- Create `components/chat/streaming-message.tsx` — live tokens with blinking cursor
- Update message-input to detect `@mentions` and trigger agent invocation
- Build `components/chat/agent-mention-pills.tsx` — quick @agent buttons below input
- Show model badge on agent messages (which LLM generated it)

**Streaming architecture:**
```
Server: streamText() → for each chunk → broadcast to `stream:{channelId}`
Client: subscribe to broadcast channel → show streaming-message component
On done: server INSERTs final message → client gets Postgres Changes INSERT → replaces streaming UI with final message
```

**Env vars needed:**
- `OPENAI_API_KEY` (for @architect using gpt-4o)
- `ANTHROPIC_API_KEY` (for @critic using claude-sonnet-4)
- `GOOGLE_GENERATIVE_AI_API_KEY` (for @brainstorm and @researcher using Gemini)

**Files:**
- `lib/ai.ts`
- `app/api/agent/invoke/route.ts`
- `hooks/use-agent-streaming.ts`
- `components/chat/streaming-message.tsx`
- `components/chat/agent-mention-pills.tsx`
- Update `components/chat/message-bubble.tsx` (agent styling + model badge)

**Verify:** Type "@brainstorm what should we build?" → agent streams a creative response. Type "@critic" → different model responds with analytical critique. Both visible across tabs.

---

### Step 6: Context Layer
**Goal:** Auto-extract decisions, actions, and assumptions from conversations into a structured panel.

- Create `lib/agents/context-extractor.ts` — uses `generateObject()` with zod schema
- Create `POST /api/context/extract` — batch extraction endpoint
- Build right-side context panel with tabs: Decisions | Actions | Assumptions
- Create `hooks/use-context.ts` — fetch context data for channel
- Show context health summary (N decisions, N actions open, N assumptions)
- Post system message when context is extracted

**Files:**
- `lib/agents/context-extractor.ts`
- `app/api/context/extract/route.ts`
- `components/context-panel/context-panel.tsx`
- `components/context-panel/decisions-tab.tsx`
- `components/context-panel/actions-tab.tsx`
- `components/context-panel/assumptions-tab.tsx`
- `hooks/use-context.ts`

**Verify:** After a few agent responses, trigger extraction → right panel shows structured decisions and action items.

---

### Step 7: @researcher Web Search
**Goal:** @researcher can search the web and return grounded answers with citations.

- Install `@tavily/core`
- Define `webSearchTool` in `lib/agents/tools.ts`
- Update `/api/agent/invoke` to pass tools when agent is @researcher
- Format citations in responses

**Files:**
- `lib/agents/tools.ts`
- Update `app/api/agent/invoke/route.ts`

**Verify:** "@researcher what are the top competitors in X space?" → returns web results with source links.

---

### Step 8: Auth (When Ready)
**Goal:** Add real authentication. Can be GitHub OAuth, email/password, or magic link — keep it simple.

- Set up Supabase Auth provider
- Build simple login page
- Add middleware to protect routes
- Replace hardcoded demo user with real auth user
- Add profile creation trigger

*(Details deferred — implement when core platform is solid)*

---

### Step 9: Polish + Demo Prep
- Markdown rendering in agent messages
- Loading states, error handling, empty states
- Mobile responsive layout
- Seed a demo conversation showing the full agent collaboration flow

---

## Database Schema

File: `supabase/migrations/00001_initial_schema.sql`

```sql
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
```

---

## Key Patterns

### Multi-Provider Model Resolver
```typescript
// lib/ai.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export function getModel(modelString: string) {
  const [provider, ...rest] = modelString.split(':');
  const modelId = rest.join(':');
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    case 'google': return google(modelId);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### Streaming via Broadcast (not DB writes)
```typescript
// Server: stream tokens via Broadcast, single INSERT on completion
for await (const chunk of result.textStream) {
  fullContent += chunk;
  await broadcastChannel.send({
    type: 'broadcast', event: 'token',
    payload: { agentId, content: fullContent, done: false },
  });
}
await supabase.from('messages').insert({ channel_id, sender_type: 'agent', sender_id: agentId, content: fullContent });
await broadcastChannel.send({ type: 'broadcast', event: 'token', payload: { agentId, content: fullContent, done: true } });
```

### Demo User (no auth)
```typescript
// lib/demo-user.ts
export const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000200',
  username: 'demo',
  display_name: 'Demo User',
};
```

---

## Env Vars

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers (each SDK reads its own key automatically)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Agent Tools (Phase 7)
TAVILY_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Priority

**MUST:** Steps 1-5 (scaffold, UI, database, real-time chat, thinking agents)
**SHOULD:** Steps 6-7 (context layer, web search)
**LATER:** Steps 8-9 (auth, polish)
