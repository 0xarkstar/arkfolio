import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
        transition-all duration-300
        ${
          isOnline
            ? 'bg-profit/90 text-white'
            : 'bg-warning/90 text-surface-900'
        }
      `}
    >
      {isOnline ? (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>Back online</span>
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 4.243a1 1 0 11-1.414-1.414"
            />
          </svg>
          <span>You are offline. Some features may be unavailable.</span>
        </>
      )}
    </div>
  );
}

// Smaller inline indicator for use in headers etc.
export function OfflineStatusDot() {
  const { isOnline } = useOnlineStatus();

  return (
    <div
      className={`
        w-2 h-2 rounded-full
        ${isOnline ? 'bg-profit' : 'bg-warning animate-pulse'}
      `}
      title={isOnline ? 'Online' : 'Offline'}
      aria-label={isOnline ? 'Connected to internet' : 'No internet connection'}
    />
  );
}
