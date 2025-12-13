import { useEffect } from 'react';
import { updateLastSeen } from '@/api/presence';
import { useViewer } from '@/api/users';

export const usePresence = () => {
  const { data: user } = useViewer();

  useEffect(() => {
    if (!user) return;

    // Initial update
    updateLastSeen();

    // Heartbeat every minute
    const interval = setInterval(() => {
      updateLastSeen();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [user]);
};
