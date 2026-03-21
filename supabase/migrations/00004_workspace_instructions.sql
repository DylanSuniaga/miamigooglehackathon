-- Migration 004: Workspace Instructions (Universal Agent Prompt Prefix)
-- Run this in your Supabase SQL editor or via CLI: supabase db push

CREATE TABLE IF NOT EXISTS workspace_instructions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  -- NULL means apply to all agents; populated array means exclude those agent IDs
  excluded_agent_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Only one instructions record per workspace
CREATE UNIQUE INDEX IF NOT EXISTS workspace_instructions_workspace_id_idx
  ON workspace_instructions (workspace_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_workspace_instructions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_instructions_updated_at
  BEFORE UPDATE ON workspace_instructions
  FOR EACH ROW EXECUTE FUNCTION update_workspace_instructions_updated_at();

-- Seed: create empty instructions record for the default workspace
INSERT INTO workspace_instructions (workspace_id, content, excluded_agent_ids)
VALUES ('00000000-0000-0000-0000-000000000001', '', '{}')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE workspace_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read instructions"
  ON workspace_instructions FOR SELECT
  USING (true);

CREATE POLICY "Service role can modify instructions"
  ON workspace_instructions FOR ALL
  USING (true);
