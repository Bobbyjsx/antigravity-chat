import { Conversation } from "./types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";
import * as ConversationActions from "./server-actions/conversation-actions";

// --- Hooks ---

export const useConversations = () => {
  return useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn: ConversationActions.listConversationsAction,
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery<Conversation>({
    queryKey: QUERY_KEYS.conversation(conversationId),
    queryFn: () => ConversationActions.getConversationAction(conversationId),
  });
};

export const useConversationMembers = (conversationId: string, enabled = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.conversationMembers(conversationId),
    queryFn: () => ConversationActions.getConversationMembersAction(conversationId),
    enabled,
  });
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ConversationActions.createConversationAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useCreateGroupConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, memberIds }: { name: string; memberIds: string[] }) =>
      ConversationActions.createGroupConversationAction(name, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useUpdateConversationName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, name }: { conversationId: string; name: string }) =>
      ConversationActions.updateConversationNameAction(conversationId, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

export const useUpdateGroupImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, file }: { conversationId: string; file: File }) => {
      const formData = new FormData();
      formData.append('conversationId', conversationId);
      formData.append('file', file);
      return ConversationActions.updateGroupImageAction(formData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ConversationActions.deleteConversationAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const usePromoteToAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      ConversationActions.promoteToAdminAction(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
    },
  });
};

export const useDemoteFromAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      ConversationActions.demoteFromAdminAction(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      ConversationActions.removeMemberAction(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
    },
  });
};

export const useLeaveConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, removeAllMembers }: { conversationId: string; removeAllMembers?: boolean }) =>
      ConversationActions.leaveConversationAction(conversationId, removeAllMembers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useAddMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, memberIds }: { conversationId: string; memberIds: string[] }) =>
      ConversationActions.addMembersAction(conversationId, memberIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
    },
  });
};

export const useUpdateConversationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, settings }: { conversationId: string; settings: any }) =>
      ConversationActions.updateConversationSettingsAction(conversationId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

export const createConversation = ConversationActions.createConversationAction;

export const createSystemMessage = ConversationActions.createSystemMessageAction;
