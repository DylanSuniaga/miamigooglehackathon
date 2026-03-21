![Hivemind](public/header.jpeg)

# Hivemind

**AI-Native Team Workspace + Agent Management Platform**

A channel-based collaboration workspace where AI agents are first-class participants — not sidebar tools, not separate tabs. Humans and agents brainstorm, challenge, specify, and plan together in the same stream.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, canary) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| Database | Supabase Postgres |
| Real-time | Supabase Realtime (Postgres Changes + Broadcast) |
| Deploy | Vercel + Supabase Cloud |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (IMPORTANT!)
# Set GEMINI_API_KEY for Gemini models

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

*To verify your setup:*
1. Run a generic test `npm test` (if framework like Vitest is setup).
2. **Agent Assignment Test:** In the UI, navigate to the **Agents** tab. Select an agent (e.g., Brainstorm) and update its system prompt. Save the changes and reload the page to verify the DB persistence works.
3. **Gemini Key Verification:** Attempt to trigger an agent in the chat view; it should gracefully use the `GEMINI_API_KEY`.

## What's Implemented

### ✅ Phase 1: Foundation — Working Chat
- Next.js 16 canary scaffold with Tailwind CSS 4 + shadcn/ui (base-nova)
- Full workspace UI: IconRail → ChannelSidebar → ChannelHeader → MessageList → MessageInput
- Supabase wired: browser client, server client, middleware for session refresh
- Real-time messaging via `use-channel-messages` hook (INSERT + DELETE subscriptions)
- Channel management: create channels via dialog, real-time sidebar updates
- Workspace data from Supabase via `use-workspace` hook

### 🔧 In Progress
- Phase 2: Thinking Agents (AI streaming responses)
- Phase 5: Agent Management Layer (config editor, context injection, run history)

## Repo

https://github.com/DylanSuniaga/miamigooglehackathon.git