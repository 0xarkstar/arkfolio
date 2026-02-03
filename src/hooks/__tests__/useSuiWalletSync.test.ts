import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSuiWalletSync } from '../useSuiWalletSync';

// Mock @mysten/dapp-kit
vi.mock('@mysten/dapp-kit', () => ({
  useCurrentAccount: vi.fn(),
  useCurrentWallet: vi.fn(),
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

import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';

describe('useSuiWalletSync', () => {
  let mockAddWallet: ReturnType<typeof vi.fn>;
  const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f00000';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddWallet = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useCurrentAccount).mockReturnValue(null);

    vi.mocked(useCurrentWallet).mockReturnValue({
      currentWallet: null,
      connectionStatus: 'disconnected',
    } as unknown as ReturnType<typeof useCurrentWallet>);

    vi.mocked(useWalletsStore).mockReturnValue({
      wallets: [],
      addWallet: mockAddWallet,
    } as unknown as ReturnType<typeof useWalletsStore>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when not connected', () => {
    it('should not add wallet when connection status is disconnected', () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: null,
        connectionStatus: 'disconnected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      renderHook(() => useSuiWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not add wallet when account address is undefined', () => {
      vi.mocked(useCurrentAccount).mockReturnValue(null);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      renderHook(() => useSuiWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not add wallet when connecting', () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connecting',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      renderHook(() => useSuiWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });
  });

  describe('when connected', () => {
    it('should add wallet when connected with new address', async () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledWith(mockAddress, 'Sui Wallet (SUI)');
      });
    });

    it('should show success toast after adding wallet', async () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Added SUI wallet from Sui Wallet');
      });
    });

    it('should use default wallet name when currentWallet is null', async () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: null,
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledWith(mockAddress, 'SUI Wallet (SUI)');
      });
    });

    it('should not add wallet that already exists in store', () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: mockAddress.toLowerCase(),
            chain: 'sui',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSuiWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should compare addresses case-insensitively', () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: mockAddress.toUpperCase(),
            chain: 'sui',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useSuiWalletSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not re-sync same address in same session', async () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      rerender();

      // Should still be 1 because we track synced addresses
      expect(mockAddWallet).toHaveBeenCalledTimes(1);
    });

    it('should reset tracking when disconnected', async () => {
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      // Disconnect
      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: null,
        connectionStatus: 'disconnected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      rerender();

      // Reconnect
      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

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
      vi.mocked(useCurrentAccount).mockReturnValue({
        address: mockAddress,
      } as ReturnType<typeof useCurrentAccount>);

      vi.mocked(useCurrentWallet).mockReturnValue({
        currentWallet: { name: 'Sui Wallet' },
        connectionStatus: 'connected',
      } as unknown as ReturnType<typeof useCurrentWallet>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet.mockRejectedValue(new Error('Database error')),
      } as unknown as ReturnType<typeof useWalletsStore>);

      // Should not throw
      renderHook(() => useSuiWalletSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalled();
      });

      // No toast should be shown on error
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
