# Hivemind — Implementation Plan

## Vision & Positioning

Hivemind is the workspace where product teams and AI agents think, decide, and build together. It bridges two worlds that have stayed stubbornly separate: the messy, human process of ideation and product decision-making, and the structured, executable world of AI agent systems.

Primary audience: Technical founders, AI engineers, and product managers at product-based businesses — the people who are both building AI agent systems and trying to ship products faster with them. Hivemind is built for both, simultaneously.

## Context

Building **Hivemind** for a hackathon: a channel-based AI workspace where teams collaborate with AI agents as first-class participants. Agents brainstorm, critique, architect, and research alongside humans. Auth is deferred — focus on getting agents and the platform working first.

**Repo:** https://github.com/DylanSuniaga/miamigooglehackathon.git

---

## The Two Core Features

Everything else in this document is a power multiplier built on top of these two pillars.

### Core 1 — AI-Native Team Chat (The Chat IS the IDE)

A channel-based collaboration workspace where AI agents are first-class participants — not sidebar tools, not separate tabs. Humans and agents brainstorm, challenge, specify, and plan together in the same stream. When the team is ready to act, an execution agent launches directly from the conversation and ships the result back into the channel.

The fundamental loop:
**Think → Decide → Act → Learn → Think**

- Teams brainstorm in shared channels with thinking agents (@brainstorm, @critic, @architect, @researcher)
- A system agent (@context) automatically extracts decisions, action items, and assumptions into a structured context layer in real time
- Execution agents (Dev, PM, GTM, QA) read from the accumulated context and take real actions — opening GitHub PRs, creating tickets, drafting launch copy
- All agent activity streams back into the channel so the whole team sees progress live
- The AI steps into human conversations proactively — not just when @mentioned, but when it has something relevant to add

### Core 2 — Agent Management Layer (Neat, Structured, Fast)

The primary problem Hivemind solves for teams building with AI: context clutter. Every agent has its own context. Every tool has its own context. Documents get injected into main agent contexts. Subagents have their own tool lists. Tracking all of this across an agent architecture becomes unmanageable fast — slowing deployment and building speed.

Hivemind provides a single, clean place to:
- Define and configure agents — system prompts, models, temperature, tool access, all in one view
- Manage context injection — see exactly what documents, decisions, and history each agent receives
- Map subagent hierarchies — visualize how agents relate to each other and what flows between them
- Monitor and update agents on the fly — change an agent's behavior mid-session without rebuilding
- Track agent runs — see what each execution agent did, what it produced, and whether it succeeded

The agent management layer is what separates Hivemind from "AI-native Slack." It makes the platform valuable to the engineer building the system, not just the PM using it.

---

## Thinking Agents — The In-Channel AI Team

Five default thinking agents ship with every workspace. Each uses a different frontier model via OpenRouter, demonstrating that the best tool for each job is not always the same LLM.

| Agent | Model | Temp | Role |
|---|---|---|---|
| 🧠 **@brainstorm** | Gemini 3.0 Flash | 0.9 — divergent | Creative ideation; generates 5-8 unexpected ideas per response, riffs on teammate input |
| 🔍 **@critic** | Claude Sonnet | 0.4 — analytical | Identifies blind spots, challenges assumptions, frames every critique as a question |
| 📐 **@architect** | GPT-4o | 0.3 — precise | Translates ideas into buildable specs: components, data models, APIs, MVP scope |
| 📊 **@researcher** | Gemini 2.5 Pro | 0.3 — grounded | Web search via Tavily; provides cited, data-backed market and feasibility analysis |
| 🧭 **@context** | Gemini 2.5 Flash | 0.2 — structured | Extracts decisions, actions, and assumptions; answers "what did we decide about X?" |

---

## Design Direction

**Light/Dark theme** inspired by the Slack-like reference image with minimal builder tool aesthetics:
- Two-level sidebar: narrow icon rail (left edge) + channel list panel
- Channels section with `#` prefix and unread badges
- Messages with circular avatars, bold sender names, muted timestamps
- Clean message input bar with "Message #channel" placeholder
- White/light gray backgrounds, subtle borders (Or Dark: #0C0C0D / Surface #141416)
- Icons for notifications, settings in channel header
- Font: DM Sans (body) + JetBrains Mono (code/badges)

| Token | Light Theme Value | Dark Theme Value (Builder UI) |
|-------|-------|-------|
| Background | `#FFFFFF` | `#0C0C0D` — near-black |
| Surface/Sidebar | `#F8F8F8` | `#141416` — slightly lighter |
| Icon rail | `#3F0E40` (dark purple) | (match surface) |
| Border | `#E0E0E0` | `rgba(255,255,255,0.06)` |
| Text primary | `#1D1C1D` | `#E4E4E7` — high-contrast white |
| Text muted | `#616061` | `rgba(255,255,255,0.5)` — muted |

**Agent Colors:**
| Agent | Color |
|-------|-------|
| @brainstorm | `#E8593C` coral — left border + tinted bg on messages |
| @critic | `#7F77DD` purple — left border + tinted bg on messages |
| @architect | `#1D9E75` green — left border + tinted bg on messages |
| @researcher | `#378ADD` blue — left border + tinted bg on messages |
| @context | `#BA7517` amber — left border + tinted bg on messages |

- Model badges: Monospace, small, muted — JetBrains Mono
- Streaming cursor: Thin vertical bar in agent color, blinking
- Agent progress: Thin progress bar with status-colored fill

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15/16 (App Router) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| AI / Streaming | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| Auth | Supabase Auth — GitHub OAuth (Deferred for now) |
| Database | Supabase Postgres |
| Vector search | Supabase pgvector |
| Real-time | Supabase Realtime (Postgres Changes + Broadcast) |
| Job queue | Supabase pgmq |
| Scheduling | Supabase pg_cron |
| Agent runtime | Supabase Edge Functions + Background Tasks |
| LLM gateway | OpenRouter (OpenAI-compatible API) |
| Web search | Tavily API (Phase 4/6) |
| Code sandbox | E2B (`@e2b/code-interpreter`) |
| GitHub integration | Octokit (`@octokit/rest`) |
| Deploy | Vercel (frontend) + Supabase Cloud (backend) |

---

## Project Structure

```text
hivemind/
├── app/
│   ├── layout.tsx                    # Root layout with Supabase provider
│   ├── page.tsx                      # Landing / redirect to workspace
│   ├── login/page.tsx                # GitHub OAuth login
│   ├── workspace/[workspaceId]/
│   │   ├── layout.tsx                # Sidebar + main
│   │   └── channel/[channelId]/page.tsx  # Chat + right panel
│   └── api/
│       ├── chat/route.ts             # Send message + invoke thinking agent
│       ├── agent/invoke/route.ts     # Invoke a thinking agent
│       ├── agent/launch/route.ts     # Launch execution agent
│       ├── context/extract/route.ts  # Extract decisions/actions/assumptions
│       ├── context/search/route.ts   # Semantic search over context
│       └── webhook/agent-complete/   # Callback when agent finishes
├── components/
│   ├── layout/        # Sidebar, channel header, workspace provider
│   ├── chat/          # Message list, bubble, input, streaming, system msgs
│   ├── context-panel/ # Decisions, actions, assumptions, health widget
│   ├── agents-panel/  # Thinking agents list, execution agent card, launcher
│   └── agent-manager/ # Agent config editor, context map, hierarchy view
├── hooks/
│   ├── use-channel-messages.ts   # Realtime subscription
│   ├── use-agent-runs.ts         # Execution agent status
│   ├── use-context.ts            # Decisions, actions, assumptions
│   └── use-workspace.ts          # Workspace + channels
├── lib/
│   ├── supabase/      # client.ts, server.ts, middleware.ts
│   ├── openrouter.ts  # OpenRouter provider config
│   └── agents/        # prompts.ts, tools.ts, context-extractor.ts
└── supabase/
    ├── migrations/    # Schema, extensions, functions, seed
    └── functions/     # process-agent-job, embed-message
```

---

## Progressive Build Steps / Implementation Phases

Each phase produces a working, demoable state. Build in sequence.

### Phase 1: Foundation — Working Chat & Project Scaffold
**Goal:** Empty Next.js app running locally, static UI shell, and real DB w/ synced messages.

- `npx create-next-app@latest hivemind --typescript --tailwind --app` (or 16-canary)
- Install core deps: `@supabase/supabase-js`, `@supabase/ssr`, `ai`, `@ai-sdk/openai`, `zod`, `react-markdown`, `date-fns`
- Set up shadcn/ui: `button, input, textarea, dialog, tabs, badge, scroll-area, avatar, dropdown-menu, separator, tooltip`
- Create `.env.local` template, `CLAUDE.md`, initialize git.
- Build UI Shell: workspace layout with left sidebar (channels), center (chat), right panel (empty).
- Initialize Supabase (`npx supabase init`), run schema migration, set up GitHub OAuth.
- Fetch channels from Supabase, render in sidebar.
- Message list with Supabase Realtime subscription (INSERT + UPDATE events on messages table).
- Message input with basic send (INSERT into messages table).
- Message bubble — distinct styling for user / agent / system sender types.
✓ **Milestone:** Users can log in (or use demo user), see channels, send messages, and messages appear in real-time across multiple browser tabs.

### Phase 2: Thinking Agents — Core AI Experience
**Goal:** @mention an agent in chat, it streams a response visible to all users.

- `lib/openrouter.ts` — configure OpenRouter as an OpenAI-compatible provider for Vercel AI SDK (and fallback abstract multi-provider resolver `lib/ai.ts` if extending).
- `POST /api/agent/invoke` — load agent config from DB, load last 50 messages, create placeholder row, stream via `streamText()`, update every ~8 tokens, finalize with `is_streaming=false`.
- @mention detection in message input (regex: `@(\w+)`) with automatic agent invocation.
- `streaming-message` component with animated cursor while `is_streaming=true`.
- Agent-mention pills below input — quick-click buttons for each channel agent.
- Show model badge on agent messages (which LLM generated it).
- Typing indicator when any message in channel has `is_streaming=true`.
✓ **Milestone:** Users can @mention any thinking agent; the agent streams a response visible to all users in real-time, with a model badge showing which LLM was used.

### Phase 3: Context Layer — Structured Team Knowledge
**Goal:** Auto-extract decisions, actions, and assumptions into a structured panel.

- `lib/agents/context-extractor.ts` — uses `generateObject()` with Zod schema to extract decisions, actions, and assumptions after each agent response.
- `POST /api/context/extract` — wrap extraction logic, auto-called after every thinking agent completes.
- Context panel (right side): Decisions | Actions | Assumptions tabs.
- Context health widget — N decisions, N/M actions done, N flagged assumptions.
- `hooks/use-context.ts` — fetch context data with Realtime subscription for live updates.
- Post system message when context is extracted.
✓ **Milestone:** After agents respond, the system automatically extracts structured context. The right panel shows a living summary of decisions, owners, and flagged assumptions.

### Phase 4: @researcher with Live Web Search
**Goal:** @researcher can search the web and return grounded answers with citations.

- Install Tavily: `npm install @tavily/core`
- Define `webSearchTool` in `lib/agents/tools.ts` using Tavily search (depth: advanced, maxResults: 5).
- Pass tools to `/api/agent/invoke` when agent is @researcher (maxSteps: 5).
- Format tool results with source citations inline in the message bubble.
✓ **Milestone:** @researcher searches the web in real-time, returning grounded answers with citations directly in the channel.

### Phase 5: Agent Management Layer
**Goal:** Engineers can define, configure, and monitor all agents from a single structured view.

- Agent config editor — edit system prompt, model, temperature, tool access per agent.
- Context injection manager — see and control exactly what documents/context each agent receives.
- Subagent hierarchy visualizer — map parent/child agent relationships and data flow.
- Agent run history — searchable log of every execution with inputs, outputs, steps, and status.
- Live agent monitor — real-time view of which agents are active, queued, or failed.
- Quick-edit for on-the-fly agent creation: name, emoji, prompt, model, tools — ship in 30 seconds.
✓ **Milestone:** Engineers can define, configure, and monitor all agents from a single view. Context injection is explicit and auditable.

### Phase 6: Execution Agents — The Differentiator
**Goal:** Run actual tasks from the channel.

- Install: `npm install @e2b/code-interpreter @octokit/rest`
- Agent launcher modal — agent type, task description, model, context scope selector.
- `POST /api/agent/launch` — assemble context snapshot, insert `agent_run`, push to pgmq, post system message.
- Supabase Edge Function `process-agent-job` — dequeue, update status, run with tools, stream progress.
- Dev agent tools: E2B sandbox (`runCode`, `writeFile`, `installDeps`), GitHub (`createBranch`, `commitFiles`, `openPR`).
- PM/GTM agent tools: context queries, web search, action creation/update.
- Execution agent card: status dot, progress bar, expandable step log, model badge.
- `hooks/use-agent-runs.ts` — Realtime subscription on `agent_runs` per channel.
✓ **Milestone:** Team leads launch execution agents. A dev agent opens an E2B sandbox, writes code/tests, opens a PR — streaming progress back.

### Phase 7: Semantic Search + Embeddings
**Goal:** All messages are embedded. Agents can semantically search everything.

- Edge Function `embed-message` — triggered after each message insert, generates 1536-dim vector via OpenRouter/OpenAI.
- `POST /api/context/search` — embed query, call `match_messages` Postgres function, return top results.
- @context agent uses semantic search to answer questions across full channel history (not just last 50 msgs).
✓ **Milestone:** Agents can semantically search full conversation history to answer questions about past decisions.

### Phase 8: Polish, Demo Prep & Auth
**Goal:** Production-ready demo with real flow.

- Mobile responsive layout (sidebar collapses, right panel becomes a bottom sheet).
- Markdown rendering in agent messages (code blocks, bold, lists, links).
- Loading states and error handling for all API calls.
- Empty states for channels with no messages and context panels with no data.
- Setup Supabase Auth / GitHub OAuth fully.
- Seed demo channel: human brainstorm → @brainstorm → @critic → @architect → @context extracts → dev agent launches → PR opened.
- Deploy: vercel deploy + Supabase Edge Functions deployed.
✓ **Milestone:** Production-ready, deployed, with a compelling demo channel pre-loaded.

---

## Bonus Power Features

These four features make Hivemind a platform businesses pay for at scale. Build after the core is solid.

### Bonus 1 — Meta Agent: The Agent Builder
A standardized AI agent available in any channel as `@build` that builds other agents (e.g., "we need an agent that monitors AWS costs"). Asks clarifying questions and generates the full spec (prompt, model, tools, memory structure, MCP integrations). Outputs agents directly into the Agent Management Layer using Claude Code-style loops with a Context7 MCP for frameworks lookup. Applies security best practices automatically.

### Bonus 2 — Product Launch Analytics + Feedback Processing
A centralized analytics workspace for product launches. Features a feedback ingestion pipeline (App Store, Zendesk, etc.), AI-powered synthesis surfacing top themes natively, a launch timeline view mapping milestones/metric snapshots, and anomaly tracking posted directly to channels. Includes on-demand exportable launch post-mortems via `@context`.

### Bonus 3 — Market Research Agent
A comprehensive research workflow. Triggered by `@researcher` intent or an execution launcher. Multi-step pipeline (competitive landscape → market sizing → customer segments). Outputs as a structured markdown report to the channel (with PDF generation). Integrates a competitor tracking mode returning a weekly digest in a dedicated channel, storing all findings in the context layer.

### Bonus 4 — Ad Performance Tracking + Competitor Intelligence
Read-only integrations to Meta, Google, TikTok, LinkedIn ads. Emits daily digests of ROAS, CPC, CTR tracking. An agent detects anomalies (e.g. "Google campaign X ROAS dropped 40%") and posts alerts natively in-channel. Uses Meta Ad Library to scrape competitor intelligence. Provides weekly AI optimization suggestions, expanding to custom ad agents via the Agent Builder.

---

## Database Schema

File: `supabase/migrations/00001_initial_schema.sql`

```sql
-- Extensions
create extension if not exists vector;
create extension if not exists pgmq;

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
  is_streaming boolean default false,
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

## Critical Implementation Details

### Streaming Pattern — The Most Important UX Detail
The streaming flow is what makes the product feel alive. The key is updating the Supabase message row every ~8 tokens so that all connected clients receive the content growth via Realtime subscriptions.

```typescript
// 1. Create placeholder message (is_streaming: true, content: "")
// 2. Stream from OpenRouter via streamText()
// 3. Accumulate tokens; UPDATE message row every 8 tokens
// 4. Final UPDATE: content = full response, is_streaming = false
//
// Client side: useChannelMessages subscribes to postgres_changes
// INSERT event → new message appears
// UPDATE event → content grows as tokens arrive

// Server side example logic for streaming update:
for await (const chunk of result.textStream) {
  fullContent += chunk;
  tokenCount++;
  if (tokenCount % 8 === 0) {
    await supabase.from('messages').update({ content: fullContent }).eq('id', messageId);
  }
}
await supabase.from('messages').update({ content: fullContent, is_streaming: false }).eq('id', messageId);
```

### OpenRouter + Vercel AI SDK
```typescript
// lib/openrouter.ts
import { createOpenAI } from "@ai-sdk/openai";

export function getModel(modelId: string) {
  const provider = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Hivemind",
    },
  });
  return provider(modelId);
}
```

### Auth Middleware
```typescript
// middleware.ts 
// Protects all routes except /login and /api/webhook
// Uses @supabase/ssr createServerClient with cookie passthrough
// Redirects unauthenticated users to /login
// Service role key used server-side for agent writes (bypasses RLS intentionally)
```

### Demo User (no auth placeholder)
```typescript
// lib/demo-user.ts
export const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000200',
  username: 'demo',
  display_name: 'Demo User',
};
```

---

## Priority Stack 

**MUST**
- Channel UI with message sending
- At least 2 thinking agents streaming responses
- Supabase Realtime — open 2 tabs, both see the stream
- Model badges showing different LLMs per agent

**SHOULD**
- Context extraction panel (decisions / actions / assumptions)
- Agent Management Layer — config editor + run history
- `@researcher` with Tavily web search
- Execution agent card with progress bar

**NICE**
- E2B code execution + GitHub PR creation
- Semantic search + message embeddings
- Agent Builder (`@build` meta-agent)
- Product launch analytics module
- Market research + ad performance bonus features

*Minimum viable demo: a channel where you @brainstorm and @critic, both stream visible to the team, with model badges showing they use different LLMs. That alone proves the core thesis — AI as a team participant, not a sidebar tool.*

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter (all LLM calls route through here)
OPENROUTER_API_KEY=

# Agent Tools (Phase 4/6)
TAVILY_API_KEY=          # @researcher web search
E2B_API_KEY=             # Dev agent code sandbox
GITHUB_TOKEN=            # Dev agent PR creation

# Bonus Feature Keys (add when building those modules)
META_ADS_ACCESS_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
CRUNCHBASE_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
