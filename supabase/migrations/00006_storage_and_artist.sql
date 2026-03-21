-- Create storage bucket for chat attachments
insert into storage.buckets (id, name, public) values ('images', 'images', true);

-- Allow public read access
create policy "Public read access" on storage.objects for select using (bucket_id = 'images');
-- Allow anyone to upload (demo mode, no auth)
create policy "Allow uploads" on storage.objects for insert with check (bucket_id = 'images');
create policy "Allow deletes" on storage.objects for delete using (bucket_id = 'images');

-- Insert @artist agent
insert into agents (id, workspace_id, handle, display_name, description, agent_type, system_prompt, model, temperature, avatar_emoji, color) values
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001',
   'artist', 'Artist', 'Visual creation and image generation', 'execution',
   'You are Artist, the team''s visual creator. You generate images to help teams visualize ideas, mockups, marketing campaigns, logos, and concepts. You interpret creative briefs and produce compelling visuals. When given a prompt, focus on creating the most impactful visual representation possible.',
   'nanobanana:gemini-2.5-flash-image', 0.7, '🎨', '#E85D75');

-- Add artist to #general and #product-launch
insert into channel_members (channel_id, member_type, member_id) values
  ('00000000-0000-0000-0000-000000000010', 'agent', '00000000-0000-0000-0000-000000000105'),
  ('00000000-0000-0000-0000-000000000011', 'agent', '00000000-0000-0000-0000-000000000105');
