-- Migration: Add system message support
-- Enables automated messages for group events (member added/removed, name changed, etc.)

-- Add system message columns to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS system_event_type TEXT CHECK (
  system_event_type IS NULL OR 
  system_event_type IN (
    'member_added',
    'member_removed', 
    'member_left',
    'admin_promoted',
    'admin_demoted',
    'name_changed',
    'image_changed',
    'group_created'
  )
),
ADD COLUMN IF NOT EXISTS system_event_data JSONB DEFAULT NULL;

-- Allow null sender_id for system messages (they don't have a sender)
ALTER TABLE public.messages 
ALTER COLUMN sender_id DROP NOT NULL;

-- Add constraint to ensure system messages are valid
-- Add constraint to ensure system messages are valid
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_message_check') THEN 
    ALTER TABLE public.messages 
    ADD CONSTRAINT system_message_check 
    CHECK (
      (is_system = FALSE AND sender_id IS NOT NULL) OR
      (is_system = TRUE AND sender_id IS NULL AND system_event_type IS NOT NULL)
    );
  END IF; 
END $$;

-- Create index for querying system messages
CREATE INDEX IF NOT EXISTS idx_messages_system 
ON public.messages(conversation_id, is_system, created_at DESC);

-- Add comments
COMMENT ON COLUMN public.messages.is_system IS 
'True if this is an automated system message (e.g., "User joined group")';

COMMENT ON COLUMN public.messages.system_event_type IS 
'Type of system event that triggered this message';

COMMENT ON COLUMN public.messages.system_event_data IS 
'JSON data about the system event (e.g., user IDs, old/new values)';
