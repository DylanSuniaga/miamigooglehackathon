-- Enable Realtime for channels table (for live sidebar updates)
alter publication supabase_realtime add table channels;

-- Enable full replica identity on channels so DELETE payloads include the row id
alter table channels replica identity full;

-- Enable full replica identity on messages so DELETE payloads include the row id
alter table messages replica identity full;
