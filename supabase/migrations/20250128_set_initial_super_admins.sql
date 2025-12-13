-- Migration: Set initial super admins for existing groups
-- The first member to join each group conversation becomes the super admin
-- Uses ROW_NUMBER to ensure exactly one super admin per group even if joined_at timestamps match

WITH ranked_members AS (
  SELECT 
    conversation_id, 
    user_id,
    ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY joined_at ASC, user_id ASC) as rn
  FROM public.conversation_members
  WHERE left_at IS NULL
)
UPDATE public.conversation_members cm
SET role = 'super_admin'
FROM ranked_members rm, public.conversations c
WHERE cm.conversation_id = rm.conversation_id
  AND cm.user_id = rm.user_id
  AND cm.conversation_id = c.id
  AND c.is_group = TRUE
  AND rm.rn = 1;

-- Add a comment
COMMENT ON TABLE public.conversation_members IS 
'Junction table for conversation membership. Each group has one super_admin (creator) who cannot be removed.';
