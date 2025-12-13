-- Migration: Add role-based permissions and soft delete to conversation_members
-- This enables admin features and allows members to leave without deleting records

-- Add new columns for roles and soft delete
ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('super_admin', 'admin', 'member')),
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.users(id) DEFAULT NULL;

-- Create index for querying active members (not left)
CREATE INDEX IF NOT EXISTS idx_conversation_members_active 
ON public.conversation_members(conversation_id, user_id) 
WHERE left_at IS NULL;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_conversation_members_role 
ON public.conversation_members(conversation_id, role) 
WHERE left_at IS NULL;

-- Drop the old unique constraint
ALTER TABLE public.conversation_members 
DROP CONSTRAINT IF EXISTS conversation_members_conversation_id_user_id_key;

-- Create new unique constraint that only applies to active members
-- This allows users to rejoin after leaving
CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_active_unique 
ON public.conversation_members(conversation_id, user_id) 
WHERE left_at IS NULL;

-- Add comment explaining the soft delete pattern
COMMENT ON COLUMN public.conversation_members.left_at IS 
'Timestamp when member left or was removed. NULL means active member.';

COMMENT ON COLUMN public.conversation_members.removed_by IS 
'User ID of admin who removed this member. NULL if member left voluntarily.';

COMMENT ON COLUMN public.conversation_members.role IS 
'Member role: super_admin (creator, cannot be removed), admin (can manage members), member (regular user)';
