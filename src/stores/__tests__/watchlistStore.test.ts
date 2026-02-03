import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useWatchlistStore, WatchlistItem } from '../watchlistStore';

// Mock dependencies
vi.mock('../../database/init', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
        then: (resolve: (value: unknown[]) => void) => resolve([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
  generateId: vi.fn(() => `test-id-${Date.now()}`),
}));

vi.mock('../../services/price', () => ({
  priceService: {
    getPrices: vi.fn(() => Promise.resolve(new Map())),
  },
}));

describe('watchlistStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWatchlistStore.setState({
      items: [],
      prices: new Map(),
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty items array initially', () => {
      const state = useWatchlistStore.getState();
      expect(state.items).toEqual([]);
    });

    it('should have empty prices map initially', () => {
      const state = useWatchlistStore.getState();
      expect(state.prices.size).toBe(0);
    });

    it('should not be loading initially', () => {
      const state = useWatchlistStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('isInWatchlist', () => {
    it('should return false for empty watchlist', () => {
      const { isInWatchlist } = useWatchlistStore.getState();
      expect(isInWatchlist('BTC')).toBe(false);
    });

    it('should return true for item in watchlist', () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { isInWatchlist } = useWatchlistStore.getState();
      expect(isInWatchlist('BTC')).toBe(true);
    });

    it('should be case insensitive', () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { isInWatchlist } = useWatchlistStore.getState();
      expect(isInWatchlist('btc')).toBe(true);
      expect(isInWatchlist('Btc')).toBe(true);
    });

    it('should return false for item not in watchlist', () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { isInWatchlist } = useWatchlistStore.getState();
      expect(isInWatchlist('ETH')).toBe(false);
    });
  });

  describe('addToWatchlist', () => {
    it('should add new item to watchlist', async () => {
      const { addToWatchlist } = useWatchlistStore.getState();
      await addToWatchlist('ETH', 'Ethereum');

      const state = useWatchlistStore.getState();
      expect(state.items.length).toBe(1);
      expect(state.items[0].symbol).toBe('ETH');
      expect(state.items[0].name).toBe('Ethereum');
    });

    it('should not add duplicate symbol', async () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { addToWatchlist } = useWatchlistStore.getState();
      await addToWatchlist('BTC', 'Bitcoin');

      const state = useWatchlistStore.getState();
      expect(state.items.length).toBe(1);
    });

    it('should normalize symbol to uppercase', async () => {
      const { addToWatchlist } = useWatchlistStore.getState();
      await addToWatchlist('eth', 'Ethereum');

      const state = useWatchlistStore.getState();
      expect(state.items[0].symbol).toBe('ETH');
    });
  });

  describe('removeFromWatchlist', () => {
    it('should remove item from watchlist', async () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { removeFromWatchlist } = useWatchlistStore.getState();
      await removeFromWatchlist('test-1');

      const state = useWatchlistStore.getState();
      expect(state.items.length).toBe(0);
    });

    it('should only remove specified item', async () => {
      const items: WatchlistItem[] = [
        { id: 'test-1', symbol: 'BTC', name: 'Bitcoin', addedAt: new Date() },
        { id: 'test-2', symbol: 'ETH', name: 'Ethereum', addedAt: new Date() },
      ];
      useWatchlistStore.setState({ items });

      const { removeFromWatchlist } = useWatchlistStore.getState();
      await removeFromWatchlist('test-1');

      const state = useWatchlistStore.getState();
      expect(state.items.length).toBe(1);
      expect(state.items[0].symbol).toBe('ETH');
    });
  });

  describe('setPriceAlert', () => {
    it('should set price alert on item', async () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
      };
      useWatchlistStore.setState({ items: [item] });

      const { setPriceAlert } = useWatchlistStore.getState();
      await setPriceAlert('test-1', 'above', 50000);

      const state = useWatchlistStore.getState();
      expect(state.items[0].priceAlert).toEqual({ type: 'above', target: 50000 });
    });

    it('should update existing price alert', async () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
        priceAlert: { type: 'above', target: 40000 },
      };
      useWatchlistStore.setState({ items: [item] });

      const { setPriceAlert } = useWatchlistStore.getState();
      await setPriceAlert('test-1', 'below', 30000);

      const state = useWatchlistStore.getState();
      expect(state.items[0].priceAlert).toEqual({ type: 'below', target: 30000 });
    });
  });

  describe('clearPriceAlert', () => {
    it('should clear price alert from item', async () => {
      const item: WatchlistItem = {
        id: 'test-1',
        symbol: 'BTC',
        name: 'Bitcoin',
        addedAt: new Date(),
        priceAlert: { type: 'above', target: 50000 },
      };
      useWatchlistStore.setState({ items: [item] });

      const { clearPriceAlert } = useWatchlistStore.getState();
      await clearPriceAlert('test-1');

      const state = useWatchlistStore.getState();
      expect(state.items[0].priceAlert).toBeUndefined();
    });
  });

  describe('refreshPrices', () => {
    it('should not fetch prices for empty watchlist', async () => {
      const { priceService } = await import('../../services/price');
      const { refreshPrices } = useWatchlistStore.getState();

      await refreshPrices();

      expect(priceService.getPrices).not.toHaveBeenCalled();
    });

    it('should fetch prices for all items in watchlist', async () => {
      const { priceService } = await import('../../services/price');
      const items: WatchlistItem[] = [
        { id: 'test-1', symbol: 'BTC', name: 'Bitcoin', addedAt: new Date() },
        { id: 'test-2', symbol: 'ETH', name: 'Ethereum', addedAt: new Date() },
      ];
      useWatchlistStore.setState({ items });

      const { refreshPrices } = useWatchlistStore.getState();
      await refreshPrices();

      expect(priceService.getPrices).toHaveBeenCalledWith(['BTC', 'ETH']);
    });
  });
});
