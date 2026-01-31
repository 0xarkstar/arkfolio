import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { targetAllocations } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface TargetAllocation {
  id: string;
  asset: string;
  targetPercent: number; // 0-100
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetAllocation {
  asset: string;
  currentValue: Decimal;
  currentPercent: number;
  targetPercent: number;
  difference: number; // targetPercent - currentPercent
  rebalanceAmount: Decimal; // USD amount to buy (positive) or sell (negative)
}

export interface RebalanceSuggestion {
  type: 'buy' | 'sell';
  asset: string;
  amountUsd: Decimal;
  fromPercent: number;
  toPercent: number;
}

interface RebalanceState {
  allocations: TargetAllocation[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  loadAllocations: () => Promise<void>;
  setTargetAllocation: (asset: string, targetPercent: number) => Promise<void>;
  removeAllocation: (id: string) => Promise<void>;
  clearAllAllocations: () => Promise<void>;

  // Calculations
  calculateRebalance: (
    currentHoldings: { symbol: string; valueUsd: Decimal }[],
    totalValue: Decimal
  ) => AssetAllocation[];
  generateSuggestions: (
    currentHoldings: { symbol: string; valueUsd: Decimal }[],
    totalValue: Decimal
  ) => RebalanceSuggestion[];
  getTotalTargetPercent: () => number;
  isValidAllocation: () => boolean;
}

export const useRebalanceStore = create<RebalanceState>((set, get) => ({
  allocations: [],
  isLoading: false,
  isSaving: false,
  error: null,

  loadAllocations: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();
      const dbAllocations = await db
        .select()
        .from(targetAllocations)
        .where(eq(targetAllocations.isActive, true));

      const loaded: TargetAllocation[] = dbAllocations.map((a) => ({
        id: a.id,
        asset: a.asset,
        targetPercent: a.targetPercent,
        isActive: a.isActive ?? true,
        createdAt: a.createdAt ? new Date(a.createdAt as unknown as number) : new Date(),
        updatedAt: a.updatedAt ? new Date(a.updatedAt as unknown as number) : new Date(),
      }));

      set({ allocations: loaded, isLoading: false });
    } catch (error) {
      console.error('Failed to load target allocations:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load allocations',
        isLoading: false,
      });
    }
  },

  setTargetAllocation: async (asset, targetPercent) => {
    set({ isSaving: true, error: null });

    try {
      const db = getDb();
      const { allocations } = get();

      // Check if allocation already exists
      const existing = allocations.find(
        (a) => a.asset.toUpperCase() === asset.toUpperCase()
      );

      if (existing) {
        // Update existing
        await db
          .update(targetAllocations)
          .set({
            targetPercent,
            updatedAt: new Date(),
          })
          .where(eq(targetAllocations.id, existing.id));

        set((state) => ({
          allocations: state.allocations.map((a) =>
            a.id === existing.id
              ? { ...a, targetPercent, updatedAt: new Date() }
              : a
          ),
          isSaving: false,
        }));
      } else {
        // Create new
        const id = generateId();
        await db.insert(targetAllocations).values({
          id,
          asset: asset.toUpperCase(),
          targetPercent,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const newAllocation: TargetAllocation = {
          id,
          asset: asset.toUpperCase(),
          targetPercent,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          allocations: [...state.allocations, newAllocation],
          isSaving: false,
        }));
      }
    } catch (error) {
      console.error('Failed to save target allocation:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save allocation',
        isSaving: false,
      });
    }
  },

  removeAllocation: async (id) => {
    const db = getDb();
    await db.delete(targetAllocations).where(eq(targetAllocations.id, id));

    set((state) => ({
      allocations: state.allocations.filter((a) => a.id !== id),
    }));
  },

  clearAllAllocations: async () => {
    const db = getDb();
    const { allocations } = get();

    for (const allocation of allocations) {
      await db.delete(targetAllocations).where(eq(targetAllocations.id, allocation.id));
    }

    set({ allocations: [] });
  },

  calculateRebalance: (currentHoldings, totalValue) => {
    const { allocations } = get();

    if (totalValue.isZero()) {
      return [];
    }

    const result: AssetAllocation[] = [];

    // Create a map of target allocations
    const targetMap = new Map(
      allocations.map((a) => [a.asset.toUpperCase(), a.targetPercent])
    );

    // Get all unique assets (from both current holdings and targets)
    const allAssets = new Set([
      ...currentHoldings.map((h) => h.symbol.toUpperCase()),
      ...allocations.map((a) => a.asset.toUpperCase()),
    ]);

    for (const asset of allAssets) {
      const holding = currentHoldings.find(
        (h) => h.symbol.toUpperCase() === asset
      );
      const currentValue = holding?.valueUsd || new Decimal(0);
      const currentPercent = currentValue.div(totalValue).times(100).toNumber();
      const targetPercent = targetMap.get(asset) || 0;
      const difference = targetPercent - currentPercent;
      const rebalanceAmount = totalValue.times(difference / 100);

      result.push({
        asset,
        currentValue,
        currentPercent,
        targetPercent,
        difference,
        rebalanceAmount,
      });
    }

    // Sort by difference (largest negative first - sell more, then buy more)
    result.sort((a, b) => a.difference - b.difference);

    return result;
  },

  generateSuggestions: (currentHoldings, totalValue) => {
    const rebalance = get().calculateRebalance(currentHoldings, totalValue);
    const suggestions: RebalanceSuggestion[] = [];

    // Only include assets with significant difference (>1%)
    const threshold = 1;

    for (const item of rebalance) {
      if (Math.abs(item.difference) > threshold) {
        suggestions.push({
          type: item.rebalanceAmount.greaterThan(0) ? 'buy' : 'sell',
          asset: item.asset,
          amountUsd: item.rebalanceAmount.abs(),
          fromPercent: item.currentPercent,
          toPercent: item.targetPercent,
        });
      }
    }

    return suggestions;
  },

  getTotalTargetPercent: () => {
    const { allocations } = get();
    return allocations.reduce((sum, a) => sum + a.targetPercent, 0);
  },

  isValidAllocation: () => {
    const total = get().getTotalTargetPercent();
    return Math.abs(total - 100) < 0.01; // Allow small floating point errors
  },
}));
