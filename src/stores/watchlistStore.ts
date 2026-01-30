import { create } from 'zustand';
import { generateId } from '../database/init';
import { priceService, PriceData } from '../services/price';

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  addedAt: Date;
  priceAlert?: {
    type: 'above' | 'below';
    target: number;
  };
}

interface WatchlistState {
  items: WatchlistItem[];
  prices: Map<string, PriceData>;
  isLoading: boolean;

  // Actions
  loadWatchlist: () => Promise<void>;
  addToWatchlist: (symbol: string, name: string) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  setPriceAlert: (id: string, type: 'above' | 'below', target: number) => void;
  clearPriceAlert: (id: string) => void;
  refreshPrices: () => Promise<void>;
  isInWatchlist: (symbol: string) => boolean;
}

// Store watchlist in localStorage for simplicity
const STORAGE_KEY = 'arkfolio_watchlist';

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: [],
  prices: new Map(),
  isLoading: false,

  loadWatchlist: async () => {
    set({ isLoading: true });
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored).map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }));
        set({ items });

        // Fetch prices for watchlist items
        if (items.length > 0) {
          await get().refreshPrices();
        }
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addToWatchlist: async (symbol, name) => {
    const { items } = get();

    // Check if already in watchlist
    if (items.some(item => item.symbol.toUpperCase() === symbol.toUpperCase())) {
      return;
    }

    const newItem: WatchlistItem = {
      id: generateId(),
      symbol: symbol.toUpperCase(),
      name,
      addedAt: new Date(),
    };

    const updatedItems = [...items, newItem];
    set({ items: updatedItems });

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));

    // Fetch price for new item
    await get().refreshPrices();
  },

  removeFromWatchlist: async (id) => {
    const { items } = get();
    const updatedItems = items.filter(item => item.id !== id);
    set({ items: updatedItems });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
  },

  setPriceAlert: (id, type, target) => {
    const { items } = get();
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, priceAlert: { type, target } } : item
    );
    set({ items: updatedItems });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
  },

  clearPriceAlert: (id) => {
    const { items } = get();
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, priceAlert: undefined } : item
    );
    set({ items: updatedItems });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
  },

  refreshPrices: async () => {
    const { items } = get();
    if (items.length === 0) return;

    try {
      const symbols = items.map(item => item.symbol);
      const prices = await priceService.getPrices(symbols);
      set({ prices });
    } catch (error) {
      console.error('Failed to fetch watchlist prices:', error);
    }
  },

  isInWatchlist: (symbol) => {
    const { items } = get();
    return items.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  },
}));
