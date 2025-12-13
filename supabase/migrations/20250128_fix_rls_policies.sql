-- Migration: Fix RLS policies for admin features
-- This replaces previous restrictive policies to allow for system messages, role updates, and soft deletes

-- Helper function to check membership without recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id UUID, _must_be_active BOOLEAN DEFAULT false)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = _conversation_id
    AND user_id = auth.uid()
    AND (_must_be_active = false OR left_at IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    -- Check if user is an active member using the helper function
    public.is_conversation_member(conversation_id, true)
    AND (
      -- Regular message: sender must be current user
      (is_system = FALSE AND sender_id = auth.uid())
      OR
      -- System message: sender is NULL, but user must be a member (checked above)
      (is_system = TRUE AND sender_id IS NULL)
    )
  );

-- 2. CONVERSATIONS POLICIES
-- Allow updates (renaming, image) by active members
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;

CREATE POLICY "Members can update conversations" ON public.conversations
  FOR UPDATE USING (
    public.is_conversation_member(id, true)
  );

-- 3. CONVERSATION MEMBERS POLICIES
-- Drop old policies that might conflict
DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow authenticated users to insert members" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow users to leave conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can add new members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave (update own status)" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow viewing all conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;


-- INSERT: Allow adding members
CREATE POLICY "Members can add new members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    -- User must be an active member of the conversation
    public.is_conversation_member(conversation_id, true)
    OR
    -- OR creating a new conversation (user adds themselves)
    (
      NOT EXISTS (
        SELECT 1 FROM public.conversation_members existing_cm
        WHERE existing_cm.conversation_id = conversation_members.conversation_id
      )
    )
  );

-- UPDATE: Allow admins to update roles/remove members
CREATE POLICY "Admins can manage members" ON public.conversation_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'super_admin')
      AND cm.left_at IS NULL
    )
  );

-- UPDATE: Allow users to leave (update own status)
CREATE POLICY "Users can leave (update own status)" ON public.conversation_members
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- SELECT: Members can view other members
CREATE POLICY "Members can view conversation members" ON public.conversation_members
  FOR SELECT USING (
    -- Use security definer function to avoid infinite recursion
    public.is_conversation_member(conversation_id, false)
  );
