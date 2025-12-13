import { createClient } from "@/lib/supabase/client";
import { Message } from "./types";

export const listMessages = async (conversationId: string): Promise<Message[]> => {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  
  return data as Message[];
};

export const sendMessage = async (conversationId: string, content: string, type: "text" | "image" = "text"): Promise<Message> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type
    })
    .select()
    .single();

  if (error) throw error;

  return data as Message;
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";

export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.messages(conversationId),
    queryFn: () => listMessages(conversationId),
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, content, type }: { conversationId: string; content: string; type: string }) => {
      return sendMessage(conversationId, content, type as "text" | "image");
    },
    onMutate: async ({ conversationId, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.messages(conversationId) });
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(QUERY_KEYS.messages(conversationId));
      
      // Optimistically update
      queryClient.setQueryData(QUERY_KEYS.messages(conversationId), (old: any) => {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          content,
          created_at: new Date().toISOString(),
          sender_id: 'current-user',
          conversation_id: conversationId,
          type: 'text',
          _isOptimistic: true,
        };
        return old ? [...old, optimisticMessage] : [optimisticMessage];
      });
      
      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          QUERY_KEYS.messages(variables.conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: (data, variables) => {
      // Refetch to get the real message from server
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};
