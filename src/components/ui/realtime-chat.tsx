"use client";

import { useChatScroll } from '@/hooks/use-chat-scroll'
import { ChatMessage, useRealtimeChat } from '@/hooks/use-realtime-chat'
import { cn } from '@/lib/utils'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatMessageItem } from '@components/ui/chat-message'
import { Message } from '@/api/types'
import { SystemMessage } from '../modules/Chat/MessageList/SystemMessage'

interface RealtimeChatProps {
  conversationId: string
  userId: string
  username: string
  initialMessages?: Message[]
  isGroup?: boolean
  members?: Record<string, { name: string; image?: string }>
  hasLeft?: boolean
}

/**
 * Realtime chat component integrated with Supabase database
 * @param conversationId - The conversation ID
 * @param userId - Current user's ID
 * @param username - Current user's name
 * @param initialMessages - Messages from database
 * @param isGroup - Whether this is a group chat
 * @param members - Map of user IDs to user details
 * @param hasLeft - Whether the current user has left the conversation
 */
export const RealtimeChat = ({
  conversationId,
  userId,
  username,
  initialMessages = [],
  isGroup = false,
  members = {},
  hasLeft = false,
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom } = useChatScroll()

  const {
    messages: realtimeMessages,
    sendMessage,
    isConnected,
    markAsSeen,
  } = useRealtimeChat({
    conversationId,
    userId,
  })
  const [newMessage, setNewMessage] = useState('')

  // Convert initial messages to ChatMessage format
  const formattedInitialMessages: ChatMessage[] = useMemo(() => {
    return initialMessages.map((msg) => {
      const senderName = msg.sender_id === userId 
        ? username 
        : (msg.sender_id ? members[msg.sender_id]?.name : 'System') || 'Unknown User';
        
      return {
        id: msg.id,
        content: msg.content,
        user: {
          id: msg.sender_id || 'system',
          name: senderName,
        },
        createdAt: msg.created_at,
        sender_id: msg.sender_id,
        delivered_at: msg.delivered_at,
        seen_at: msg.seen_at,
        is_system: msg.is_system,
        system_event_type: msg.system_event_type,
        system_event_data: msg.system_event_data,
      }
    })
  }, [initialMessages, username, userId, members])

  // Merge realtime messages with initial messages
  const allMessages = useMemo(() => {
    const mergedMessages = [...formattedInitialMessages, ...realtimeMessages]
    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )
    // Sort by creation date
    const sortedMessages = uniqueMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Filter out optimistic messages that have a corresponding real message
    return sortedMessages.filter(msg => {
      // Always keep real messages
      if (!msg.isOptimistic) return true;
      
      // For optimistic messages, check if a matching real message exists
      const hasReal = sortedMessages.some(m => 
        !m.isOptimistic && 
        m.sender_id === msg.sender_id && 
        m.content === msg.content
      );
      
      // Only show optimistic message if real one hasn't arrived yet
      return !hasReal;
    });
  }, [formattedInitialMessages, realtimeMessages])


  // Mark messages as seen when chat is opened/visible
  useEffect(() => {
    // Mark all unread messages as seen when this chat is opened
    allMessages.forEach(msg => {
      if (msg.sender_id !== userId && !msg.seen_at) {
        markAsSeen(msg.id)
      }
    })
  }, [conversationId, userId, markAsSeen]) // Only run when conversation changes

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom()
  }, [allMessages, scrollToBottom])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected || hasLeft) return

      try {
        await sendMessage(newMessage)
        setNewMessage('')
      } catch (error) {
        console.error('Failed to send message:', error)
      }
    },
    [newMessage, isConnected, sendMessage, hasLeft]
  )

  return (
    <div className="flex flex-col h-[95dvh] w-full bg-gray-900 text-white antialiased">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {allMessages.length === 0 ? (
          <div className="text-center text-sm text-gray-400">
            No messages yet. Start the conversation!
          </div>
        ) : null}
        <div className="space-y-1">
          {allMessages.map((message, index) => {
            if (message.is_system) {
              return (
                <div key={message.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <SystemMessage message={message as any} />
                </div>
              )
            }

            const prevMessage = index > 0 ? allMessages[index - 1] : null
            const showHeader = !!isGroup && (!prevMessage || prevMessage.sender_id !== message.sender_id || prevMessage.is_system)

            return (
              <div
                key={message.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              >
                <ChatMessageItem
                  message={message}
                  isOwnMessage={message.sender_id === userId}
                  showHeader={showHeader || false}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Input */}
      {hasLeft ? (
        <div className="p-4 bg-gray-900 border-t border-gray-800 text-center text-gray-400 text-sm">
          You have left this group. You cannot send messages.
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex w-full gap-2 border-t border-gray-800 p-4 bg-gray-900 justify-between items-center">
          <Input
            className={cn(
              'rounded-full bg-gray-800 text-white text-sm transition-all duration-300 border-gray-700',
              isConnected && newMessage.trim() ? 'w-[calc(100%-12px)]' : 'w-full'
            )}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!isConnected}
          />
          {isConnected && newMessage.trim() && (
            <Button
              className="aspect-square rounded-full !bg-blue-600 hover:bg-blue-700 animate-in fade-in slide-in-from-right-4 duration-300"
              type="submit"
              disabled={!isConnected}
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
      )}
    </div>
  )
}
