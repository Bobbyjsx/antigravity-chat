import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export const updateLastSeen = async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  // We only update last_seen, we don't manually toggle is_online anymore
  // because we use Realtime Presence for UI.
  // This DB record is purely for the Edge Function to know if we are "recently active".
  await supabase
    .from('user_presence')
    .upsert({
      user_id: user.id,
      last_seen: new Date().toISOString(),
      // We can set is_online to true here just as a fallback, 
      // but we won't set it to false on unmount.
      is_online: true, 
    });
};

export const usePresenceHeartbeat = () => {
  useEffect(() => {
    // Initial update
    updateLastSeen();

    // Heartbeat every minute
    const interval = setInterval(() => {
      updateLastSeen();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);
};
