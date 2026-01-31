import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletsStore } from '../stores/walletsStore';
import { toast } from '../components/Toast';

/**
 * Hook that syncs the connected Solana wallet to the walletsStore.
 * Automatically adds connected Solana wallets to the store (avoiding duplicates).
 */
export function useSolanaWalletSync() {
  const { publicKey, connected, wallet } = useWallet();
  const { wallets, addWallet } = useWalletsStore();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      lastSyncedRef.current = null;
      return;
    }

    const address = publicKey.toBase58();
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
    const walletName = wallet?.adapter?.name || 'Solana Wallet';
    const label = `${walletName} (Solana)`;

    addWallet(address, label)
      .then(() => {
        lastSyncedRef.current = addressLower;
        toast.success(`Added Solana wallet from ${walletName}`);
      })
      .catch((error) => {
        console.error('Failed to add connected Solana wallet:', error);
      });
  }, [publicKey, connected, wallet, wallets, addWallet]);
}
