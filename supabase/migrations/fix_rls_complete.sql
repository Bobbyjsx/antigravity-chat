-- Complete RLS policy fix for conversations and conversation_members
-- Run this entire script in Supabase SQL Editor

-- First, drop ALL existing policies on both tables to start fresh
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow viewing conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow inserting conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can delete their own membership" ON public.conversation_members;

-- Create new policies for conversations
-- Allow viewing conversations where user is a member
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id 
      FROM public.conversation_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow ANY authenticated user to create conversations
CREATE POLICY "Allow authenticated users to create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create new policies for conversation_members
-- Allow viewing all conversation members (no recursion)
CREATE POLICY "Allow viewing all conversation members" ON public.conversation_members
  FOR SELECT USING (true);

-- Allow authenticated users to insert members
CREATE POLICY "Allow authenticated users to insert members" ON public.conversation_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to delete their own membership
CREATE POLICY "Allow users to leave conversations" ON public.conversation_members
  FOR DELETE USING (user_id = auth.uid());
