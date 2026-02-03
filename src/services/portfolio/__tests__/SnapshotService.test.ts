import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { snapshotService, SnapshotData, SnapshotPeriod } from '../SnapshotService';

// Mock database
const mockSnapshots: Array<{
  id: string;
  timestamp: Date;
  totalValueUsd: number;
  cexValueUsd: number;
  onchainValueUsd: number;
  defiValueUsd: number;
  breakdown: string | null;
}> = [];

vi.mock('../../../database/init', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(mockSnapshots)),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockSnapshots.slice(0, 1))),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((data) => {
        mockSnapshots.push(data);
        return Promise.resolve();
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
  generateId: vi.fn(() => `snapshot-${Date.now()}`),
}));

describe('SnapshotService', () => {
  beforeEach(() => {
    // Clear mock snapshots
    mockSnapshots.length = 0;
    vi.clearAllMocks();
    // Reset singleton state by clearing last snapshot date
    // @ts-expect-error - accessing private property for testing
    snapshotService.lastSnapshotDate = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = snapshotService;
      const instance2 = snapshotService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('saveSnapshot', () => {
    it('should save a snapshot with correct data', async () => {
      const snapshotData: SnapshotData = {
        totalValueUsd: new Decimal(100000),
        cexValueUsd: new Decimal(60000),
        onchainValueUsd: new Decimal(30000),
        defiValueUsd: new Decimal(10000),
      };

      await snapshotService.saveSnapshot(snapshotData);

      expect(mockSnapshots.length).toBe(1);
      expect(mockSnapshots[0].totalValueUsd).toBe(100000);
      expect(mockSnapshots[0].cexValueUsd).toBe(60000);
      expect(mockSnapshots[0].onchainValueUsd).toBe(30000);
      expect(mockSnapshots[0].defiValueUsd).toBe(10000);
    });

    it('should save snapshot with breakdown', async () => {
      const snapshotData: SnapshotData = {
        totalValueUsd: new Decimal(100000),
        cexValueUsd: new Decimal(60000),
        onchainValueUsd: new Decimal(30000),
        defiValueUsd: new Decimal(10000),
        breakdown: {
          holdings: [
            { symbol: 'BTC', valueUsd: 60000 },
            { symbol: 'ETH', valueUsd: 40000 },
          ],
        },
      };

      await snapshotService.saveSnapshot(snapshotData);

      expect(mockSnapshots[0].breakdown).not.toBeNull();
      const breakdown = JSON.parse(mockSnapshots[0].breakdown!);
      expect(breakdown.holdings.length).toBe(2);
    });

    it('should not save duplicate snapshot on same day', async () => {
      const snapshotData: SnapshotData = {
        totalValueUsd: new Decimal(100000),
        cexValueUsd: new Decimal(60000),
        onchainValueUsd: new Decimal(30000),
        defiValueUsd: new Decimal(10000),
      };

      await snapshotService.saveSnapshot(snapshotData);
      await snapshotService.saveSnapshot(snapshotData);

      expect(mockSnapshots.length).toBe(1);
    });
  });

  describe('getSnapshots', () => {
    beforeEach(() => {
      // Add some test snapshots
      const now = new Date();
      mockSnapshots.push(
        {
          id: 'snap-1',
          timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          totalValueUsd: 90000,
          cexValueUsd: 50000,
          onchainValueUsd: 30000,
          defiValueUsd: 10000,
          breakdown: null,
        },
        {
          id: 'snap-2',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          totalValueUsd: 95000,
          cexValueUsd: 55000,
          onchainValueUsd: 30000,
          defiValueUsd: 10000,
          breakdown: null,
        },
        {
          id: 'snap-3',
          timestamp: now,
          totalValueUsd: 100000,
          cexValueUsd: 60000,
          onchainValueUsd: 30000,
          defiValueUsd: 10000,
          breakdown: null,
        }
      );
    });

    it('should return snapshots for 1D period', async () => {
      const snapshots = await snapshotService.getSnapshots('1D');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return snapshots for 1W period', async () => {
      const snapshots = await snapshotService.getSnapshots('1W');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return snapshots for 1M period', async () => {
      const snapshots = await snapshotService.getSnapshots('1M');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return snapshots for 3M period', async () => {
      const snapshots = await snapshotService.getSnapshots('3M');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return snapshots for 1Y period', async () => {
      const snapshots = await snapshotService.getSnapshots('1Y');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return snapshots for ALL period', async () => {
      const snapshots = await snapshotService.getSnapshots('ALL');
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should format data points correctly', async () => {
      const snapshots = await snapshotService.getSnapshots('1M');
      if (snapshots.length > 0) {
        expect(snapshots[0]).toHaveProperty('time');
        expect(snapshots[0]).toHaveProperty('value');
        expect(typeof snapshots[0].time).toBe('string');
        expect(typeof snapshots[0].value).toBe('number');
      }
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return null when no snapshots exist', async () => {
      const latest = await snapshotService.getLatestSnapshot();
      expect(latest).toBeNull();
    });

    it('should return latest snapshot when exists', async () => {
      mockSnapshots.push({
        id: 'snap-1',
        timestamp: new Date(),
        totalValueUsd: 100000,
        cexValueUsd: 60000,
        onchainValueUsd: 30000,
        defiValueUsd: 10000,
        breakdown: null,
      });

      const latest = await snapshotService.getLatestSnapshot();
      expect(latest).not.toBeNull();
      expect(latest?.value).toBe(100000);
    });
  });

  describe('shouldTakeSnapshot', () => {
    it('should return true when no snapshots exist', async () => {
      const should = await snapshotService.shouldTakeSnapshot();
      expect(should).toBe(true);
    });

    it('should return false when snapshot exists for today', async () => {
      mockSnapshots.push({
        id: 'snap-1',
        timestamp: new Date(),
        totalValueUsd: 100000,
        cexValueUsd: 60000,
        onchainValueUsd: 30000,
        defiValueUsd: 10000,
        breakdown: null,
      });

      const should = await snapshotService.shouldTakeSnapshot();
      expect(should).toBe(false);
    });

    it('should return true when latest snapshot is from yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      mockSnapshots.push({
        id: 'snap-1',
        timestamp: yesterday,
        totalValueUsd: 100000,
        cexValueUsd: 60000,
        onchainValueUsd: 30000,
        defiValueUsd: 10000,
        breakdown: null,
      });

      const should = await snapshotService.shouldTakeSnapshot();
      expect(should).toBe(true);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should call delete on database', async () => {
      const { getDb } = await import('../../../database/init');
      const result = await snapshotService.cleanupOldSnapshots();

      expect(getDb).toHaveBeenCalled();
      expect(typeof result).toBe('number');
    });
  });

  describe('period calculations', () => {
    const periods: SnapshotPeriod[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

    periods.forEach((period) => {
      it(`should handle ${period} period correctly`, async () => {
        const snapshots = await snapshotService.getSnapshots(period);
        expect(Array.isArray(snapshots)).toBe(true);
      });
    });
  });
});
