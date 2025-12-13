// Centralized query keys for React Query
// Export these to ensure consistent cache invalidation across the app

export const QUERY_KEYS = {
  // Conversations
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  conversationMembers: (id: string) => ['conversation-members', id] as const,
  
  // Messages
  messages: (conversationId: string) => ['messages', conversationId] as const,
  
  // Users
  users: (searchTerm?: string) => ['users', searchTerm] as const,
  viewer: ['viewer'] as const,
  
  // Presence
  presence: (userId?: string) => ['presence', userId] as const,
} as const;
