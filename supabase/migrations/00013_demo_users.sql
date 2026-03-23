-- Replace single demo user with named users: Fabian, Taro, Dylan, Ethan

-- Update existing demo user to Fabian
update profiles set username = 'fabian', display_name = 'Fabian'
  where id = '00000000-0000-0000-0000-000000000200';

-- Add Taro, Dylan, and Ethan
insert into profiles (id, username, display_name, avatar_url) values
  ('00000000-0000-0000-0000-000000000201', 'taro', 'Taro', null),
  ('00000000-0000-0000-0000-000000000202', 'dylan', 'Dylan', null),
  ('00000000-0000-0000-0000-000000000203', 'ethan', 'Ethan', null)
on conflict (id) do nothing;

-- Add all users to all existing channels
insert into channel_members (channel_id, member_type, member_id)
select c.id, 'user', u.id
from channels c
cross join (
  values
    ('00000000-0000-0000-0000-000000000201'::uuid),
    ('00000000-0000-0000-0000-000000000202'::uuid),
    ('00000000-0000-0000-0000-000000000203'::uuid)
) as u(id)
on conflict (channel_id, member_type, member_id) do nothing;
