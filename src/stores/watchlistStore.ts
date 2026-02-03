import { create } from 'zustand';
import { getDb, generateId } from '../database/init';
import { watchlist } from '../database/schema';
import { eq } from 'drizzle-orm';
import { priceService, PriceData } from '../services/price';
import { logger } from '../utils/logger';

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
  setPriceAlert: (id: string, type: 'above' | 'below', target: number) => Promise<void>;
  clearPriceAlert: (id: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
  isInWatchlist: (symbol: string) => boolean;
}

// Migration: key for localStorage (to migrate from)
const LEGACY_STORAGE_KEY = 'arkfolio_watchlist';

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: [],
  prices: new Map(),
  isLoading: false,

  loadWatchlist: async () => {
    set({ isLoading: true });
    try {
      const db = getDb();

      // Check for legacy localStorage data and migrate
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyData) {
        try {
          const legacyItems = JSON.parse(legacyData);
          // Migrate each item to the database
          for (const item of legacyItems) {
            const existingItem = await db.select()
              .from(watchlist)
              .where(eq(watchlist.symbol, item.symbol.toUpperCase()))
              .limit(1);

            if (existingItem.length === 0) {
              await db.insert(watchlist).values({
                id: item.id || generateId(),
                symbol: item.symbol.toUpperCase(),
                name: item.name,
                priceAlertType: item.priceAlert?.type || null,
                priceAlertTarget: item.priceAlert?.target || null,
                addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
              });
            }
          }
          // Remove legacy data after successful migration
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          logger.info('Migrated watchlist from localStorage to database');
        } catch (migrationError) {
          logger.error('Failed to migrate watchlist from localStorage:', migrationError);
        }
      }

      // Load items from database
      const rows = await db.select().from(watchlist);
      const items: WatchlistItem[] = rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        addedAt: row.addedAt || new Date(),
        priceAlert: row.priceAlertType && row.priceAlertTarget
          ? { type: row.priceAlertType, target: row.priceAlertTarget }
          : undefined,
      }));

      set({ items });

      // Fetch prices for watchlist items
      if (items.length > 0) {
        await get().refreshPrices();
      }
    } catch (error) {
      logger.error('Failed to load watchlist:', error);
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

    try {
      const db = getDb();
      const newItem = {
        id: generateId(),
        symbol: symbol.toUpperCase(),
        name,
        addedAt: new Date(),
      };

      await db.insert(watchlist).values({
        id: newItem.id,
        symbol: newItem.symbol,
        name: newItem.name,
        addedAt: newItem.addedAt,
      });

      set({ items: [...items, newItem] });

      // Fetch price for new item
      await get().refreshPrices();
    } catch (error) {
      logger.error('Failed to add to watchlist:', error);
    }
  },

  removeFromWatchlist: async (id) => {
    const { items } = get();

    try {
      const db = getDb();
      await db.delete(watchlist).where(eq(watchlist.id, id));
      set({ items: items.filter(item => item.id !== id) });
    } catch (error) {
      logger.error('Failed to remove from watchlist:', error);
    }
  },

  setPriceAlert: async (id, type, target) => {
    const { items } = get();

    try {
      const db = getDb();
      await db.update(watchlist)
        .set({ priceAlertType: type, priceAlertTarget: target })
        .where(eq(watchlist.id, id));

      const updatedItems = items.map(item =>
        item.id === id ? { ...item, priceAlert: { type, target } } : item
      );
      set({ items: updatedItems });
    } catch (error) {
      logger.error('Failed to set price alert:', error);
    }
  },

  clearPriceAlert: async (id) => {
    const { items } = get();

    try {
      const db = getDb();
      await db.update(watchlist)
        .set({ priceAlertType: null, priceAlertTarget: null })
        .where(eq(watchlist.id, id));

      const updatedItems = items.map(item =>
        item.id === id ? { ...item, priceAlert: undefined } : item
      );
      set({ items: updatedItems });
    } catch (error) {
      logger.error('Failed to clear price alert:', error);
    }
  },

  refreshPrices: async () => {
    const { items } = get();
    if (items.length === 0) return;

    try {
      const symbols = items.map(item => item.symbol);
      const prices = await priceService.getPrices(symbols);
      set({ prices });
    } catch (error) {
      logger.error('Failed to fetch watchlist prices:', error);
    }
  },

  isInWatchlist: (symbol) => {
    const { items } = get();
    return items.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  },
}));
