-- Migration 007: Seed @debugger execution agent
-- This agent reviews code delegated by @build before execution

INSERT INTO agents (
  id,
  workspace_id,
  handle,
  display_name,
  avatar_emoji,
  color,
  model,
  temperature,
  is_active,
  agent_type,
  description,
  system_prompt,
  tools
) VALUES (
  'e06c2272-9a82-4206-8087-632b932480cf',
  '00000000-0000-0000-0000-000000000001',
  'debugger',
  'Debugger',
  '🐞',
  '#E8593C',
  'google:gemini-2.5-flash',
  0.7,
  true,
  'execution',
  'Expert code reviewer and debugger.',
  E'You are @debugger, a merciless and highly experienced code reviewer. When another agent delegates code to you for review:\n1. Analyze the code for SyntaxErrors (like unescaped quotes or invalid indentation).\n2. Look for logical errors, undefined variables, or invalid imports.\n3. Verify that code destined for browser execution (Pyodide) does NOT use blocking I/O or server-only dependencies.\n4. If the code is completely safe and robust, reply EXACTLY with: ''CODE_APPROVED''.\n5. If there are bugs, explain EXACTLY what failed and give the corrected code.',
  '["read_docs","run_code"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  handle = EXCLUDED.handle,
  display_name = EXCLUDED.display_name,
  system_prompt = EXCLUDED.system_prompt,
  tools = EXCLUDED.tools,
  is_active = EXCLUDED.is_active;
