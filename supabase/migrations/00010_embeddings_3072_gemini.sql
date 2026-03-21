-- Migration: Update embedding dimension to 3072 to natively support gemini-embedding-001 without semantic-destroying truncation

drop index if exists idx_messages_embedding;

-- We MUST drop the existing incompatible 768-dim embeddings before casting the column
update messages set embedding = null where embedding is not null;

alter table messages alter column embedding type vector(3072);
-- Removed 'create index idx_messages_embedding' because pgvector's HNSW index only supports up to 2000 dimensions.
-- For datasets typical in a hackathon, an unindexed Exact Nearest Neighbor sequential scan will be virtually instantaneous anyway!

drop function if exists match_messages;

create or replace function match_messages(
  query_embedding vector(3072),
  match_channel_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  sender_type text,
  sender_id uuid,
  similarity float
)
language sql
stable
as $$
  select
    messages.id,
    messages.content,
    messages.sender_type,
    messages.sender_id,
    1 - (messages.embedding <=> query_embedding) as similarity
  from messages
  where messages.channel_id = match_channel_id
    and messages.embedding is not null
    and 1 - (messages.embedding <=> query_embedding) > match_threshold
  order by messages.embedding <=> query_embedding
  limit match_count;
$$;
