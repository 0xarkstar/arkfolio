import { create } from 'zustand';
import Decimal from 'decimal.js';

export interface AssetBalance {
  asset: string;
  free: Decimal;
  locked: Decimal;
  total: Decimal;
  valueUsd: Decimal;
}

export interface PortfolioSummary {
  cexBalances: AssetBalance[];
  onchainBalances: AssetBalance[];
  defiPositions: AssetBalance[];
}

interface PortfolioState {
  totalValueUsd: number;
  totalPnl: number;
  totalPnlPercent: number;
  cexAssets: AssetBalance[];
  onchainAssets: AssetBalance[];
  defiAssets: AssetBalance[];
  isLoading: boolean;

  // Actions
  setTotalValue: (value: number) => void;
  setTotalPnl: (pnl: number, percent: number) => void;
  setCexAssets: (assets: AssetBalance[]) => void;
  setOnchainAssets: (assets: AssetBalance[]) => void;
  setDefiAssets: (assets: AssetBalance[]) => void;
  setLoading: (loading: boolean) => void;
  refreshPortfolio: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  totalValueUsd: 0,
  totalPnl: 0,
  totalPnlPercent: 0,
  cexAssets: [],
  onchainAssets: [],
  defiAssets: [],
  isLoading: false,

  setTotalValue: (value) => set({ totalValueUsd: value }),
  setTotalPnl: (pnl, percent) => set({ totalPnl: pnl, totalPnlPercent: percent }),
  setCexAssets: (assets) => set({ cexAssets: assets }),
  setOnchainAssets: (assets) => set({ onchainAssets: assets }),
  setDefiAssets: (assets) => set({ defiAssets: assets }),
  setLoading: (loading) => set({ isLoading: loading }),

  refreshPortfolio: async () => {
    const { setLoading } = get();
    setLoading(true);

    try {
      // TODO: Implement portfolio refresh logic
      // This will aggregate data from all connected exchanges and wallets
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    } finally {
      setLoading(false);
    }
  },
}));
