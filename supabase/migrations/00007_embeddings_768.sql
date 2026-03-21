-- Migration: Change embedding dimension from 1536 to 768 for Google gemini-embedding-001

-- Drop existing HNSW index
drop index if exists idx_messages_embedding;

-- Change vector dimension
alter table messages alter column embedding type vector(768);

-- Recreate HNSW index
create index idx_messages_embedding on messages using hnsw (embedding vector_cosine_ops);

-- Replace match_messages function with 768-dim parameter
create or replace function match_messages(
  query_embedding vector(768),
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
