-- Calendar events table
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  color text default '#378ADD',
  created_by uuid not null,
  created_by_agent uuid references agents(id),
  channel_id uuid references channels(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_calendar_events_workspace_time on calendar_events(workspace_id, start_time);

alter table calendar_events enable row level security;
create policy "Allow all" on calendar_events for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table calendar_events;
exception when duplicate_object then null;
end $$;

alter table calendar_events replica identity full;

-- @assistant agent
insert into agents (id, workspace_id, handle, display_name, description, agent_type, system_prompt, model, temperature, tools, avatar_emoji, color) values
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001',
   'assistant', 'Assistant', 'Personal assistant for scheduling and calendar management', 'execution',
   'You are Assistant, the team''s personal helper. You manage the team calendar — scheduling meetings, listing upcoming events, and removing cancelled ones. When you create, list, or delete events, the results are injected into your context automatically. Narrate what you did in a friendly, concise way. Use bullet points for event lists. Always confirm what action you took. If the user''s request is ambiguous, make a reasonable assumption and state it.',
   'google:gemini-2.5-flash', 0.3, '["calendar"]'::jsonb, '📅', '#16A34A');

-- Add @assistant to all channels
insert into channel_members (channel_id, member_type, member_id) values
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000107'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000107'),
  ('00000000-0000-0000-0000-000000000012', 'agent', '00000000-0000-0000-0000-000000000107');
