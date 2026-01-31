import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';

// Mock the dependencies
vi.mock('../ZapperService', () => ({
  zapperService: {
    isConfigured: vi.fn(() => true),
    getApiKey: vi.fn(() => 'test-api-key'),
  },
}));

vi.mock('../../utils/httpUtils', () => ({
  httpWithRetry: vi.fn((fn) => fn()),
}));

// Import after mocks
import { costBasisService } from '../CostBasisService';

describe('CostBasisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    costBasisService.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = costBasisService;
      const instance2 = costBasisService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('should calculate positive unrealized PnL correctly', () => {
      const costBasis = {
        positionId: 'test-1',
        entries: [],
        totalCostBasisUsd: new Decimal(1000),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal(1500);

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(500);
      expect(result.unrealizedPnLPercent).toBe(50);
    });

    it('should calculate negative unrealized PnL correctly', () => {
      const costBasis = {
        positionId: 'test-2',
        entries: [],
        totalCostBasisUsd: new Decimal(1000),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal(800);

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(-200);
      expect(result.unrealizedPnLPercent).toBe(-20);
    });

    it('should handle zero cost basis', () => {
      const costBasis = {
        positionId: 'test-3',
        entries: [],
        totalCostBasisUsd: new Decimal(0),
        firstEntryDate: null,
      };
      const currentValueUsd = new Decimal(1000);

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(1000);
      expect(result.unrealizedPnLPercent).toBe(0);
    });

    it('should handle break-even scenario', () => {
      const costBasis = {
        positionId: 'test-4',
        entries: [],
        totalCostBasisUsd: new Decimal(1000),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal(1000);

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(0);
      expect(result.unrealizedPnLPercent).toBe(0);
    });
  });

  describe('calculateRealizedPnL', () => {
    it('should calculate positive realized PnL correctly', () => {
      const costBasis = {
        positionId: 'test-5',
        entries: [],
        totalCostBasisUsd: new Decimal(5000),
        firstEntryDate: new Date(),
      };
      const exitValueUsd = new Decimal(7500);

      const result = costBasisService.calculateRealizedPnL(costBasis, exitValueUsd);

      expect(result.realizedPnL.toNumber()).toBe(2500);
      expect(result.realizedPnLPercent).toBe(50);
    });

    it('should calculate negative realized PnL correctly', () => {
      const costBasis = {
        positionId: 'test-6',
        entries: [],
        totalCostBasisUsd: new Decimal(5000),
        firstEntryDate: new Date(),
      };
      const exitValueUsd = new Decimal(4000);

      const result = costBasisService.calculateRealizedPnL(costBasis, exitValueUsd);

      expect(result.realizedPnL.toNumber()).toBe(-1000);
      expect(result.realizedPnLPercent).toBe(-20);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = costBasisService.getCacheStats();

      expect(stats).toHaveProperty('txDetailsCount');
      expect(stats).toHaveProperty('memoryTxCount');
      expect(typeof stats.txDetailsCount).toBe('number');
      expect(typeof stats.memoryTxCount).toBe('number');
    });
  });

  describe('clearCache', () => {
    it('should clear memory cache', () => {
      costBasisService.clearCache();
      const stats = costBasisService.getCacheStats();

      expect(stats.memoryTxCount).toBe(0);
    });
  });

  describe('PnL calculations with Decimal precision', () => {
    it('should maintain precision with small numbers', () => {
      const costBasis = {
        positionId: 'test-7',
        entries: [],
        totalCostBasisUsd: new Decimal('0.00001'),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal('0.00002');

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toString()).toBe('0.00001');
      expect(result.unrealizedPnLPercent).toBe(100);
    });

    it('should maintain precision with large numbers', () => {
      const costBasis = {
        positionId: 'test-8',
        entries: [],
        totalCostBasisUsd: new Decimal('1000000000'),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal('1500000000');

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(500000000);
      expect(result.unrealizedPnLPercent).toBe(50);
    });

    it('should handle fractional percentages', () => {
      const costBasis = {
        positionId: 'test-9',
        entries: [],
        totalCostBasisUsd: new Decimal('1000'),
        firstEntryDate: new Date(),
      };
      const currentValueUsd = new Decimal('1001');

      const result = costBasisService.calculateUnrealizedPnL(costBasis, currentValueUsd);

      expect(result.unrealizedPnL.toNumber()).toBe(1);
      expect(result.unrealizedPnLPercent).toBeCloseTo(0.1, 5);
    });
  });
});
