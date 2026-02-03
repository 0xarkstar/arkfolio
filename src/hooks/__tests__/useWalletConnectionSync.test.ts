import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWalletConnectionSync } from '../useWalletConnectionSync';

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
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

import { useAccount } from 'wagmi';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';

describe('useWalletConnectionSync', () => {
  let mockAddWallet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddWallet = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    } as unknown as ReturnType<typeof useAccount>);

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
      vi.mocked(useAccount).mockReturnValue({
        address: undefined,
        isConnected: false,
      } as unknown as ReturnType<typeof useAccount>);

      renderHook(() => useWalletConnectionSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not add wallet when address is undefined', () => {
      vi.mocked(useAccount).mockReturnValue({
        address: undefined,
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      renderHook(() => useWalletConnectionSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });
  });

  describe('when connected', () => {
    it('should add wallet when connected with new address', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useWalletConnectionSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledWith(
          '0x1234567890123456789012345678901234567890',
          'Connected Wallet'
        );
      });
    });

    it('should show success toast after adding wallet', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useWalletConnectionSync());

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Added EVM wallet from connected account'
        );
      });
    });

    it('should not add wallet that already exists in store', () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: '0x1234567890123456789012345678901234567890',
            chain: 'ethereum',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useWalletConnectionSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should compare addresses case-insensitively', () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0xABCDEF1234567890123456789012345678901234',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [
          {
            id: '1',
            address: '0xabcdef1234567890123456789012345678901234',
            chain: 'ethereum',
          },
        ],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useWalletConnectionSync());

      expect(mockAddWallet).not.toHaveBeenCalled();
    });

    it('should not re-sync same address in same session', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useWalletConnectionSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      // Rerender with same address
      rerender();

      // Should still be 1 because we track synced addresses
      expect(mockAddWallet).toHaveBeenCalledTimes(1);
    });

    it('should reset tracking when disconnected', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet,
      } as unknown as ReturnType<typeof useWalletsStore>);

      const { rerender } = renderHook(() => useWalletConnectionSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalledTimes(1);
      });

      // Disconnect
      vi.mocked(useAccount).mockReturnValue({
        address: undefined,
        isConnected: false,
      } as unknown as ReturnType<typeof useAccount>);

      rerender();

      // Reconnect with same address
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      // Clear the existing wallets so the new connection can trigger add
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
      vi.mocked(useAccount).mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      } as unknown as ReturnType<typeof useAccount>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        addWallet: mockAddWallet.mockRejectedValue(new Error('Database error')),
      } as unknown as ReturnType<typeof useWalletsStore>);

      // Should not throw
      renderHook(() => useWalletConnectionSync());

      await waitFor(() => {
        expect(mockAddWallet).toHaveBeenCalled();
      });

      // No toast should be shown on error (just logged)
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
