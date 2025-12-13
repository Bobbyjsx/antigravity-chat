-- Create calls table for WebRTC signaling
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    initiator_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'rejected')),
    sdp_offer JSONB,
    sdp_answer JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view calls they are involved in"
    ON public.calls FOR SELECT
    USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert calls they initiate"
    ON public.calls FOR INSERT
    WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update calls they are involved in"
    ON public.calls FOR UPDATE
    USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_initiator ON public.calls(initiator_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
