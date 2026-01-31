import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { wallets, onchainAssets } from '../database/schema';
import { eq } from 'drizzle-orm';
import { walletService, Chain, WalletSummary, TokenBalance, NativeBalance } from '../services/blockchain';
import { getEVMChains } from '../services/blockchain/chains';

// Wallet types: EVM (all EVM chains) or SOLANA
export type WalletType = 'EVM' | 'SOLANA';

export interface StoredWallet {
  id: string;
  address: string;
  walletType: WalletType;
  label: string;
  createdAt: Date;
}

// Balances per chain
export interface ChainBalance {
  chain: Chain;
  nativeBalance: NativeBalance | null;
  tokenBalances: TokenBalance[];
  totalValueUsd: Decimal;
}

export interface WalletWithBalances extends StoredWallet {
  chainBalances: ChainBalance[];
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
  addWallet: (address: string, label?: string) => Promise<string>;
  removeWallet: (walletId: string) => Promise<void>;
  syncWallet: (walletId: string) => Promise<void>;
  syncAllWallets: () => Promise<void>;
  setShowUnknownTokens: (show: boolean) => void;

  // Getters
  getTotalValueUsd: () => Decimal;
  getWalletsByType: (type: WalletType) => WalletWithBalances[];
}

// Helper to detect wallet type from address
function detectWalletType(address: string): WalletType {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'EVM';
  }
  return 'SOLANA';
}

// Get chains to query based on wallet type
function getChainsForWalletType(walletType: WalletType): Chain[] {
  if (walletType === 'EVM') {
    return getEVMChains().map(c => c.id);
  }
  return [Chain.SOLANA];
}

export const useWalletsStore = create<WalletsState>((set, get) => ({
  wallets: [],
  isLoading: false,
  error: null,
  showUnknownTokens: false,

  loadWallets: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();
      const storedWallets = await db.select().from(wallets);

      const walletsWithBalances: WalletWithBalances[] = storedWallets.map((w) => ({
        id: w.id,
        address: w.address,
        walletType: (w.chain === 'EVM' || w.chain === 'SOLANA' ? w.chain : 'EVM') as WalletType,
        label: w.label || w.address.slice(0, 6) + '...' + w.address.slice(-4),
        createdAt: w.createdAt ? new Date(w.createdAt as unknown as number) : new Date(),
        chainBalances: [],
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

  addWallet: async (address, label) => {
    const { wallets: currentWallets } = get();
    set({ isLoading: true, error: null });

    try {
      // Detect wallet type from address format
      const walletType = detectWalletType(address);

      // Validate address
      if (walletType === 'EVM' && !walletService.isValidEVMAddress(address)) {
        throw new Error('Invalid EVM wallet address');
      }
      if (walletType === 'SOLANA' && !walletService.isValidSolanaAddress(address)) {
        throw new Error('Invalid Solana wallet address');
      }

      // Check if already exists (same address)
      const existing = currentWallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase()
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
        chain: walletType, // Store wallet type in chain field
        label: label || undefined,
        createdAt: now,
      });

      const newWallet: WalletWithBalances = {
        id,
        address: address.toLowerCase(),
        walletType,
        label: label || address.slice(0, 6) + '...' + address.slice(-4),
        createdAt: now,
        chainBalances: [],
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
      // Get chains to query based on wallet type
      const chains = getChainsForWalletType(wallet.walletType);

      // Fetch wallet summary for all relevant chains
      const summary = await walletService.getWalletSummary(wallet.address, {
        chains,
        useCommonTokensOnly: false,
        filterUnknownTokens: !showUnknownTokens,
      });

      // Convert to chainBalances format
      const chainBalances: ChainBalance[] = summary.chains
        .filter(c =>
          c.nativeBalance.balance.greaterThan(0) ||
          c.tokenBalances.length > 0
        )
        .map(c => ({
          chain: c.chain,
          nativeBalance: c.nativeBalance,
          tokenBalances: c.tokenBalances,
          totalValueUsd: calculateChainValue(c),
        }));

      const totalValueUsd = chainBalances.reduce(
        (sum, cb) => sum.plus(cb.totalValueUsd),
        new Decimal(0)
      );

      // Update state
      set({
        wallets: get().wallets.map((w) =>
          w.id === walletId
            ? {
                ...w,
                chainBalances,
                totalValueUsd,
                isLoading: false,
                lastSync: new Date(),
              }
            : w
        ),
      });

      // Store balances in database
      const db = getDb();
      await db.delete(onchainAssets).where(eq(onchainAssets.walletId, walletId));

      for (const chainBalance of chainBalances) {
        // Store native balance
        if (chainBalance.nativeBalance && chainBalance.nativeBalance.balance.greaterThan(0)) {
          await db.insert(onchainAssets).values({
            id: generateId(),
            walletId,
            tokenSymbol: `${chainBalance.nativeBalance.symbol}:${chainBalance.chain}`,
            balance: chainBalance.nativeBalance.balance.toNumber(),
            decimals: 18,
            updatedAt: new Date(),
          });
        }

        // Store token balances
        for (const token of chainBalance.tokenBalances) {
          await db.insert(onchainAssets).values({
            id: generateId(),
            walletId,
            contractAddress: `${token.token.address}:${chainBalance.chain}`,
            tokenSymbol: token.token.symbol,
            balance: token.balance.toNumber(),
            decimals: token.token.decimals,
            updatedAt: new Date(),
          });
        }
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

  getWalletsByType: (type) => {
    const { wallets: currentWallets } = get();
    return currentWallets.filter((w) => w.walletType === type);
  },
}));

function calculateChainValue(chainData: WalletSummary['chains'][0]): Decimal {
  let total = chainData.nativeBalance.valueUsd || new Decimal(0);

  for (const token of chainData.tokenBalances) {
    if (token.valueUsd) {
      total = total.plus(token.valueUsd);
    }
  }

  return total;
}
