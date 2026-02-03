import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSync } from '../useAutoSync';

// Mock the stores
vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('../../stores/exchangeStore', () => ({
  useExchangeStore: vi.fn(),
}));

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

import { useSettingsStore } from '../../stores/settingsStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';

describe('useAutoSync', () => {
  let mockSyncAllExchanges: ReturnType<typeof vi.fn>;
  let mockSyncAllWallets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSyncAllExchanges = vi.fn().mockResolvedValue(undefined);
    mockSyncAllWallets = vi.fn().mockResolvedValue(undefined);

    // Default mock implementations
    vi.mocked(useSettingsStore).mockReturnValue({
      settings: {
        autoSync: false,
        syncInterval: 5, // 5 minutes
      },
    } as ReturnType<typeof useSettingsStore>);

    vi.mocked(useExchangeStore).mockReturnValue({
      accounts: [],
      syncAllExchanges: mockSyncAllExchanges,
    } as unknown as ReturnType<typeof useExchangeStore>);

    vi.mocked(useWalletsStore).mockReturnValue({
      wallets: [],
      syncAllWallets: mockSyncAllWallets,
    } as unknown as ReturnType<typeof useWalletsStore>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('auto-sync disabled', () => {
    it('should not set up interval when autoSync is disabled', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: false, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      renderHook(() => useAutoSync());

      // Advance time significantly
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      expect(mockSyncAllExchanges).not.toHaveBeenCalled();
      expect(mockSyncAllWallets).not.toHaveBeenCalled();
    });
  });

  describe('auto-sync enabled', () => {
    it('should not sync when no exchanges or wallets are configured', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [],
        syncAllWallets: mockSyncAllWallets,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useAutoSync());

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockSyncAllExchanges).not.toHaveBeenCalled();
      expect(mockSyncAllWallets).not.toHaveBeenCalled();
    });

    it('should perform initial sync after 5 seconds when exchanges are connected', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useAutoSync());

      // Initial sync happens after 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockSyncAllExchanges).toHaveBeenCalledTimes(1);
    });

    it('should sync wallets when wallets are configured', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [{ id: '1', address: '0x123', chain: 'ethereum' }],
        syncAllWallets: mockSyncAllWallets,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useAutoSync());

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockSyncAllWallets).toHaveBeenCalledTimes(1);
    });

    it('should sync both exchanges and wallets in parallel', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [{ id: '1', address: '0x123', chain: 'ethereum' }],
        syncAllWallets: mockSyncAllWallets,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useAutoSync());

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockSyncAllExchanges).toHaveBeenCalledTimes(1);
      expect(mockSyncAllWallets).toHaveBeenCalledTimes(1);
    });

    it('should skip disconnected exchanges', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: false }],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useAutoSync());

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      // No connected exchanges, so sync should not be called
      expect(mockSyncAllExchanges).not.toHaveBeenCalled();
    });

    it('should show warning toast when sync partially fails', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        syncAllExchanges: mockSyncAllExchanges.mockRejectedValue(new Error('API error')),
      } as unknown as ReturnType<typeof useExchangeStore>);

      vi.mocked(useWalletsStore).mockReturnValue({
        wallets: [{ id: '1', address: '0x123', chain: 'ethereum' }],
        syncAllWallets: mockSyncAllWallets,
      } as unknown as ReturnType<typeof useWalletsStore>);

      renderHook(() => useAutoSync());

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve(); // Extra tick for Promise.allSettled
      });

      expect(toast.warning).toHaveBeenCalledWith('Some data failed to sync');
    });

    it('should cleanup interval on unmount', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 5 },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useAutoSync());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should not sync more than once every 30 seconds', async () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { autoSync: true, syncInterval: 1 }, // 1 minute interval
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        syncAllExchanges: mockSyncAllExchanges,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useAutoSync());

      // Initial sync at 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockSyncAllExchanges).toHaveBeenCalledTimes(1);

      // Try to sync again at 20 seconds (within 30 second minimum)
      await act(async () => {
        vi.advanceTimersByTime(15000);
        await Promise.resolve();
      });

      // Should still be 1 because of rate limiting
      expect(mockSyncAllExchanges).toHaveBeenCalledTimes(1);
    });
  });
});
