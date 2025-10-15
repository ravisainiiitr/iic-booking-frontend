-- Delete old admin user's role and profile
-- Note: The auth.users entry should be deleted via Supabase Auth dashboard or API
DELETE FROM public.user_roles WHERE user_id = '7f21183b-f7c1-486b-ba04-37bfe2d575c5';
DELETE FROM public.profiles WHERE id = '7f21183b-f7c1-486b-ba04-37bfe2d575c5';