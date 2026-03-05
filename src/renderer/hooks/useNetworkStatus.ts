import { useState, useEffect } from 'react';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen to main process network events
    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.network) {
      cleanup = window.electronAPI.network.onStatusChange((status) => setIsOnline(status));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup?.();
    };
  }, []);

  return isOnline;
}
