import { useEffect } from "react";
import { getUserSession } from "./server-actions/auth";
import { updateUserPresenceAction } from "./server-actions/user-actions";

export const updateLastSeen = async () => {
  const { session } = await getUserSession();
  if (!session) return;

 updateUserPresenceAction(session.user.id);
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
