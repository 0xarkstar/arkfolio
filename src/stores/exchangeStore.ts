import { create } from 'zustand';
import Decimal from 'decimal.js';
import {
  exchangeManager,
  SupportedExchange,
  ExchangeCredentials,
  Balance,
  Position,
  EarnPosition,
  ExchangeStatus,
} from '../services/exchanges';
import { transactionSyncService } from '../services/sync';
import { getDb, generateId } from '../database/init';
import { exchanges, balances, positions } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface ExchangeAccount {
  id: string;
  exchangeId: SupportedExchange;
  name: string;
  type: 'cex' | 'dex' | 'perp';
  isConnected: boolean;
  lastSync?: Date;
  error?: string;
}

export interface AggregatedBalance {
  asset: string;
  total: Decimal;
  byExchange: Map<string, Balance>;
}

interface ExchangeState {
  // Exchange accounts
  accounts: ExchangeAccount[];
  isLoading: boolean;
  error: string | null;

  // Aggregated data
  allBalances: Map<string, Balance[]>;
  allPositions: Map<string, Position[]>;
  allEarnPositions: Map<string, EarnPosition[]>;

  // Actions
  loadAccounts: () => Promise<void>;
  addExchange: (
    exchangeId: SupportedExchange,
    name: string,
    credentials: ExchangeCredentials
  ) => Promise<string>;
  removeExchange: (accountId: string) => Promise<void>;
  connectExchange: (accountId: string, credentials: ExchangeCredentials) => Promise<void>;
  disconnectExchange: (accountId: string) => Promise<void>;
  syncExchange: (accountId: string) => Promise<void>;
  syncAllExchanges: () => Promise<void>;
  syncTransactions: (accountId: string, options?: { since?: Date }) => Promise<{ tradesAdded: number; transfersAdded: number; errors: string[] }>;
  syncAllTransactions: (options?: { since?: Date }) => Promise<void>;

  // Real-time subscription management
  subscribeToUpdates: (accountId: string) => () => void;

  // Getters
  getExchangeStatus: (accountId: string) => ExchangeStatus;
  getAggregatedBalances: () => AggregatedBalance[];
  getTotalValueUsd: () => Decimal;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  allBalances: new Map(),
  allPositions: new Map(),
  allEarnPositions: new Map(),

  loadAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = getDb();
      const storedExchanges = await db.select().from(exchanges);

      const accounts: ExchangeAccount[] = storedExchanges.map(e => ({
        id: e.id,
        exchangeId: e.name.toLowerCase() as SupportedExchange,
        name: e.name,
        type: e.type as 'cex' | 'dex' | 'perp',
        isConnected: false,
        lastSync: e.updatedAt ? new Date(e.updatedAt as unknown as number) : undefined,
      }));

      set({ accounts, isLoading: false });
    } catch (error) {
      console.error('Failed to load exchange accounts:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load accounts',
        isLoading: false,
      });
    }
  },

  addExchange: async (exchangeId, name, credentials) => {
    const { accounts } = get();
    set({ isLoading: true, error: null });

    try {
      // Create adapter and test connection
      const adapter = await exchangeManager.connectExchange(exchangeId, credentials, 'temp');
      await adapter.disconnect();

      // Store in database
      const db = getDb();
      const id = generateId();
      const now = new Date();

      // Store encrypted credential references (actual encryption happens in electron)
      const apiKeyRef = `${id}_apiKey`;
      const apiSecretRef = `${id}_apiSecret`;
      const passphraseRef = credentials.passphrase ? `${id}_passphrase` : null;

      // Save credentials via electron safe storage
      if (window.electronAPI) {
        await window.electronAPI.safeStorage.encrypt(apiKeyRef, credentials.apiKey);
        await window.electronAPI.safeStorage.encrypt(apiSecretRef, credentials.apiSecret);
        if (credentials.passphrase) {
          await window.electronAPI.safeStorage.encrypt(passphraseRef!, credentials.passphrase);
        }
      }

      await db.insert(exchanges).values({
        id,
        name,
        type: 'cex',
        apiKeyRef,
        apiSecretRef,
        passphraseRef,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const newAccount: ExchangeAccount = {
        id,
        exchangeId,
        name,
        type: 'cex',
        isConnected: false,
      };

      set({
        accounts: [...accounts, newAccount],
        isLoading: false,
      });

      return id;
    } catch (error) {
      console.error('Failed to add exchange:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add exchange',
        isLoading: false,
      });
      throw error;
    }
  },

  removeExchange: async (accountId) => {
    const { accounts } = get();
    set({ isLoading: true, error: null });

    try {
      // Disconnect if connected
      await exchangeManager.disconnectExchange(accountId);

      // Remove from database
      const db = getDb();
      await db.delete(exchanges).where(eq(exchanges.id, accountId));

      // Remove credentials from safe storage
      if (window.electronAPI) {
        await window.electronAPI.safeStorage.delete(`${accountId}_apiKey`);
        await window.electronAPI.safeStorage.delete(`${accountId}_apiSecret`);
        await window.electronAPI.safeStorage.delete(`${accountId}_passphrase`);
      }

      set({
        accounts: accounts.filter(a => a.id !== accountId),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to remove exchange:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to remove exchange',
        isLoading: false,
      });
      throw error;
    }
  },

  connectExchange: async (accountId, credentials) => {
    const { accounts } = get();
    const account = accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found');

    try {
      await exchangeManager.connectExchange(account.exchangeId, credentials, accountId);

      set({
        accounts: accounts.map(a =>
          a.id === accountId ? { ...a, isConnected: true, error: undefined } : a
        ),
      });
    } catch (error) {
      set({
        accounts: accounts.map(a =>
          a.id === accountId
            ? { ...a, isConnected: false, error: error instanceof Error ? error.message : 'Connection failed' }
            : a
        ),
      });
      throw error;
    }
  },

  disconnectExchange: async (accountId) => {
    const { accounts } = get();

    await exchangeManager.disconnectExchange(accountId);

    set({
      accounts: accounts.map(a =>
        a.id === accountId ? { ...a, isConnected: false } : a
      ),
    });
  },

  syncExchange: async (accountId) => {
    const { accounts, allBalances, allPositions, allEarnPositions } = get();
    const adapter = exchangeManager.getAdapter(accountId);

    if (!adapter) {
      throw new Error('Exchange not connected');
    }

    try {
      // Fetch all data in parallel
      const [spotBalances, futuresBalances, futuresPositions, earnPositions] = await Promise.all([
        adapter.getSpotBalances(),
        adapter.getFuturesBalances(),
        adapter.getFuturesPositions(),
        adapter.getEarnPositions(),
      ]);

      const combinedBalances = [...spotBalances, ...futuresBalances];

      // Update state
      const newBalances = new Map(allBalances);
      newBalances.set(accountId, combinedBalances);

      const newPositions = new Map(allPositions);
      newPositions.set(accountId, futuresPositions);

      const newEarnPositions = new Map(allEarnPositions);
      newEarnPositions.set(accountId, earnPositions);

      // Store in database
      const db = getDb();
      const now = new Date();

      // Delete old balances for this exchange
      await db.delete(balances).where(eq(balances.exchangeId, accountId));

      // Insert new balances
      for (const balance of combinedBalances) {
        await db.insert(balances).values({
          id: generateId(),
          exchangeId: accountId,
          asset: balance.asset,
          balanceType: balance.balanceType,
          free: balance.free.toNumber(),
          locked: balance.locked.toNumber(),
          updatedAt: now,
        });
      }

      // Delete old positions for this exchange
      await db.delete(positions).where(eq(positions.exchangeId, accountId));

      // Insert new positions
      for (const position of futuresPositions) {
        await db.insert(positions).values({
          id: generateId(),
          exchangeId: accountId,
          symbol: position.symbol,
          side: position.side,
          size: position.size.toNumber(),
          entryPrice: position.entryPrice.toNumber(),
          markPrice: position.markPrice.toNumber(),
          unrealizedPnl: position.unrealizedPnl.toNumber(),
          leverage: position.leverage,
          liquidationPrice: position.liquidationPrice?.toNumber(),
          marginType: position.marginType,
          updatedAt: now,
        });
      }

      set({
        allBalances: newBalances,
        allPositions: newPositions,
        allEarnPositions: newEarnPositions,
        accounts: accounts.map(a =>
          a.id === accountId ? { ...a, lastSync: now, error: undefined } : a
        ),
      });
    } catch (error) {
      console.error('Failed to sync exchange:', error);
      set({
        accounts: accounts.map(a =>
          a.id === accountId
            ? { ...a, error: error instanceof Error ? error.message : 'Sync failed' }
            : a
        ),
      });
      throw error;
    }
  },

  syncAllExchanges: async () => {
    const { accounts, syncExchange } = get();
    const connectedAccounts = accounts.filter(a => a.isConnected);

    await Promise.allSettled(
      connectedAccounts.map(account => syncExchange(account.id))
    );
  },

  syncTransactions: async (accountId, options = {}) => {
    const adapter = exchangeManager.getAdapter(accountId);
    if (!adapter) {
      throw new Error('Exchange not connected');
    }

    const result = await transactionSyncService.syncExchangeTransactions(accountId, {
      since: options.since,
    });

    return {
      tradesAdded: result.tradesAdded,
      transfersAdded: result.transfersAdded,
      errors: result.errors,
    };
  },

  syncAllTransactions: async (options = {}) => {
    const { accounts, syncTransactions } = get();
    const connectedAccounts = accounts.filter(a => a.isConnected);

    await Promise.allSettled(
      connectedAccounts.map(account => syncTransactions(account.id, options))
    );
  },

  subscribeToUpdates: (accountId) => {
    const adapter = exchangeManager.getAdapter(accountId);
    if (!adapter) {
      return () => { };
    }

    const unsubscribeBalance = adapter.subscribeBalanceUpdates((balance) => {
      const { allBalances } = get();
      const accountBalances = allBalances.get(accountId) || [];

      // Update or add the balance
      const existingIndex = accountBalances.findIndex(
        b => b.asset === balance.asset && b.balanceType === balance.balanceType
      );

      const newAccountBalances = [...accountBalances];
      if (existingIndex >= 0) {
        newAccountBalances[existingIndex] = balance;
      } else {
        newAccountBalances.push(balance);
      }

      const newBalances = new Map(allBalances);
      newBalances.set(accountId, newAccountBalances);
      set({ allBalances: newBalances });
    });

    const unsubscribePosition = adapter.subscribePositionUpdates((position) => {
      const { allPositions } = get();
      const accountPositions = allPositions.get(accountId) || [];

      // Update or add the position
      const existingIndex = accountPositions.findIndex(p => p.id === position.id);

      const newAccountPositions = [...accountPositions];
      if (existingIndex >= 0) {
        newAccountPositions[existingIndex] = position;
      } else {
        newAccountPositions.push(position);
      }

      const newPositions = new Map(allPositions);
      newPositions.set(accountId, newAccountPositions);
      set({ allPositions: newPositions });
    });

    return () => {
      unsubscribeBalance();
      unsubscribePosition();
    };
  },

  getExchangeStatus: (accountId) => {
    const { accounts } = get();
    const account = accounts.find(a => a.id === accountId);

    return {
      exchangeId: account?.exchangeId || '',
      isConnected: account?.isConnected || false,
      lastSync: account?.lastSync,
      error: account?.error,
    };
  },

  getAggregatedBalances: () => {
    const { allBalances } = get();
    const aggregated = new Map<string, AggregatedBalance>();

    allBalances.forEach((balanceList, accountId) => {
      balanceList.forEach(balance => {
        const existing = aggregated.get(balance.asset);
        if (existing) {
          existing.total = existing.total.plus(balance.total);
          existing.byExchange.set(accountId, balance);
        } else {
          const byExchange = new Map<string, Balance>();
          byExchange.set(accountId, balance);
          aggregated.set(balance.asset, {
            asset: balance.asset,
            total: balance.total,
            byExchange,
          });
        }
      });
    });

    return Array.from(aggregated.values());
  },

  getTotalValueUsd: () => {
    const { allBalances } = get();
    let total = new Decimal(0);

    allBalances.forEach(balanceList => {
      balanceList.forEach(balance => {
        if (balance.valueUsd) {
          total = total.plus(balance.valueUsd);
        }
      });
    });

    return total;
  },
}));
