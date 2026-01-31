import { create } from 'zustand';
import Decimal from 'decimal.js';
import { priceService, PriceData } from '../services/price';
import { useExchangeStore } from './exchangeStore';
import { logger } from '../utils/logger';

export interface AssetHolding {
  symbol: string;
  name: string;
  totalAmount: Decimal;
  freeAmount: Decimal;
  lockedAmount: Decimal;
  priceUsd: Decimal;
  priceKrw: Decimal;
  valueUsd: Decimal;
  valueKrw: Decimal;
  change24h: number;
  allocation: number; // percentage
  sources: {
    exchangeId: string;
    exchangeName: string;
    amount: Decimal;
    balanceType: string;
  }[];
}

export interface AssetAllocation {
  category: string;
  value: Decimal;
  percent: number;
  color: string;
  assets: string[];
}

export interface PortfolioSummary {
  totalValueUsd: Decimal;
  totalValueKrw: Decimal;
  change24hUsd: Decimal;
  change24hPercent: number;
  totalAssets: number;
  totalExchanges: number;
  totalPositions: number;
}

interface PortfolioState {
  // Portfolio data
  summary: PortfolioSummary;
  holdings: AssetHolding[];
  allocations: AssetAllocation[];
  prices: Map<string, PriceData>;

  // Loading state
  isLoading: boolean;
  lastRefresh: Date | null;
  error: string | null;

  // Actions
  refreshPortfolio: () => Promise<void>;
  refreshPrices: (symbols: string[]) => Promise<void>;
}

// Asset category mapping for allocation chart
const ASSET_CATEGORIES: Record<string, { name: string; color: string }> = {
  BTC: { name: 'Bitcoin', color: 'bg-orange-500' },
  ETH: { name: 'Ethereum', color: 'bg-blue-500' },
  STABLECOIN: { name: 'Stablecoins', color: 'bg-green-500' },
  ALTCOIN: { name: 'Altcoins', color: 'bg-purple-500' },
};

const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX', 'PYUSD']);

// Common asset names
const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether',
  USDC: 'USD Coin',
  BNB: 'BNB',
  XRP: 'XRP',
  SOL: 'Solana',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  TRX: 'TRON',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  MATIC: 'Polygon',
  LINK: 'Chainlink',
  ATOM: 'Cosmos',
  UNI: 'Uniswap',
  LTC: 'Litecoin',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  NEAR: 'NEAR Protocol',
  APT: 'Aptos',
  SUI: 'Sui',
  SEI: 'Sei',
  INJ: 'Injective',
  TIA: 'Celestia',
  PENDLE: 'Pendle',
  DAI: 'Dai',
};

function getAssetName(symbol: string): string {
  return ASSET_NAMES[symbol.toUpperCase()] || symbol;
}

function getAssetCategory(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper === 'BTC') return 'BTC';
  if (upper === 'ETH') return 'ETH';
  if (STABLECOINS.has(upper)) return 'STABLECOIN';
  return 'ALTCOIN';
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  summary: {
    totalValueUsd: new Decimal(0),
    totalValueKrw: new Decimal(0),
    change24hUsd: new Decimal(0),
    change24hPercent: 0,
    totalAssets: 0,
    totalExchanges: 0,
    totalPositions: 0,
  },
  holdings: [],
  allocations: [],
  prices: new Map(),
  isLoading: false,
  lastRefresh: null,
  error: null,

  refreshPrices: async (symbols: string[]) => {
    try {
      const prices = await priceService.getPrices(symbols);
      set({ prices });
    } catch (error) {
      logger.error('Failed to refresh prices:', error);
    }
  },

  refreshPortfolio: async () => {
    set({ isLoading: true, error: null });

    try {
      const exchangeStore = useExchangeStore.getState();
      const { accounts, allBalances, allPositions } = exchangeStore;

      // Collect all unique symbols from balances
      const symbolsSet = new Set<string>();
      allBalances.forEach(balanceList => {
        balanceList.forEach(balance => {
          if (balance.total.greaterThan(0)) {
            symbolsSet.add(balance.asset.toUpperCase());
          }
        });
      });

      const symbols = Array.from(symbolsSet);

      // Fetch prices for all symbols
      const prices = await priceService.getPrices(symbols);

      // Aggregate holdings by symbol
      const holdingsMap = new Map<string, AssetHolding>();

      allBalances.forEach((balanceList, exchangeId) => {
        const account = accounts.find(a => a.id === exchangeId);
        const exchangeName = account?.name || exchangeId;

        balanceList.forEach(balance => {
          const symbol = balance.asset.toUpperCase();
          if (balance.total.lessThanOrEqualTo(0)) return;

          const priceData = prices.get(symbol);
          const priceUsd = priceData?.priceUsd || new Decimal(0);
          const priceKrw = priceData?.priceKrw || new Decimal(0);
          const change24h = priceData?.change24h || 0;

          const existing = holdingsMap.get(symbol);
          if (existing) {
            existing.totalAmount = existing.totalAmount.plus(balance.total);
            existing.freeAmount = existing.freeAmount.plus(balance.free);
            existing.lockedAmount = existing.lockedAmount.plus(balance.locked);
            existing.valueUsd = existing.totalAmount.times(priceUsd);
            existing.valueKrw = existing.totalAmount.times(priceKrw);
            existing.sources.push({
              exchangeId,
              exchangeName,
              amount: balance.total,
              balanceType: balance.balanceType,
            });
          } else {
            holdingsMap.set(symbol, {
              symbol,
              name: getAssetName(symbol),
              totalAmount: balance.total,
              freeAmount: balance.free,
              lockedAmount: balance.locked,
              priceUsd,
              priceKrw,
              valueUsd: balance.total.times(priceUsd),
              valueKrw: balance.total.times(priceKrw),
              change24h,
              allocation: 0, // Will be calculated after
              sources: [{
                exchangeId,
                exchangeName,
                amount: balance.total,
                balanceType: balance.balanceType,
              }],
            });
          }
        });
      });

      // Convert to array and sort by value
      const holdings = Array.from(holdingsMap.values())
        .sort((a, b) => b.valueUsd.minus(a.valueUsd).toNumber());

      // Calculate total value
      const totalValueUsd = holdings.reduce(
        (sum, h) => sum.plus(h.valueUsd),
        new Decimal(0)
      );
      const totalValueKrw = holdings.reduce(
        (sum, h) => sum.plus(h.valueKrw),
        new Decimal(0)
      );

      // Calculate allocations
      holdings.forEach(h => {
        h.allocation = totalValueUsd.greaterThan(0)
          ? h.valueUsd.dividedBy(totalValueUsd).times(100).toNumber()
          : 0;
      });

      // Calculate 24h change (weighted average)
      let weightedChange = new Decimal(0);
      holdings.forEach(h => {
        if (totalValueUsd.greaterThan(0)) {
          const weight = h.valueUsd.dividedBy(totalValueUsd);
          weightedChange = weightedChange.plus(weight.times(h.change24h));
        }
      });

      const change24hPercent = weightedChange.toNumber();
      const change24hUsd = totalValueUsd.times(change24hPercent).dividedBy(100);

      // Calculate asset allocations for chart
      const allocationMap = new Map<string, { value: Decimal; assets: string[] }>();
      holdings.forEach(h => {
        const category = getAssetCategory(h.symbol);
        const existing = allocationMap.get(category);
        if (existing) {
          existing.value = existing.value.plus(h.valueUsd);
          existing.assets.push(h.symbol);
        } else {
          allocationMap.set(category, {
            value: h.valueUsd,
            assets: [h.symbol],
          });
        }
      });

      const allocations: AssetAllocation[] = Array.from(allocationMap.entries())
        .map(([category, data]) => ({
          category: ASSET_CATEGORIES[category]?.name || category,
          value: data.value,
          percent: totalValueUsd.greaterThan(0)
            ? data.value.dividedBy(totalValueUsd).times(100).toNumber()
            : 0,
          color: ASSET_CATEGORIES[category]?.color || 'bg-gray-500',
          assets: data.assets,
        }))
        .sort((a, b) => b.percent - a.percent);

      // Count connected exchanges and positions
      const connectedExchanges = accounts.filter(a => a.isConnected).length;
      const totalPositions = Array.from(allPositions.values())
        .reduce((sum, positions) => sum + positions.length, 0);

      // Update state
      set({
        summary: {
          totalValueUsd,
          totalValueKrw,
          change24hUsd,
          change24hPercent,
          totalAssets: holdings.length,
          totalExchanges: connectedExchanges,
          totalPositions,
        },
        holdings,
        allocations,
        prices,
        isLoading: false,
        lastRefresh: new Date(),
      });
    } catch (error) {
      logger.error('Failed to refresh portfolio:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh portfolio',
        isLoading: false,
      });
    }
  },
}));
