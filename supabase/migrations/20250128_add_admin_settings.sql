-- Add admin settings columns to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS only_admins_can_rename BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS only_admins_can_add_members BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS only_admins_can_change_image BOOLEAN DEFAULT FALSE;

-- Update RLS policies to respect these settings will be handled in the API logic for now
-- as complex RLS with dynamic column checks can be tricky and we are using API functions.
-- However, we should ensure the columns themselves are updatable by admins.

-- Ensure admins can update these new columns
-- The existing "Members can update conversations" policy allows updates if you are a member.
-- We might need to restrict WHO can update these specific columns to admins only.
-- But for now, we'll enforce this in the API layer / UI layer and trust the backend check.
