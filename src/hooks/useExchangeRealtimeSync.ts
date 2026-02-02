import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useExchangeStore } from '../stores/exchangeStore';

/**
 * Hook that manages real-time WebSocket subscriptions for connected exchanges.
 * Only active when realtimeSync setting is enabled.
 */
export function useExchangeRealtimeSync() {
  const { settings } = useSettingsStore();
  const { accounts, subscribeToUpdates } = useExchangeStore();

  // Track active subscriptions
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Cleanup function
  const cleanupSubscription = useCallback((accountId: string) => {
    const unsubscribe = subscriptionsRef.current.get(accountId);
    if (unsubscribe) {
      unsubscribe();
      subscriptionsRef.current.delete(accountId);
    }
  }, []);

  // Cleanup all subscriptions
  const cleanupAll = useCallback(() => {
    subscriptionsRef.current.forEach((unsubscribe, accountId) => {
      unsubscribe();
      subscriptionsRef.current.delete(accountId);
    });
  }, []);

  useEffect(() => {
    // If realtime sync is disabled, cleanup all subscriptions
    if (!settings.realtimeSync) {
      cleanupAll();
      return;
    }

    // Subscribe to connected exchanges that don't have active subscriptions
    const connectedAccounts = accounts.filter(a => a.isConnected);

    for (const account of connectedAccounts) {
      // Skip if already subscribed
      if (subscriptionsRef.current.has(account.id)) {
        continue;
      }

      // Subscribe and store the cleanup function
      const unsubscribe = subscribeToUpdates(account.id);
      subscriptionsRef.current.set(account.id, unsubscribe);
    }

    // Cleanup subscriptions for disconnected exchanges
    const connectedIds = new Set(connectedAccounts.map(a => a.id));
    subscriptionsRef.current.forEach((_, accountId) => {
      if (!connectedIds.has(accountId)) {
        cleanupSubscription(accountId);
      }
    });

    // Cleanup on unmount
    return () => {
      cleanupAll();
    };
  }, [
    settings.realtimeSync,
    accounts,
    subscribeToUpdates,
    cleanupSubscription,
    cleanupAll,
  ]);
}
