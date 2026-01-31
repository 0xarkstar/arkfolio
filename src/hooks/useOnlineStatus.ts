import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Just came back online
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

// Check if a specific URL is reachable
export function useNetworkCheck(url: string = 'https://api.coingecko.com/api/v3/ping', interval: number = 30000) {
  const [isReachable, setIsReachable] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkNetwork = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsReachable(true);
    } catch {
      setIsReachable(false);
    }
    setLastCheck(new Date());
  }, [url]);

  useEffect(() => {
    checkNetwork();
    const intervalId = setInterval(checkNetwork, interval);
    return () => clearInterval(intervalId);
  }, [checkNetwork, interval]);

  return { isReachable, lastCheck, checkNetwork };
}
