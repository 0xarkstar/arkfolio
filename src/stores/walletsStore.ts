import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { wallets, onchainAssets } from '../database/schema';
import { eq } from 'drizzle-orm';
import { walletService, Chain, WalletSummary, TokenBalance, NativeBalance } from '../services/blockchain';

export interface StoredWallet {
  id: string;
  address: string;
  chain: Chain;
  label: string;
  createdAt: Date;
}

export interface WalletWithBalances extends StoredWallet {
  nativeBalance: NativeBalance | null;
  tokenBalances: TokenBalance[];
  totalValueUsd: Decimal;
  isLoading: boolean;
  lastSync: Date | null;
  error?: string;
}

interface WalletsState {
  wallets: WalletWithBalances[];
  isLoading: boolean;
  error: string | null;

  // Filter state
  showUnknownTokens: boolean;

  // Actions
  loadWallets: () => Promise<void>;
  addWallet: (address: string, chain: Chain, label: string) => Promise<string>;
  removeWallet: (walletId: string) => Promise<void>;
  syncWallet: (walletId: string) => Promise<void>;
  syncAllWallets: () => Promise<void>;
  setShowUnknownTokens: (show: boolean) => void;

  // Getters
  getTotalValueUsd: () => Decimal;
  getWalletsByChain: (chain: Chain) => WalletWithBalances[];
}

export const useWalletsStore = create<WalletsState>((set, get) => ({
  wallets: [],
  isLoading: false,
  error: null,
  showUnknownTokens: false, // Default: only show registered tokens

  loadWallets: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();
      const storedWallets = await db.select().from(wallets);

      const walletsWithBalances: WalletWithBalances[] = storedWallets.map((w) => ({
        id: w.id,
        address: w.address,
        chain: w.chain as Chain,
        label: w.label || w.address.slice(0, 6) + '...' + w.address.slice(-4),
        createdAt: w.createdAt ? new Date(w.createdAt as unknown as number) : new Date(),
        nativeBalance: null,
        tokenBalances: [],
        totalValueUsd: new Decimal(0),
        isLoading: false,
        lastSync: null,
      }));

      set({ wallets: walletsWithBalances, isLoading: false });

      // Auto-sync wallets in background
      if (walletsWithBalances.length > 0) {
        get().syncAllWallets();
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load wallets',
        isLoading: false,
      });
    }
  },

  addWallet: async (address, chain, label) => {
    const { wallets: currentWallets } = get();
    set({ isLoading: true, error: null });

    try {
      // Validate address
      if (!walletService.isValidAddress(address, chain)) {
        throw new Error('Invalid wallet address');
      }

      // Check if already exists
      const existing = currentWallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
      );
      if (existing) {
        throw new Error('Wallet already exists');
      }

      // Store in database
      const db = getDb();
      const id = generateId();
      const now = new Date();

      await db.insert(wallets).values({
        id,
        address: address.toLowerCase(),
        chain,
        label: label || undefined,
        createdAt: now,
      });

      const newWallet: WalletWithBalances = {
        id,
        address: address.toLowerCase(),
        chain,
        label: label || address.slice(0, 6) + '...' + address.slice(-4),
        createdAt: now,
        nativeBalance: null,
        tokenBalances: [],
        totalValueUsd: new Decimal(0),
        isLoading: true,
        lastSync: null,
      };

      set({
        wallets: [...currentWallets, newWallet],
        isLoading: false,
      });

      // Sync the new wallet
      get().syncWallet(id);

      return id;
    } catch (error) {
      console.error('Failed to add wallet:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add wallet',
        isLoading: false,
      });
      throw error;
    }
  },

  removeWallet: async (walletId) => {
    const { wallets: currentWallets } = get();
    set({ isLoading: true, error: null });

    try {
      const db = getDb();

      // Delete associated assets
      await db.delete(onchainAssets).where(eq(onchainAssets.walletId, walletId));

      // Delete wallet
      await db.delete(wallets).where(eq(wallets.id, walletId));

      set({
        wallets: currentWallets.filter((w) => w.id !== walletId),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to remove wallet:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to remove wallet',
        isLoading: false,
      });
      throw error;
    }
  },

  setShowUnknownTokens: (show) => {
    set({ showUnknownTokens: show });
    // Re-sync all wallets with new filter setting
    get().syncAllWallets();
  },

  syncWallet: async (walletId) => {
    const { wallets: currentWallets, showUnknownTokens } = get();
    const wallet = currentWallets.find((w) => w.id === walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Set wallet as loading
    set({
      wallets: currentWallets.map((w) =>
        w.id === walletId ? { ...w, isLoading: true, error: undefined } : w
      ),
    });

    try {
      // Fetch wallet summary from blockchain service
      // If showUnknownTokens is false, filter out unregistered tokens
      const summary = await walletService.getWalletSummary(wallet.address, {
        chains: [wallet.chain],
        useCommonTokensOnly: false, // Fetch all tokens, then filter
        filterUnknownTokens: !showUnknownTokens, // Filter if NOT showing unknown
      });

      const chainData = summary.chains.find((c) => c.chain === wallet.chain);

      if (!chainData) {
        throw new Error('Failed to fetch chain data');
      }

      // Update state
      set({
        wallets: get().wallets.map((w) =>
          w.id === walletId
            ? {
                ...w,
                nativeBalance: chainData.nativeBalance,
                tokenBalances: chainData.tokenBalances,
                totalValueUsd: calculateWalletValue(chainData),
                isLoading: false,
                lastSync: new Date(),
              }
            : w
        ),
      });

      // Store balances in database
      const db = getDb();
      await db.delete(onchainAssets).where(eq(onchainAssets.walletId, walletId));

      // Store native balance
      if (chainData.nativeBalance && chainData.nativeBalance.balance.greaterThan(0)) {
        await db.insert(onchainAssets).values({
          id: generateId(),
          walletId,
          tokenSymbol: chainData.nativeBalance.symbol,
          balance: chainData.nativeBalance.balance.toNumber(),
          decimals: 18,
          updatedAt: new Date(),
        });
      }

      // Store token balances
      for (const token of chainData.tokenBalances) {
        await db.insert(onchainAssets).values({
          id: generateId(),
          walletId,
          contractAddress: token.token.address,
          tokenSymbol: token.token.symbol,
          balance: token.balance.toNumber(),
          decimals: token.token.decimals,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Failed to sync wallet ${walletId}:`, error);
      set({
        wallets: get().wallets.map((w) =>
          w.id === walletId
            ? {
                ...w,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Sync failed',
              }
            : w
        ),
      });
    }
  },

  syncAllWallets: async () => {
    const { wallets: currentWallets, syncWallet } = get();

    // Sync wallets sequentially to avoid rate limiting
    for (const wallet of currentWallets) {
      await syncWallet(wallet.id);
    }
  },

  getTotalValueUsd: () => {
    const { wallets: currentWallets } = get();
    return currentWallets.reduce((sum, w) => sum.plus(w.totalValueUsd), new Decimal(0));
  },

  getWalletsByChain: (chain) => {
    const { wallets: currentWallets } = get();
    return currentWallets.filter((w) => w.chain === chain);
  },
}));

function calculateWalletValue(chainData: WalletSummary['chains'][0]): Decimal {
  let total = chainData.nativeBalance.valueUsd || new Decimal(0);

  for (const token of chainData.tokenBalances) {
    if (token.valueUsd) {
      total = total.plus(token.valueUsd);
    }
  }

  return total;
}
