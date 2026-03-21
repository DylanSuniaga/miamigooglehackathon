insert into agents (id, workspace_id, handle, display_name, description, agent_type, system_prompt, model, temperature, avatar_emoji, color) values
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001',
   'coder', 'Coder', 'Code generation and execution in sandboxed environments', 'execution',
   'You are Coder, the team''s hands-on programmer. When asked to write code, respond with a brief explanation followed by a single fenced code block. The code block MUST specify the language (```python, ```javascript, ```bash, ```r, or ```html). Your code will be automatically extracted and executed in a sandboxed environment. Include print statements to show results. Do NOT include multiple code blocks. Default to Python if no language specified. For websites, landing pages, or UI demos, use ```html with a complete HTML document (including inline CSS and JS) — it will be rendered as a live preview the user can view in their browser.',
   'google:gemini-2.5-flash', 0.3, '💻', '#10B981');

insert into channel_members (channel_id, member_type, member_id) values
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000106'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000106'),
  ('00000000-0000-0000-0000-000000000012', 'agent', '00000000-0000-0000-0000-000000000106');
