import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';

// Mock dependencies
vi.mock('../../database/init', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn().mockResolvedValue([]),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('../../services/defi', () => ({
  zapperService: {
    isConfigured: vi.fn(() => false),
    getPositionsForWallets: vi.fn().mockResolvedValue([]),
  },
  costBasisService: {
    calculateCostBasis: vi.fn().mockResolvedValue(null),
    calculateCostBasisBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

// Import after mocks
import { useDefiStore } from '../defiStore';

describe('defiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useDefiStore.setState({
      positions: [],
      pointsBalances: [],
      isLoading: false,
      isSyncing: false,
      isCalculatingCostBasis: false,
      error: null,
      lastZapperSync: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty positions array', () => {
      const { positions } = useDefiStore.getState();
      expect(positions).toEqual([]);
    });

    it('should have empty points balances array', () => {
      const { pointsBalances } = useDefiStore.getState();
      expect(pointsBalances).toEqual([]);
    });

    it('should not be loading', () => {
      const { isLoading } = useDefiStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should not be syncing', () => {
      const { isSyncing } = useDefiStore.getState();
      expect(isSyncing).toBe(false);
    });

    it('should have no error', () => {
      const { error } = useDefiStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('getTotalValueUsd', () => {
    it('should return zero for empty positions', () => {
      const { getTotalValueUsd } = useDefiStore.getState();
      expect(getTotalValueUsd().toNumber()).toBe(0);
    });

    it('should sum all position values', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1000)),
          createMockPosition('2', new Decimal(2000)),
          createMockPosition('3', new Decimal(3000)),
        ],
      });

      const { getTotalValueUsd } = useDefiStore.getState();
      expect(getTotalValueUsd().toNumber()).toBe(6000);
    });

    it('should handle decimal precision', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal('1000.123456789')),
          createMockPosition('2', new Decimal('2000.987654321')),
        ],
      });

      const { getTotalValueUsd } = useDefiStore.getState();
      expect(getTotalValueUsd().toNumber()).toBeCloseTo(3001.11111111, 5);
    });
  });

  describe('getTotalCostBasisUsd', () => {
    it('should return zero for empty positions', () => {
      const { getTotalCostBasisUsd } = useDefiStore.getState();
      expect(getTotalCostBasisUsd().toNumber()).toBe(0);
    });

    it('should sum all cost basis values', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1000), new Decimal(800)),
          createMockPosition('2', new Decimal(2000), new Decimal(1500)),
        ],
      });

      const { getTotalCostBasisUsd } = useDefiStore.getState();
      expect(getTotalCostBasisUsd().toNumber()).toBe(2300);
    });
  });

  describe('getTotalUnrealizedPnL', () => {
    it('should return zero for empty positions', () => {
      const { getTotalUnrealizedPnL } = useDefiStore.getState();
      const result = getTotalUnrealizedPnL();
      expect(result.pnl.toNumber()).toBe(0);
      expect(result.percent).toBe(0);
    });

    it('should calculate positive PnL', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1500), new Decimal(1000)),
        ],
      });

      const { getTotalUnrealizedPnL } = useDefiStore.getState();
      const result = getTotalUnrealizedPnL();
      expect(result.pnl.toNumber()).toBe(500);
      expect(result.percent).toBe(50);
    });

    it('should calculate negative PnL', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(800), new Decimal(1000)),
        ],
      });

      const { getTotalUnrealizedPnL } = useDefiStore.getState();
      const result = getTotalUnrealizedPnL();
      expect(result.pnl.toNumber()).toBe(-200);
      expect(result.percent).toBe(-20);
    });

    it('should aggregate across multiple positions', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1200), new Decimal(1000)),
          createMockPosition('2', new Decimal(1800), new Decimal(2000)),
        ],
      });

      const { getTotalUnrealizedPnL } = useDefiStore.getState();
      const result = getTotalUnrealizedPnL();
      expect(result.pnl.toNumber()).toBe(0);
      expect(result.percent).toBe(0);
    });
  });

  describe('getAverageApy', () => {
    it('should return zero for empty positions', () => {
      const { getAverageApy } = useDefiStore.getState();
      expect(getAverageApy()).toBe(0);
    });

    it('should calculate average APY', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1000), new Decimal(1000), 10),
          createMockPosition('2', new Decimal(2000), new Decimal(2000), 20),
        ],
      });

      const { getAverageApy } = useDefiStore.getState();
      expect(getAverageApy()).toBe(15);
    });

    it('should ignore positions with zero or null APY', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1000), new Decimal(1000), 10),
          createMockPosition('2', new Decimal(2000), new Decimal(2000), 0),
          createMockPosition('3', new Decimal(3000), new Decimal(3000), null),
        ],
      });

      const { getAverageApy } = useDefiStore.getState();
      expect(getAverageApy()).toBe(10);
    });
  });

  describe('getPositionsByProtocol', () => {
    it('should filter positions by protocol name', () => {
      useDefiStore.setState({
        positions: [
          { ...createMockPosition('1', new Decimal(1000)), protocol: 'Aave' },
          { ...createMockPosition('2', new Decimal(2000)), protocol: 'Compound' },
          { ...createMockPosition('3', new Decimal(3000)), protocol: 'Aave' },
        ],
      });

      const { getPositionsByProtocol } = useDefiStore.getState();
      const aavePositions = getPositionsByProtocol('aave');
      expect(aavePositions).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      useDefiStore.setState({
        positions: [
          { ...createMockPosition('1', new Decimal(1000)), protocol: 'AAVE' },
        ],
      });

      const { getPositionsByProtocol } = useDefiStore.getState();
      expect(getPositionsByProtocol('aave')).toHaveLength(1);
      expect(getPositionsByProtocol('Aave')).toHaveLength(1);
      expect(getPositionsByProtocol('AAVE')).toHaveLength(1);
    });
  });

  describe('getPositionsByType', () => {
    it('should filter positions by type', () => {
      useDefiStore.setState({
        positions: [
          { ...createMockPosition('1', new Decimal(1000)), positionType: 'lending' },
          { ...createMockPosition('2', new Decimal(2000)), positionType: 'lp' },
          { ...createMockPosition('3', new Decimal(3000)), positionType: 'lending' },
        ],
      });

      const { getPositionsByType } = useDefiStore.getState();
      expect(getPositionsByType('lending')).toHaveLength(2);
      expect(getPositionsByType('lp')).toHaveLength(1);
    });
  });

  describe('getLowestHealthFactor', () => {
    it('should return null for positions without health factors', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1000)),
          createMockPosition('2', new Decimal(2000)),
        ],
      });

      const { getLowestHealthFactor } = useDefiStore.getState();
      expect(getLowestHealthFactor()).toBeNull();
    });

    it('should return position with lowest health factor', () => {
      useDefiStore.setState({
        positions: [
          { ...createMockPosition('1', new Decimal(1000)), healthFactor: 2.5 },
          { ...createMockPosition('2', new Decimal(2000)), healthFactor: 1.5 },
          { ...createMockPosition('3', new Decimal(3000)), healthFactor: 3.0 },
        ],
      });

      const { getLowestHealthFactor } = useDefiStore.getState();
      const result = getLowestHealthFactor();
      expect(result).not.toBeNull();
      expect(result?.value).toBe(1.5);
      expect(result?.position.id).toBe('2');
    });
  });

  describe('getPositionPnL', () => {
    it('should return null for non-existent position', () => {
      const { getPositionPnL } = useDefiStore.getState();
      expect(getPositionPnL('non-existent')).toBeNull();
    });

    it('should calculate PnL for a position', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1500), new Decimal(1000)),
        ],
      });

      const { getPositionPnL } = useDefiStore.getState();
      const result = getPositionPnL('1');
      expect(result).not.toBeNull();
      expect(result?.unrealizedPnL.toNumber()).toBe(500);
      expect(result?.unrealizedPnLPercent).toBe(50);
      expect(result?.hasCostBasis).toBe(true);
    });

    it('should indicate when cost basis is missing', () => {
      useDefiStore.setState({
        positions: [
          createMockPosition('1', new Decimal(1500), new Decimal(0)),
        ],
      });

      const { getPositionPnL } = useDefiStore.getState();
      const result = getPositionPnL('1');
      expect(result).not.toBeNull();
      expect(result?.hasCostBasis).toBe(false);
      expect(result?.unrealizedPnLPercent).toBe(0);
    });
  });

  describe('isZapperConfigured', () => {
    it('should return zapper configuration status', () => {
      const { isZapperConfigured } = useDefiStore.getState();
      expect(typeof isZapperConfigured()).toBe('boolean');
    });
  });
});

// Helper function to create mock positions
function createMockPosition(
  id: string,
  currentValueUsd: Decimal,
  costBasisUsd: Decimal = new Decimal(0),
  apy: number | null = null
) {
  return {
    id,
    walletId: 'test-wallet',
    protocol: 'TestProtocol',
    positionType: 'lending' as const,
    poolAddress: null,
    assets: ['ETH'],
    amounts: [new Decimal(1)],
    costBasisUsd,
    currentValueUsd,
    rewardsEarned: {},
    apy,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    entryDate: null,
    updatedAt: new Date(),
  };
}
