import { useEffect, useRef } from 'react';
import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit';
import { useWalletsStore } from '../stores/walletsStore';
import { toast } from '../components/Toast';

/**
 * Hook that syncs the connected SUI wallet to the walletsStore.
 * Automatically adds connected SUI wallets to the store (avoiding duplicates).
 */
export function useSuiWalletSync() {
  const currentAccount = useCurrentAccount();
  const { currentWallet, connectionStatus } = useCurrentWallet();
  const { wallets, addWallet } = useWalletsStore();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (connectionStatus !== 'connected' || !currentAccount?.address) {
      lastSyncedRef.current = null;
      return;
    }

    const address = currentAccount.address;
    const addressLower = address.toLowerCase();

    // Skip if we already synced this address in this session
    if (lastSyncedRef.current === addressLower) {
      return;
    }

    // Check if wallet already exists in the store
    const exists = wallets.some(
      (w) => w.address.toLowerCase() === addressLower
    );

    if (exists) {
      // Already tracked, just mark as synced
      lastSyncedRef.current = addressLower;
      return;
    }

    // Add the wallet
    const walletName = currentWallet?.name || 'SUI Wallet';
    const label = `${walletName} (SUI)`;

    addWallet(address, label)
      .then(() => {
        lastSyncedRef.current = addressLower;
        toast.success(`Added SUI wallet from ${walletName}`);
      })
      .catch((error) => {
        console.error('Failed to add connected SUI wallet:', error);
      });
  }, [currentAccount, connectionStatus, currentWallet, wallets, addWallet]);
}
