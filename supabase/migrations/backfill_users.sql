-- Manual script to populate users table from existing auth.users
-- Run this in Supabase SQL Editor if the trigger didn't work for existing users

INSERT INTO public.users (id, email, name, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email) as name,
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
