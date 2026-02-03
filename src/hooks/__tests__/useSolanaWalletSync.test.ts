import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSolanaWalletSync } from '../useSolanaWalletSync';

// Mock @solana/wallet-adapter-react
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}));

// Mock the stores
vi.mock('../../stores/walletsStore', () => ({
  useWalletsStore: vi.fn(),
}));

vi.mock('../../components/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';

describe('useSolanaWalletSync', () => {
  let mockAddWallet: ReturnType<typeof vi.fn>;
  let mockPublicKey: { toBase58: () => string };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddWallet = vi.fn().mockResolvedValue(undefined);
    mockPublicKey = {
      toBase58: () => 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    };

    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      connected: false,
      wallet: null,
    } as unknown as ReturnType<typeof useWallet>);

    vi.mocked(useWalletsStore).mockReturnValue({
      wallets: [],
      addWallet: mockAddWallet,
    } as unknown as ReturnType<typeof useWalletsStore>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when not connected', () => {
    it('should not add wallet when not connected', () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: false,
        wallet: null,
      } as unknown as ReturnType<typeof useWallet>);

      renderHook(() => useSolanaWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not add wallet when publicKey is null', () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: true,
        wallet: null,
      } as unknown as ReturnType<typeof useWallet>);

      renderHook(() => useSolanaWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });
  });

  describe('when connected', () => {
    it('should add wallet when connected with new address', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledWith(
          'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
          'Phantom (Solana)'
        );
      });
    });

    it('should show success toast after adding wallet', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Added Solana wallet from Phantom');
      });
    });

    it('should use default wallet name when adapter name is not available', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: null,
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledWith(
          'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
          'Solana Wallet (Solana)'
        );
      });
    });

    it('should not add wallet that already exists in store', () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: 'hn7cabqlq46es1jh92dqqisaq662smxelllshhE4ywrh',
            chain: 'solana',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSolanaWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should compare addresses case-insensitively', () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: 'HN7CABQLQ46ES1JH92DQQISAQ662SMXELLLSHHE4YWRH',
            chain: 'solana',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSolanaWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not re-sync same address in same session', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      rerender();

      // Should still be 1 because we track synced addresses
      expect(mockAddWallet).toHaveBeenCalledTimes(1);
    });

    it('should reset tracking when disconnected', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      // Disconnect
      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: false,
        wallet: null,
      } as unknown as ReturnType<typeof useWallet>);

      rerender();

      // Reconnect with same address
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      rerender();

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle addWallet errors gracefully', async () => {
      vi.mocked(useWallet).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
        wallet: {
          adapter: {
            name: 'Phantom',
          },
        },
      } as unknown as ReturnType<typeof useWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet.mockRejectedValue(new Error('Database error')),
      } as unknown as ReturnType<typeof useWalletsStore>);

      // Should not throw
      renderHook(() => useSolanaWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalled();
      });

      // No toast should be shown on error
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
