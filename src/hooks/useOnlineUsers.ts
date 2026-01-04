import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGetOnlineUsers } from '@/api/users';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/api/queryKeys';

interface UserPresence {
  user_id: string;
  last_seen: string;
  is_online: boolean;
}

export const useOnlineUsers = () => {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: onlineUsers } = useGetOnlineUsers({
    refetchInterval: 10000, // Poll every 10 seconds as a fallback/cleanup
    select: (data: UserPresence[]) => {
      if (!data) return new Set<string>();
      
      const now = new Date();
      const online = new Set<string>();

      data.forEach((user) => {
        if (!user.last_seen) return;
        
        const lastSeen = new Date(user.last_seen);
        const diffInMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

        // User is online if last_seen is within 2 minutes
        if (diffInMinutes < 2) {
          online.add(user.user_id);
        }
      });
      
      return online;
    }
  });

  useEffect(() => {
    // Subscribe to changes
    const channel = supabase
      .channel('db-presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          // When any presence updates, invalidate the query to refetch fresh data
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.onlineUsers });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  // Return empty set if loading or undefined
  return onlineUsers ?? new Set<string>();
};
