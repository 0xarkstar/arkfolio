import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExchangeRealtimeSync } from '../useExchangeRealtimeSync';

// Mock the stores
vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('../../stores/exchangeStore', () => ({
  useExchangeStore: vi.fn(),
}));

import { useSettingsStore } from '../../stores/settingsStore';
import { useExchangeStore } from '../../stores/exchangeStore';

describe('useExchangeRealtimeSync', () => {
  let mockSubscribeToUpdates: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockSubscribeToUpdates = vi.fn().mockReturnValue(mockUnsubscribe);

    vi.mocked(useSettingsStore).mockReturnValue({
      settings: {
        realtimeSync: false,
      },
    } as ReturnType<typeof useSettingsStore>);

    vi.mocked(useExchangeStore).mockReturnValue({
      accounts: [],
      subscribeToUpdates: mockSubscribeToUpdates,
    } as unknown as ReturnType<typeof useExchangeStore>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('realtime sync disabled', () => {
    it('should not subscribe when realtimeSync is disabled', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: false },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).not.toHaveBeenCalled();
    });

    it('should cleanup subscriptions when realtimeSync is disabled', () => {
      // Start with realtimeSync enabled
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const { rerender } = renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('1');

      // Disable realtimeSync
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: false },
      } as ReturnType<typeof useSettingsStore>);

      rerender();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('realtime sync enabled', () => {
    it('should subscribe to connected exchanges', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: true },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('1');
      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('2');
      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(2);
    });

    it('should skip disconnected exchanges', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: false },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('1');
      expect(mockSubscribeToUpdates).not.toHaveBeenCalledWith('2');
      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(1);
    });

    it('should not re-subscribe to already subscribed accounts', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const { rerender } = renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(1);

      // Rerender with same accounts
      rerender();

      // Should still be 1 because account was already subscribed
      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to new accounts when added', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [{ id: '1', exchange: 'binance', isConnected: true }],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const { rerender } = renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('1');

      // Add new account - note: when dependencies change, cleanup runs first
      // which clears subscriptionsRef, then the effect re-subscribes to all accounts
      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: true },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      rerender();

      // After rerender, the effect re-runs and should subscribe to both accounts
      // (cleanup cleared the ref, so both are new)
      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('1');
      expect(mockSubscribeToUpdates).toHaveBeenCalledWith('2');
    });

    it('should cleanup subscription when account is disconnected', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: true },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const { rerender } = renderHook(() => useExchangeRealtimeSync());

      // Disconnect account 2
      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: false },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      rerender();

      // Unsubscribe should be called for disconnected account
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should cleanup all subscriptions on unmount', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [
          { id: '1', exchange: 'binance', isConnected: true },
          { id: '2', exchange: 'kraken', isConnected: true },
        ],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      const { unmount } = renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).toHaveBeenCalledTimes(2);

      unmount();

      // Both subscriptions should be cleaned up
      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('no exchanges', () => {
    it('should handle empty accounts list', () => {
      vi.mocked(useSettingsStore).mockReturnValue({
        settings: { realtimeSync: true },
      } as ReturnType<typeof useSettingsStore>);

      vi.mocked(useExchangeStore).mockReturnValue({
        accounts: [],
        subscribeToUpdates: mockSubscribeToUpdates,
      } as unknown as ReturnType<typeof useExchangeStore>);

      renderHook(() => useExchangeRealtimeSync());

      expect(mockSubscribeToUpdates).not.toHaveBeenCalled();
    });
  });
});
