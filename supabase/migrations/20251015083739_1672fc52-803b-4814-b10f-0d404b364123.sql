-- Update email for admin user in auth.users
UPDATE auth.users 
SET email = 'iicbooking@iitr.ac.in',
    raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email}', '"iicbooking@iitr.ac.in"')
WHERE id = '7f21183b-f7c1-486b-ba04-37bfe2d575c5';

-- Update email in profiles table
UPDATE public.profiles 
SET email = 'iicbooking@iitr.ac.in'
WHERE id = '7f21183b-f7c1-486b-ba04-37bfe2d575c5';