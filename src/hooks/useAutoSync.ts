import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useExchangeStore } from '../stores/exchangeStore';
import { useWalletsStore } from '../stores/walletsStore';
import { toast } from '../components/Toast';

/**
 * Hook to automatically sync exchanges and wallets based on settings
 */
export function useAutoSync() {
  const { settings } = useSettingsStore();
  const { accounts, syncAllExchanges } = useExchangeStore();
  const { wallets, syncAllWallets } = useWalletsStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<Date | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't set up auto-sync if disabled
    if (!settings.autoSync) {
      return;
    }

    const connectedExchanges = accounts.filter(a => a.isConnected);
    const hasDataToSync = connectedExchanges.length > 0 || wallets.length > 0;

    if (!hasDataToSync) {
      return;
    }

    const syncIntervalMs = settings.syncInterval * 60 * 1000;

    const performSync = async () => {
      // Avoid syncing too frequently
      if (lastSyncRef.current) {
        const timeSinceLastSync = Date.now() - lastSyncRef.current.getTime();
        if (timeSinceLastSync < 30000) { // Minimum 30 seconds between syncs
          return;
        }
      }

      lastSyncRef.current = new Date();

      try {
        // Sync exchanges in parallel with wallets
        const promises: Promise<void>[] = [];

        if (connectedExchanges.length > 0) {
          promises.push(syncAllExchanges());
        }

        if (wallets.length > 0) {
          promises.push(syncAllWallets());
        }

        const results = await Promise.allSettled(promises);
        const hasErrors = results.some(r => r.status === 'rejected');

        if (hasErrors) {
          toast.warning('Some data failed to sync');
        }
      } catch (error) {
        console.error('Auto-sync failed:', error);
        toast.error('Auto-sync failed');
      }
    };

    // Set up interval
    intervalRef.current = setInterval(performSync, syncIntervalMs);

    // Perform initial sync after a short delay (to let the app initialize)
    const initialSyncTimeout = setTimeout(performSync, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearTimeout(initialSyncTimeout);
    };
  }, [
    settings.autoSync,
    settings.syncInterval,
    accounts,
    wallets.length,
    syncAllExchanges,
    syncAllWallets,
  ]);
}
