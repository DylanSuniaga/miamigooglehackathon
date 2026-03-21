-- Migration 005: Sandbox Runs (In-Chat Code Execution)
-- Run this in your Supabase SQL editor or via CLI: supabase db push

CREATE TABLE IF NOT EXISTS sandbox_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Links to the agent_run that spawned this sandbox execution
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  -- The channel message ID this sandbox output is attached to
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'python',  -- python | javascript | html
  code TEXT NOT NULL,
  -- Rendered output: HTML string (matplotlib figure, table, text, etc.)
  output_html TEXT,
  -- Raw stdout/stderr
  output_raw TEXT,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- For quick lookup of sandbox runs by channel (for real-time rendering)
CREATE INDEX IF NOT EXISTS sandbox_runs_channel_id_idx ON sandbox_runs (channel_id);
CREATE INDEX IF NOT EXISTS sandbox_runs_message_id_idx ON sandbox_runs (message_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sandbox_runs;

-- Enable RLS
ALTER TABLE sandbox_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members can view sandbox runs"
  ON sandbox_runs FOR SELECT
  USING (true);

CREATE POLICY "Service role can write sandbox runs"
  ON sandbox_runs FOR ALL
  USING (true);
