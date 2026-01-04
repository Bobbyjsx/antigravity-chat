'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { QUERY_KEYS } from '@/api/queryKeys'
import { markMessageAsDeliveredAction } from '@/api/server-actions/message-actions'

/**
 * Hook to subscribe to realtime conversation updates
 * Listens for when user is added to conversations or conversation details change
 */
export function useRealtimeConversations(userId?: string) {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const markAsDelivered = useCallback(async (messageId: string) => {
    try {
      await markMessageAsDeliveredAction(messageId)
    } catch (error) {
      console.error('Error marking as delivered:', error)
    }
  }, [])
  
  useEffect(() => {
    if (!userId) return

    // Subscribe to conversation_members changes for this user
    const memberChannel = supabase
      .channel(`user-conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // User was added to a new conversation
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // User was removed from a conversation
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations })
        }
      )
      .subscribe()

    // Subscribe to conversation updates (name changes, etc.)
    const conversationChannel = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations })
        }
      )
      .subscribe()

    // Subscribe to new messages to update conversation list (last message)
    const messageChannel = supabase
      .channel('message-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // New message received, update conversation list to show last message
          const newMessage = payload.new as any; // Type assertion as payload.new is generic
          
          // If message is not from current user, mark as delivered
          if (newMessage.sender_id !== userId) {
            await markAsDelivered(newMessage.id);
          }
          
          queryClient.setQueryData(QUERY_KEYS.conversations, (oldConversations: any) => {
            if (!oldConversations) return oldConversations;
            
            return oldConversations.map((conv: any) => {
              if (conv.id === newMessage.conversation_id) {
                return {
                  ...conv,
                  last_message: newMessage,
                  last_message_time: newMessage.created_at,
                };
              }
              return conv;
            }).sort((a: any, b: any) => 
              new Date(b.last_message_time || b.updated_at).getTime() - 
              new Date(a.last_message_time || a.updated_at).getTime()
            );
          });

          // queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(memberChannel)
      supabase.removeChannel(conversationChannel)
      supabase.removeChannel(messageChannel)
    }
  }, [userId, supabase, queryClient])
}
