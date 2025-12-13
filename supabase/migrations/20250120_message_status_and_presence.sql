-- Add message status tracking columns
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

-- Create user_presence table for tracking online users
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_presence
CREATE POLICY "Anyone can view user presence" ON public.user_presence
  FOR SELECT USING (true);

CREATE POLICY "Users can update own presence" ON public.user_presence
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own presence" ON public.user_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Add last_message_id to conversations for quick reference
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create index for message status queries
CREATE INDEX IF NOT EXISTS idx_messages_delivered_at ON public.messages(delivered_at);
CREATE INDEX IF NOT EXISTS idx_messages_seen_at ON public.messages(seen_at);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON public.user_presence(is_online, last_seen);

-- Function to update conversation's last_message_id
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_id = NEW.id,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_message_id when new message is inserted
DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();
