import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { defiPositions, points, wallets } from '../database/schema';
import { eq } from 'drizzle-orm';
import { zapperService, costBasisService } from '../services/defi';
import { logger } from '../utils/logger';

export interface DefiPosition {
  id: string;
  walletId: string;
  protocol: string;
  positionType: 'lp' | 'lending' | 'borrowing' | 'staking' | 'vault' | 'pt' | 'yt' | 'restaking';
  poolAddress: string | null;
  assets: string[];
  amounts: Decimal[];
  costBasisUsd: Decimal;
  currentValueUsd: Decimal;
  rewardsEarned: Record<string, Decimal>;
  apy: number | null;
  maturityDate: Date | null;
  healthFactor: number | null;
  chain: string;
  entryDate: Date | null;
  updatedAt: Date;
}

export interface PositionPnL {
  unrealizedPnL: Decimal;
  unrealizedPnLPercent: number;
  hasCostBasis: boolean;
}

export interface PointsBalance {
  id: string;
  protocol: string;
  walletAddress: string;
  pointsBalance: Decimal;
  estimatedValueUsd: Decimal | null;
  lastSync: Date | null;
}

interface DefiState {
  positions: DefiPosition[];
  pointsBalances: PointsBalance[];
  isLoading: boolean;
  isSyncing: boolean;
  isCalculatingCostBasis: boolean;
  error: string | null;
  lastZapperSync: Date | null;

  // Actions
  loadPositions: () => Promise<void>;
  loadPoints: () => Promise<void>;
  addPosition: (position: Omit<DefiPosition, 'id' | 'updatedAt'>) => Promise<string>;
  updatePosition: (id: string, updates: Partial<DefiPosition>) => Promise<void>;
  removePosition: (id: string) => Promise<void>;
  addPoints: (points: Omit<PointsBalance, 'id'>) => Promise<string>;
  updatePoints: (id: string, balance: Decimal, estimatedValue?: Decimal) => Promise<void>;
  refreshAll: () => Promise<void>;

  // Zapper auto-detection
  syncFromZapper: () => Promise<void>;
  isZapperConfigured: () => boolean;

  // Cost Basis
  calculateCostBasisForPosition: (positionId: string, walletAddress: string) => Promise<void>;
  calculateAllCostBasis: (walletAddress: string) => Promise<void>;

  // Getters
  getTotalValueUsd: () => Decimal;
  getTotalCostBasisUsd: () => Decimal;
  getTotalUnrealizedPnL: () => { pnl: Decimal; percent: number };
  getAverageApy: () => number;
  getPositionsByProtocol: (protocol: string) => DefiPosition[];
  getPositionsByType: (type: DefiPosition['positionType']) => DefiPosition[];
  getLowestHealthFactor: () => { position: DefiPosition; value: number } | null;
  getPositionPnL: (positionId: string) => PositionPnL | null;
}

export const useDefiStore = create<DefiState>((set, get) => ({
  positions: [],
  pointsBalances: [],
  isLoading: false,
  isSyncing: false,
  isCalculatingCostBasis: false,
  error: null,
  lastZapperSync: null,

  loadPositions: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();
      const dbPositions = await db.select().from(defiPositions);

      const loadedPositions: DefiPosition[] = dbPositions.map((p) => ({
        id: p.id,
        walletId: p.walletId || '',
        protocol: p.protocol,
        positionType: (p.positionType || 'vault') as DefiPosition['positionType'],
        poolAddress: p.poolAddress,
        assets: (() => {
          try { return p.assets ? JSON.parse(p.assets) : []; }
          catch { return []; }
        })(),
        amounts: (() => {
          try { return p.amounts ? JSON.parse(p.amounts).map((a: string) => new Decimal(a)) : []; }
          catch { return []; }
        })(),
        costBasisUsd: new Decimal(p.costBasisUsd || 0),
        currentValueUsd: new Decimal(p.currentValueUsd || 0),
        rewardsEarned: (() => {
          try {
            return p.rewardsEarned
              ? Object.fromEntries(
                  Object.entries(JSON.parse(p.rewardsEarned)).map(([k, v]) => [k, new Decimal(v as string)])
                )
              : {};
          } catch { return {}; }
        })(),
        apy: p.apy,
        maturityDate: p.maturityDate ? new Date(p.maturityDate as unknown as number) : null,
        healthFactor: p.healthFactor,
        chain: (p as Record<string, unknown>).chain as string || 'Ethereum',
        entryDate: (p as Record<string, unknown>).entryDate ? new Date((p as Record<string, unknown>).entryDate as number) : null,
        updatedAt: p.updatedAt ? new Date(p.updatedAt as unknown as number) : new Date(),
      }));

      set({ positions: loadedPositions, isLoading: false });
    } catch (error) {
      logger.error('Failed to load DeFi positions:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load positions',
        isLoading: false,
      });
    }
  },

  loadPoints: async () => {
    try {
      const db = getDb();
      const dbPoints = await db.select().from(points);

      const loadedPoints: PointsBalance[] = dbPoints.map((p) => ({
        id: p.id,
        protocol: p.protocol,
        walletAddress: p.walletAddress || '',
        pointsBalance: new Decimal(p.pointsBalance || 0),
        estimatedValueUsd: p.estimatedValueUsd ? new Decimal(p.estimatedValueUsd) : null,
        lastSync: p.lastSync ? new Date(p.lastSync as unknown as number) : null,
      }));

      set({ pointsBalances: loadedPoints });
    } catch (error) {
      logger.error('Failed to load points:', error);
    }
  },

  addPosition: async (position) => {
    const db = getDb();
    const id = generateId();

    await db.insert(defiPositions).values({
      id,
      walletId: position.walletId,
      protocol: position.protocol,
      positionType: position.positionType,
      poolAddress: position.poolAddress,
      assets: JSON.stringify(position.assets),
      amounts: JSON.stringify(position.amounts.map((a) => a.toString())),
      costBasisUsd: position.costBasisUsd.toNumber(),
      currentValueUsd: position.currentValueUsd.toNumber(),
      rewardsEarned: JSON.stringify(
        Object.fromEntries(
          Object.entries(position.rewardsEarned).map(([k, v]) => [k, v.toString()])
        )
      ),
      apy: position.apy,
      maturityDate: position.maturityDate,
      healthFactor: position.healthFactor,
      updatedAt: new Date(),
    });

    const newPosition: DefiPosition = {
      ...position,
      id,
      updatedAt: new Date(),
    };

    set((state) => ({
      positions: [...state.positions, newPosition],
    }));

    return id;
  },

  updatePosition: async (id, updates) => {
    const db = getDb();
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.currentValueUsd) dbUpdates.currentValueUsd = updates.currentValueUsd.toNumber();
    if (updates.costBasisUsd) dbUpdates.costBasisUsd = updates.costBasisUsd.toNumber();
    if (updates.apy !== undefined) dbUpdates.apy = updates.apy;
    if (updates.healthFactor !== undefined) dbUpdates.healthFactor = updates.healthFactor;
    if (updates.entryDate !== undefined) dbUpdates.entryDate = updates.entryDate;
    if (updates.rewardsEarned) {
      dbUpdates.rewardsEarned = JSON.stringify(
        Object.fromEntries(
          Object.entries(updates.rewardsEarned).map(([k, v]) => [k, v.toString()])
        )
      );
    }

    await db.update(defiPositions).set(dbUpdates).where(eq(defiPositions.id, id));

    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
      ),
    }));
  },

  removePosition: async (id) => {
    const db = getDb();
    await db.delete(defiPositions).where(eq(defiPositions.id, id));

    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    }));
  },

  addPoints: async (pointsData) => {
    const db = getDb();
    const id = generateId();

    await db.insert(points).values({
      id,
      protocol: pointsData.protocol,
      walletAddress: pointsData.walletAddress,
      pointsBalance: pointsData.pointsBalance.toNumber(),
      estimatedValueUsd: pointsData.estimatedValueUsd?.toNumber(),
      lastSync: pointsData.lastSync,
    });

    const newPoints: PointsBalance = { ...pointsData, id };

    set((state) => ({
      pointsBalances: [...state.pointsBalances, newPoints],
    }));

    return id;
  },

  updatePoints: async (id, balance, estimatedValue) => {
    const db = getDb();
    const updates: Record<string, unknown> = {
      pointsBalance: balance.toNumber(),
      lastSync: new Date(),
    };
    if (estimatedValue) updates.estimatedValueUsd = estimatedValue.toNumber();

    await db.update(points).set(updates).where(eq(points.id, id));

    set((state) => ({
      pointsBalances: state.pointsBalances.map((p) =>
        p.id === id
          ? {
              ...p,
              pointsBalance: balance,
              estimatedValueUsd: estimatedValue || p.estimatedValueUsd,
              lastSync: new Date(),
            }
          : p
      ),
    }));
  },

  refreshAll: async () => {
    await Promise.all([get().loadPositions(), get().loadPoints()]);
  },

  isZapperConfigured: () => {
    return zapperService.isConfigured();
  },

  syncFromZapper: async () => {
    if (!zapperService.isConfigured()) {
      throw new Error('Zapper API not configured. Please set your API key in Settings.');
    }

    set({ isSyncing: true, error: null });

    try {
      // Get all wallets from database
      const db = getDb();
      const storedWallets = await db.select().from(wallets);

      if (storedWallets.length === 0) {
        set({ isSyncing: false });
        return;
      }

      // Fetch positions from Zapper for all wallets
      const walletData = storedWallets.map((w) => ({
        address: w.address,
        id: w.id,
      }));

      const zapperPositions = await zapperService.getPositionsForWallets(walletData);

      // Clear existing auto-detected positions (keep manual ones)
      const { positions: currentPositions } = get();
      const manualPositions = currentPositions.filter((p) => p.walletId === 'manual');

      // Delete auto-detected positions from database
      for (const position of currentPositions) {
        if (position.walletId !== 'manual' && position.id.startsWith('zapper-')) {
          try {
            await db.delete(defiPositions).where(eq(defiPositions.id, position.id));
          } catch {
            // Position might not exist in DB
          }
        }
      }

      // Save new positions to database
      for (const position of zapperPositions) {
        await db.insert(defiPositions).values({
          id: position.id,
          walletId: position.walletId,
          protocol: position.protocol,
          positionType: position.positionType,
          poolAddress: position.poolAddress,
          chain: position.chain,
          assets: JSON.stringify(position.assets),
          amounts: JSON.stringify(position.amounts.map((a) => a.toString())),
          costBasisUsd: position.costBasisUsd.toNumber(),
          currentValueUsd: position.currentValueUsd.toNumber(),
          rewardsEarned: JSON.stringify(
            Object.fromEntries(
              Object.entries(position.rewardsEarned).map(([k, v]) => [k, v.toString()])
            )
          ),
          apy: position.apy,
          maturityDate: position.maturityDate,
          healthFactor: position.healthFactor,
          entryDate: position.entryDate,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: defiPositions.id,
          set: {
            currentValueUsd: position.currentValueUsd.toNumber(),
            chain: position.chain,
            apy: position.apy,
            healthFactor: position.healthFactor,
            updatedAt: new Date(),
          },
        });
      }

      // Combine manual and auto-detected positions
      const allPositions = [...manualPositions, ...zapperPositions];

      set({
        positions: allPositions,
        isSyncing: false,
        lastZapperSync: new Date(),
      });
    } catch (error) {
      logger.error('Failed to sync from Zapper:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to sync DeFi positions',
        isSyncing: false,
      });
      throw error;
    }
  },

  getTotalValueUsd: () => {
    const { positions } = get();
    return positions.reduce((sum, p) => sum.plus(p.currentValueUsd), new Decimal(0));
  },

  getAverageApy: () => {
    const { positions } = get();
    const positionsWithApy = positions.filter((p) => p.apy && p.apy > 0);
    if (positionsWithApy.length === 0) return 0;
    return positionsWithApy.reduce((sum, p) => sum + (p.apy || 0), 0) / positionsWithApy.length;
  },

  getPositionsByProtocol: (protocol) => {
    const { positions } = get();
    return positions.filter((p) => p.protocol.toLowerCase() === protocol.toLowerCase());
  },

  getPositionsByType: (type) => {
    const { positions } = get();
    return positions.filter((p) => p.positionType === type);
  },

  getLowestHealthFactor: () => {
    const { positions } = get();
    const positionsWithHealth = positions.filter((p) => p.healthFactor !== null);
    if (positionsWithHealth.length === 0) return null;

    const lowest = positionsWithHealth.reduce((min, p) =>
      (p.healthFactor || Infinity) < (min.healthFactor || Infinity) ? p : min
    );

    return { position: lowest, value: lowest.healthFactor || 0 };
  },

  // Cost Basis Calculation
  calculateCostBasisForPosition: async (positionId: string, walletAddress: string) => {
    const { positions, updatePosition } = get();
    const position = positions.find((p) => p.id === positionId);

    if (!position) {
      logger.warn(`Position ${positionId} not found`);
      return;
    }

    set({ isCalculatingCostBasis: true });

    try {
      const costBasisResult = await costBasisService.calculateCostBasis(position, walletAddress);

      if (costBasisResult && costBasisResult.totalCostBasisUsd.greaterThan(0)) {
        await updatePosition(positionId, {
          costBasisUsd: costBasisResult.totalCostBasisUsd,
          entryDate: costBasisResult.firstEntryDate,
        });
      }
    } catch (error) {
      logger.error(`Failed to calculate cost basis for position ${positionId}:`, error);
    } finally {
      set({ isCalculatingCostBasis: false });
    }
  },

  calculateAllCostBasis: async (walletAddress: string) => {
    const { positions, updatePosition } = get();

    logger.debug('========== STARTING COST BASIS CALCULATION ==========');
    logger.debug(`Wallet: ${walletAddress}`);
    logger.debug(`Positions to process: ${positions.length}`);

    set({ isCalculatingCostBasis: true });

    try {
      // Use real-time callback to update each position immediately
      await costBasisService.calculateCostBasisBatch(
        positions,
        walletAddress,
        (completed, total) => {
          logger.debug(`Progress: ${completed}/${total} positions processed`);
        },
        // Real-time update callback - updates UI immediately when each position is calculated
        async (positionId, costBasis) => {
          logger.debug(`>>> CALLBACK: Position ${positionId}`);
          logger.debug(`    Cost basis: $${costBasis.totalCostBasisUsd.toFixed(2)}`);
          logger.debug(`    Entry date: ${costBasis.firstEntryDate?.toLocaleDateString() || 'N/A'}`);

          if (costBasis.totalCostBasisUsd.greaterThan(0)) {
            logger.debug(`    -> Updating position in store...`);
            await updatePosition(positionId, {
              costBasisUsd: costBasis.totalCostBasisUsd,
              entryDate: costBasis.firstEntryDate,
            });
            logger.debug(`    -> Position updated!`);
          } else {
            logger.debug(`    -> Skipped (cost basis is 0)`);
          }
        }
      );
    } catch (error) {
      logger.error('Failed to calculate cost basis:', error);
    } finally {
      set({ isCalculatingCostBasis: false });
      logger.debug('========== COST BASIS CALCULATION COMPLETE ==========');
    }
  },

  // P&L Getters
  getTotalCostBasisUsd: () => {
    const { positions } = get();
    return positions.reduce((sum, p) => sum.plus(p.costBasisUsd), new Decimal(0));
  },

  getTotalUnrealizedPnL: () => {
    const { positions } = get();
    const totalValue = positions.reduce((sum, p) => sum.plus(p.currentValueUsd), new Decimal(0));
    const totalCost = positions.reduce((sum, p) => sum.plus(p.costBasisUsd), new Decimal(0));

    const pnl = totalValue.minus(totalCost);
    const percent = totalCost.greaterThan(0)
      ? pnl.dividedBy(totalCost).times(100).toNumber()
      : 0;

    return { pnl, percent };
  },

  getPositionPnL: (positionId: string) => {
    const { positions } = get();
    const position = positions.find((p) => p.id === positionId);

    if (!position) return null;

    const hasCostBasis = position.costBasisUsd.greaterThan(0);
    const unrealizedPnL = position.currentValueUsd.minus(position.costBasisUsd);
    const unrealizedPnLPercent = hasCostBasis
      ? unrealizedPnL.dividedBy(position.costBasisUsd).times(100).toNumber()
      : 0;

    return {
      unrealizedPnL,
      unrealizedPnLPercent,
      hasCostBasis,
    };
  },
}));
