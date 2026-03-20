# Hivemind

AI workspace where teams think together and agents ship the results.

## Project Overview

Channel-based collaboration tool (like Slack) where AI agents are first-class participants. Teams brainstorm in shared channels with thinking agents (@brainstorm, @critic, @architect, @researcher). A @context agent auto-extracts decisions, actions, and assumptions into a structured context layer.

**Core loop:** Think → Decide → Act → Learn → Think

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **Database:** Supabase Postgres
- **Real-time:** Supabase Realtime (Broadcast for streaming, Postgres Changes for final messages)
- **Auth:** Deferred — using hardcoded demo user for now

## Architecture Decisions

### Model Resolution
Agent models stored as `provider:model` strings (e.g. `google:gemini-2.5-flash`). Resolved at runtime via `lib/ai.ts` using native AI SDK providers. Each provider reads its own env var:
- `@ai-sdk/openai` → `OPENAI_API_KEY`
- `@ai-sdk/anthropic` → `ANTHROPIC_API_KEY`
- `@ai-sdk/google` → `GOOGLE_GENERATIVE_AI_API_KEY`

### Streaming
Use Supabase Realtime **Broadcast** for live token streaming (not DB writes). Accumulate full response server-side, then single INSERT to `messages` table on completion. Clients subscribe to both:
- Broadcast channel (`stream:{channelId}`) for live tokens
- Postgres Changes on `messages` table for final persisted messages

### Auth (Deferred)
No auth for now. Using a hardcoded demo user seeded in the DB:
```
id: 00000000-0000-0000-0000-000000000200
username: demo
display_name: Demo User
```
RLS policies are permissive ("allow all") until auth is implemented.

## Agents

| Handle | Model | Purpose |
|--------|-------|---------|
| @brainstorm | `google:gemini-2.5-flash` | Creative ideation, divergent thinking |
| @critic | `anthropic:claude-sonnet-4-20250514` | Analytical rigor, assumption testing |
| @architect | `openai:gpt-4o` | System design, structured specs |
| @researcher | `google:gemini-2.5-pro` | Market research, fact validation (has web search tool) |
| @context | `google:gemini-2.5-flash` | Auto-extract decisions, actions, assumptions |

## Key Files

- `lib/ai.ts` — Multi-provider model resolver
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server Supabase client (service role)
- `lib/demo-user.ts` — Hardcoded demo user constant
- `app/api/agent/invoke/route.ts` — Agent invocation + streaming endpoint
- `hooks/use-channel-messages.ts` — Realtime message subscription
- `hooks/use-agent-streaming.ts` — Broadcast subscription for live tokens
- `supabase/migrations/00001_initial_schema.sql` — Full schema + seed data

## Design

Light theme inspired by Slack:
- White backgrounds (`#FFFFFF`), light gray surfaces (`#F8F8F8`)
- Two-level sidebar: narrow dark icon rail + channel list panel
- Agent messages get subtle left border in their color
- Model badges on agent messages (monospace, small, muted)

## Conventions

- Use App Router (no Pages Router)
- Server components by default, `'use client'` only when needed (hooks, interactivity)
- Supabase service role key for all server-side agent writes (bypasses RLS)
- Anon key for client-side reads
- All database IDs are UUIDs
- Seed data uses hardcoded UUIDs starting with `00000000-0000-0000-0000-...`

## Commands

```bash
npm run dev          # Start dev server
npx supabase start   # Start local Supabase (if using local)
npx supabase db push # Push migrations to remote Supabase
```

## Repo

https://github.com/DylanSuniaga/miamigooglehackathon.git
