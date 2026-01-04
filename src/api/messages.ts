import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";
import { listMessagesAction, sendMessageAction, uploadMessageImageAction } from "./server-actions/message-actions";

export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.messages(conversationId),
    queryFn: () => listMessagesAction(conversationId),
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, content, type, file }: { conversationId: string; content?: string; type: "text" | "image"; file?: File }) => {
      let finalContent = content;

      if (type === 'image' && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', conversationId);
        
        finalContent = await uploadMessageImageAction(formData);
      }

      if (!finalContent) throw new Error("Message content is missing");

      return sendMessageAction(conversationId, finalContent, type);
    },
    onMutate: async ({ conversationId, content, type, file }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.messages(conversationId) });
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(QUERY_KEYS.messages(conversationId));
      
      // Optimistically update
      queryClient.setQueryData(QUERY_KEYS.messages(conversationId), (old: any) => {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          content: type === 'image' && file ? URL.createObjectURL(file) : content,
          created_at: new Date().toISOString(),
          sender_id: 'current-user', // Note: Ideally current user ID should be fetched or stored in context if needed for perfect optimistic UI, but 'current-user' might work if UI handles it or we assume it's right.
          conversation_id: conversationId,
          type: type,
          _isOptimistic: true,
        };
        return old ? [...old, optimisticMessage] : [optimisticMessage];
      });
      
      return { previousMessages };
    },
    onError: (_, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          QUERY_KEYS.messages(variables.conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: (_, variables) => {
      // Refetch to get the real message from server
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

