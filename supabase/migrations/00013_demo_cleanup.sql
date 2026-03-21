-- Demo cleanup: remove all channels except #general, clear messages

-- Clear tables that reference channels without CASCADE
delete from calendar_events;
delete from agent_runs;

-- Delete all messages
delete from messages;

-- Delete context data
delete from context_decisions;
delete from context_actions;
delete from context_assumptions;

-- Delete channel members for non-general channels
delete from channel_members
  where channel_id != '00000000-0000-0000-0000-000000000010';

-- Delete non-general channels (cascades remaining references)
delete from channels
  where id != '00000000-0000-0000-0000-000000000010';

-- Clear messages in general too for a clean slate
delete from messages
  where channel_id = '00000000-0000-0000-0000-000000000010';
