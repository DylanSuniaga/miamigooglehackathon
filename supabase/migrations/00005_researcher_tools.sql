-- Give @researcher the webSearch tool
update agents set tools = '["webSearch"]'::jsonb
where handle = 'researcher' and workspace_id = '00000000-0000-0000-0000-000000000001';
