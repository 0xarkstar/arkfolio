import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useWalletsStore } from '../stores/walletsStore';
import { toast } from '../components/Toast';

/**
 * Hook that syncs the connected wallet from RainbowKit to the walletsStore.
 * Automatically adds connected EVM wallets to the store (avoiding duplicates).
 * Since EVM wallets work across all chains, we only need to add the address once.
 */
export function useWalletConnectionSync() {
  const { address, isConnected } = useAccount();
  const { wallets, addWallet } = useWalletsStore();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      lastSyncedRef.current = null;
      return;
    }

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

    // Add the wallet (EVM type is auto-detected from address format)
    const label = `Connected Wallet`;
    addWallet(address, label)
      .then(() => {
        lastSyncedRef.current = addressLower;
        toast.success(`Added EVM wallet from connected account`);
      })
      .catch((error) => {
        console.error('Failed to add connected wallet:', error);
      });
  }, [address, isConnected, wallets, addWallet]);
}
