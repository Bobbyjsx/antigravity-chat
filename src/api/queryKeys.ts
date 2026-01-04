// Centralized query keys for React Query
// Export these to ensure consistent cache invalidation across the app

export const QUERY_KEYS = {
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  conversationMembers: (id: string) => ['conversation-members', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  users: (searchTerm?: string) => ['users', searchTerm] as const,
  viewer: ['viewer'] as const,
  presence: (userId?: string) => ['presence', userId] as const,
  onlineUsers: ['online-users'] as const,
} as const;
