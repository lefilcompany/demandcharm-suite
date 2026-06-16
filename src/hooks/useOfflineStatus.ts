import { useState, useEffect } from 'react';
import { onOnlineStatusChange } from '@/lib/offlineStorage';

export function useOfflineStatus() {
  // Start with true (assume online) to avoid flash of offline indicator
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = onOnlineStatusChange(setOnline);
    return unsubscribe;
  }, []);

  return { isOnline: online, isOffline: !online };
}
