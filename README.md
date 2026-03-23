![Hivemind](public/gibert.jpeg)

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


### Features Added

| Feature | Description |
|---------|-------------|
| **Launch Agent button** | Renamed from "Launch" in the channel header |
| **In-Chat Sandbox** | Agents run Python/JS/HTML inline in chat via Pyodide WASM |
| **LaTeX Rendering** | `$...$` and `$$...$$` render via KaTeX in all agent messages |
| **Universal Instructions** | Workspace-level system prompt prefix for all agents |
| **Complex Agents** | Multi-tool agents with `run_code`, `web_search`, `read_docs`, Context7 MCP |

### Database Migrations

Run these in your Supabase SQL editor (or `supabase db push`):

```
supabase/migrations/00004_workspace_instructions.sql  ← universal instructions table
supabase/migrations/00005_sandbox_runs.sql            ← sandbox run tracking
```

### New Environment Variables

```env
# Optional — enables web_search tool in complex agents
TAVILY_API_KEY=

# Optional — enables Context7 real-time library docs in complex agents
# Get at: https://context7.com
CONTEXT7_MCP_API_TOKEN=
```

### Sandbox Usage

When you ask an agent to produce a chart, data analysis, animation, or any executable output, it embeds:

```
<<<SANDBOX:{"language":"python","code":"import matplotlib.pyplot as plt\n...","title":"My Chart"}>>>
```

…in its response. The `SandboxOutputCard` component auto-detects this, runs it in Pyodide (Python WebAssembly — no server required), and shows the output inline in chat. Everyone in the channel sees the same result.

**Supported output types:**
- `matplotlib` charts → rendered as PNG image
- `pandas` DataFrames → rendered as styled HTML table
- `print()` output → rendered as text
- `javascript` → runs in browser eval
- `html` → rendered in sandboxed iframe

### Universal Instructions

Go to **Agent Manager → Instructions tab** (globe icon). Add workspace-wide text that all agents receive as a silent prefix to their system prompt. Uncheck specific agents to exclude them.

### Testing

1. **Sandbox:** Ask an agent in chat: *"Plot a sine wave"* → see the chart appear inline
2. **LaTeX:** Send a message with `$E = mc^2$` and verify it renders as math
3. **Universal instructions:** Go to Agents → Instructions tab, add text, save, then trigger an agent to confirm it uses those instructions
4. **Complex agent:** In Agent Manager → select an agent → Configuration → add `run_code` to tools, save, then launch it
