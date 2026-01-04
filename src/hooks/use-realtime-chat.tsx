'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { Message } from '@/api/types'
import { getUserByIdAction } from '@/api/server-actions/user-actions'
import { markMessageAsDeliveredAction, markMessageAsSeenAction, sendMessageAction } from '@/api/server-actions/message-actions'

interface UseRealtimeChatProps {
  conversationId: string
  userId: string
}

export interface ChatMessage {
  id: string
  content: string
  user: {
    id: string
    name: string
  }
  createdAt: string
  sender_id?: string | null
  delivered_at?: string | null
  seen_at?: string | null
  isOptimistic?: boolean
  is_system?: boolean
  system_event_type?: import('@/api/types').SystemEventType | null
  system_event_data?: Record<string, any> | null
}

export function useRealtimeChat({ conversationId, userId }: UseRealtimeChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [isConnected, setIsConnected] = useState(false)

  const markAsDelivered = useCallback(async (messageId: string) => {
    try {
      await markMessageAsDeliveredAction(messageId)
    } catch (error) {
      console.error('Error marking as delivered:', error)
    }
  }, [])

  const markAsSeen = useCallback(async (messageId: string) => {
    try {
      await markMessageAsSeenAction(messageId)
    } catch (error) {
      console.error('Error marking as seen:', error)
    }
  }, [])

  useEffect(() => {
    // Subscribe to new messages in this conversation
    const newChannel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message
          
          // If message is not from us, mark as delivered
          if (newMessage.sender_id && newMessage.sender_id !== userId) {
            markAsDelivered(newMessage.id)
          }

          // Fetch sender info if not system message
          let sender = null;
          if (newMessage.sender_id) {
            const { user } = await getUserByIdAction(newMessage.sender_id);
            sender = user;
          };

          const chatMessage: ChatMessage = {
            id: newMessage.id,
            content: newMessage.content,
            user: {
              id: newMessage.sender_id || 'system',
              name: sender?.name || sender?.email || 'System',
            },
            createdAt: newMessage.created_at,
            sender_id: newMessage.sender_id,
            delivered_at: newMessage.delivered_at,
            seen_at: newMessage.seen_at,
            is_system: newMessage.is_system,
            system_event_type: newMessage.system_event_type,
            system_event_data: newMessage.system_event_data,
          }

          setMessages((current) => {
            // Find the oldest optimistic message that matches the new message content
            // We don't strictly need to check sender_id as isOptimistic implies it was sent by us
            const matchIndex = current.findIndex(m => 
              m.isOptimistic && 
              m.content.trim() === chatMessage.content.trim()
            )

            let newMessages = [...current]
            
            if (matchIndex !== -1) {
              // Remove the matched optimistic message
              newMessages.splice(matchIndex, 1)
            }
            
            // Add the real message (checking for ID dupes first)
            if (newMessages.find(m => m.id === chatMessage.id)) {
              return newMessages
            }
            
            return [...newMessages, chatMessage]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message
          setMessages((current) => 
            current.map(msg => 
              msg.id === updatedMessage.id 
                ? { 
                    ...msg, 
                    delivered_at: updatedMessage.delivered_at, 
                    seen_at: updatedMessage.seen_at 
                  } 
                : msg
            )
          )
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      })

    // setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [conversationId, supabase, userId, markAsDelivered])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!isConnected) return

      // Optimistic update
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        user: {
          id: userId,
          name: 'Me', // Placeholder, UI should handle "Me" or fetch user name
        },
        createdAt: new Date().toISOString(),
        sender_id: userId,
        isOptimistic: true,
      }

      setMessages((current) => [...current, optimisticMessage])

      try {
        await sendMessageAction(conversationId, content);
      } catch (error) {
        console.error('Error sending message:', error)
        // Revert optimistic update on error
        setMessages((current) => current.filter(m => m.id !== optimisticMessage.id))
        throw error
      }
    },
    [conversationId, userId, isConnected]
  )

  return { messages, sendMessage, isConnected, markAsSeen }
}
