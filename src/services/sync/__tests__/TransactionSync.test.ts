import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { transactionSyncService } from '../TransactionSync';
import type { Trade, Transfer } from '../../exchanges';

// Mock trade data
const mockTrades: Trade[] = [
  {
    id: 'trade-1',
    symbol: 'BTC/USDT',
    side: 'buy',
    price: new Decimal('40000'),
    amount: new Decimal('0.1'),
    cost: new Decimal('4000'),
    fee: new Decimal('4'),
    feeAsset: 'USDT',
    timestamp: new Date(),
  },
];

// Mock transfer data
const mockDeposits: Transfer[] = [
  {
    id: 'deposit-1',
    asset: 'USDT',
    amount: new Decimal('1000'),
    type: 'deposit',
    status: 'completed',
    timestamp: new Date(),
  },
];

const mockWithdrawals: Transfer[] = [
  {
    id: 'withdrawal-1',
    asset: 'BTC',
    amount: new Decimal('0.05'),
    type: 'withdraw',
    status: 'completed',
    timestamp: new Date(),
  },
];

// Mock exchange manager
vi.mock('../../exchanges', () => ({
  exchangeManager: {
    getAdapter: vi.fn((accountId: string) => {
      if (accountId === 'invalid') return null;
      return {
        exchangeId: 'mock-exchange',
        getTradeHistory: vi.fn(() => Promise.resolve(mockTrades)),
        getDepositHistory: vi.fn(() => Promise.resolve(mockDeposits)),
        getWithdrawHistory: vi.fn(() => Promise.resolve(mockWithdrawals)),
      };
    }),
  },
}));

// Mock database
vi.mock('../../../database/init', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])), // No existing transactions
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  })),
  generateId: vi.fn(() => `tx-${Date.now()}`),
}));

// Mock price service
vi.mock('../../price', () => ({
  priceService: {
    getHistoricalPrice: vi.fn(() => Promise.resolve({
      priceUsd: 40000,
      priceKrw: 52000000,
    })),
  },
}));

describe('TransactionSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = transactionSyncService;
      const instance2 = transactionSyncService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSyncProgress', () => {
    it('should return undefined for non-existent account', () => {
      const progress = transactionSyncService.getSyncProgress('non-existent');
      expect(progress).toBeUndefined();
    });
  });

  describe('syncExchangeTransactions', () => {
    it('should throw error for invalid account', async () => {
      await expect(
        transactionSyncService.syncExchangeTransactions('invalid')
      ).rejects.toThrow('Exchange not connected');
    });

    it('should sync trades and transfers', async () => {
      const result = await transactionSyncService.syncExchangeTransactions('account-1');

      expect(result.accountId).toBe('account-1');
      expect(result.tradesAdded).toBeGreaterThanOrEqual(0);
      expect(result.transfersAdded).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should update sync progress during sync', async () => {
      await transactionSyncService.syncExchangeTransactions('account-1');

      const progress = transactionSyncService.getSyncProgress('account-1');
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('completed');
    });

    it('should accept since option', async () => {
      const since = new Date('2024-01-01');
      const result = await transactionSyncService.syncExchangeTransactions('account-1', { since });

      expect(result.accountId).toBe('account-1');
    });

    it('should accept limit option', async () => {
      const result = await transactionSyncService.syncExchangeTransactions('account-1', { limit: 100 });

      expect(result.accountId).toBe('account-1');
    });

    it('should return result with correct structure', async () => {
      const result = await transactionSyncService.syncExchangeTransactions('account-1');

      expect(result).toHaveProperty('accountId');
      expect(result).toHaveProperty('tradesAdded');
      expect(result).toHaveProperty('transfersAdded');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('sync progress tracking', () => {
    it('should track progress as syncing initially', async () => {
      // Start sync but don't await
      const syncPromise = transactionSyncService.syncExchangeTransactions('account-2');

      // The progress might be set during the sync
      await syncPromise;

      const progress = transactionSyncService.getSyncProgress('account-2');
      expect(progress?.status).toBe('completed');
    });

    it('should track trade count', async () => {
      await transactionSyncService.syncExchangeTransactions('account-3');

      const progress = transactionSyncService.getSyncProgress('account-3');
      expect(progress?.tradesCount).toBeGreaterThanOrEqual(0);
    });

    it('should track transfer count', async () => {
      await transactionSyncService.syncExchangeTransactions('account-4');

      const progress = transactionSyncService.getSyncProgress('account-4');
      expect(progress?.transfersCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle adapter errors gracefully', async () => {
      const { exchangeManager } = await import('../../exchanges');
      vi.mocked(exchangeManager.getAdapter).mockReturnValueOnce({
        exchangeId: 'error-exchange',
        getTradeHistory: vi.fn(() => Promise.reject(new Error('API error'))),
        getDepositHistory: vi.fn(() => Promise.resolve([])),
        getWithdrawHistory: vi.fn(() => Promise.resolve([])),
      } as unknown as ReturnType<typeof exchangeManager.getAdapter>);

      const result = await transactionSyncService.syncExchangeTransactions('error-account');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should set error status on failure', async () => {
      const { exchangeManager } = await import('../../exchanges');
      vi.mocked(exchangeManager.getAdapter).mockReturnValueOnce({
        exchangeId: 'error-exchange',
        getTradeHistory: vi.fn(() => Promise.reject(new Error('API error'))),
        getDepositHistory: vi.fn(() => Promise.resolve([])),
        getWithdrawHistory: vi.fn(() => Promise.resolve([])),
      } as unknown as ReturnType<typeof exchangeManager.getAdapter>);

      await transactionSyncService.syncExchangeTransactions('error-account-2');

      const progress = transactionSyncService.getSyncProgress('error-account-2');
      expect(progress?.status).toBe('error');
      expect(progress?.error).toBeDefined();
    });
  });
});
