import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserPresence {
  user_id: string;
  last_seen: string;
  is_online: boolean;
}

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [supabase] = useState(() => createClient());

  const checkOnlineUsers = useCallback(async () => {
    // Fetch all presence records
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, last_seen, is_online');

    if (error || !data) return;

    const now = new Date();
    const online = new Set<string>();

    data.forEach((user: UserPresence) => {
      if (!user.last_seen) return;
      
      const lastSeen = new Date(user.last_seen);
      const diffInMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

      // User is online if last_seen is within 2 minutes
      if (diffInMinutes < 2) {
        online.add(user.user_id);
      }
    });

    setOnlineUsers(online);
  }, [supabase]);

  useEffect(() => {
    // Initial check
    checkOnlineUsers();

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
          // When any presence updates, re-check who is online
          checkOnlineUsers();
        }
      )
      .subscribe();

    // Also poll every 10 seconds to handle timeouts (users going offline silently)
    const interval = setInterval(checkOnlineUsers, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, checkOnlineUsers]);

  return onlineUsers;
};
