import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { defiPositions, points } from '../database/schema';
import { eq } from 'drizzle-orm';

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
  updatedAt: Date;
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
  error: string | null;

  // Actions
  loadPositions: () => Promise<void>;
  loadPoints: () => Promise<void>;
  addPosition: (position: Omit<DefiPosition, 'id' | 'updatedAt'>) => Promise<string>;
  updatePosition: (id: string, updates: Partial<DefiPosition>) => Promise<void>;
  removePosition: (id: string) => Promise<void>;
  addPoints: (points: Omit<PointsBalance, 'id'>) => Promise<string>;
  updatePoints: (id: string, balance: Decimal, estimatedValue?: Decimal) => Promise<void>;
  refreshAll: () => Promise<void>;

  // Getters
  getTotalValueUsd: () => Decimal;
  getAverageApy: () => number;
  getPositionsByProtocol: (protocol: string) => DefiPosition[];
  getPositionsByType: (type: DefiPosition['positionType']) => DefiPosition[];
  getLowestHealthFactor: () => { position: DefiPosition; value: number } | null;
}

export const useDefiStore = create<DefiState>((set, get) => ({
  positions: [],
  pointsBalances: [],
  isLoading: false,
  error: null,

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
        assets: p.assets ? JSON.parse(p.assets) : [],
        amounts: p.amounts ? JSON.parse(p.amounts).map((a: string) => new Decimal(a)) : [],
        costBasisUsd: new Decimal(p.costBasisUsd || 0),
        currentValueUsd: new Decimal(p.currentValueUsd || 0),
        rewardsEarned: p.rewardsEarned
          ? Object.fromEntries(
              Object.entries(JSON.parse(p.rewardsEarned)).map(([k, v]) => [k, new Decimal(v as string)])
            )
          : {},
        apy: p.apy,
        maturityDate: p.maturityDate ? new Date(p.maturityDate as unknown as number) : null,
        healthFactor: p.healthFactor,
        chain: 'ethereum', // Default, could be stored in DB
        updatedAt: p.updatedAt ? new Date(p.updatedAt as unknown as number) : new Date(),
      }));

      set({ positions: loadedPositions, isLoading: false });
    } catch (error) {
      console.error('Failed to load DeFi positions:', error);
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
      console.error('Failed to load points:', error);
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
    if (updates.apy !== undefined) dbUpdates.apy = updates.apy;
    if (updates.healthFactor !== undefined) dbUpdates.healthFactor = updates.healthFactor;
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
}));
