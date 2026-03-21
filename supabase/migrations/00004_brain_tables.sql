-- Agent context documents (per-agent reference docs)
create table if not exists agent_context_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
  title text not null,
  content text not null,
  doc_type text not null default 'context' check (doc_type in ('context', 'prompt_fragment', 'reference', 'rules')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent run history
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
  channel_id uuid references channels(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_summary text,
  output_summary text,
  model_used text,
  duration_ms int,
  token_count_input int,
  token_count_output int,
  steps jsonb default '[]',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_agent_context_docs_agent_active on agent_context_documents(agent_id, is_active);
create index if not exists idx_agent_runs_agent_time on agent_runs(agent_id, created_at desc);

-- Realtime for agent_runs (ignore if already added)
do $$ begin
  alter publication supabase_realtime add table agent_runs;
exception when duplicate_object then null;
end $$;
alter table agent_runs replica identity full;

-- Permissive RLS (demo mode)
alter table agent_context_documents enable row level security;
alter table agent_runs enable row level security;

do $$ begin
  create policy "Allow all" on agent_context_documents for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Allow all" on agent_runs for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
