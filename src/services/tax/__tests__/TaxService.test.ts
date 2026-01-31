import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';

// Mock the database
vi.mock('../../../database/init', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
          limit: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  })),
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('../../../database/schema', () => ({
  transactions: {},
  taxReports: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
}));

describe('TaxService', () => {
  let taxService: typeof import('../TaxService').taxService;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../TaxService');
    taxService = module.taxService;
  });

  describe('getDeductionAmount', () => {
    it('should return 2,500,000 KRW for 2024', () => {
      const deduction = taxService.getDeductionAmount(2024);
      expect(deduction.equals(new Decimal(2500000))).toBe(true);
    });

    it('should return 50,000,000 KRW for 2025', () => {
      const deduction = taxService.getDeductionAmount(2025);
      expect(deduction.equals(new Decimal(50000000))).toBe(true);
    });

    it('should return 50,000,000 KRW for years after 2025', () => {
      const deduction = taxService.getDeductionAmount(2026);
      expect(deduction.equals(new Decimal(50000000))).toBe(true);
    });

    it('should return 2,500,000 KRW for years before 2025', () => {
      const deduction = taxService.getDeductionAmount(2023);
      expect(deduction.equals(new Decimal(2500000))).toBe(true);
    });
  });

  describe('exportToCSV', () => {
    it('should generate proper CSV headers', () => {
      const summary = {
        year: 2024,
        totalGainsKrw: new Decimal(1000000),
        totalLossesKrw: new Decimal(100000),
        netGainsKrw: new Decimal(900000),
        deductionKrw: new Decimal(2500000),
        taxableGainsKrw: new Decimal(0),
        estimatedTaxKrw: new Decimal(0),
        totalTransactions: 0,
        taxableTransactions: [],
      };

      const csv = taxService.exportToCSV(summary);
      const headers = csv.split('\n')[0];

      expect(headers).toContain('거래일시');
      expect(headers).toContain('거래유형');
      expect(headers).toContain('자산명');
      expect(headers).toContain('거래수량');
      expect(headers).toContain('단가(원)');
      expect(headers).toContain('거래금액(원)');
      expect(headers).toContain('수수료');
      expect(headers).toContain('양도차익(원)');
    });

    it('should include transaction data in CSV', () => {
      const summary = {
        year: 2024,
        totalGainsKrw: new Decimal(1000000),
        totalLossesKrw: new Decimal(0),
        netGainsKrw: new Decimal(1000000),
        deductionKrw: new Decimal(2500000),
        taxableGainsKrw: new Decimal(0),
        estimatedTaxKrw: new Decimal(0),
        totalTransactions: 1,
        taxableTransactions: [
          {
            id: 'tx1',
            date: new Date('2024-06-15'),
            type: 'SELL' as const,
            asset: 'BTC',
            amount: new Decimal(0.5),
            priceKrw: new Decimal(50000000),
            totalKrw: new Decimal(25000000),
            fee: new Decimal(0.001),
            feeAsset: 'BTC',
            exchangeId: 'binance',
            walletAddress: null,
            gainLossKrw: new Decimal(1000000),
            costBasisKrw: new Decimal(24000000),
          },
        ],
      };

      const csv = taxService.exportToCSV(summary);
      const lines = csv.split('\n');

      expect(lines.length).toBe(2); // Header + 1 transaction
      expect(lines[1]).toContain('2024-06-15');
      expect(lines[1]).toContain('매도');
      expect(lines[1]).toContain('BTC');
    });

    it('should handle empty transactions', () => {
      const summary = {
        year: 2024,
        totalGainsKrw: new Decimal(0),
        totalLossesKrw: new Decimal(0),
        netGainsKrw: new Decimal(0),
        deductionKrw: new Decimal(2500000),
        taxableGainsKrw: new Decimal(0),
        estimatedTaxKrw: new Decimal(0),
        totalTransactions: 0,
        taxableTransactions: [],
      };

      const csv = taxService.exportToCSV(summary);
      const lines = csv.split('\n');

      expect(lines.length).toBe(1); // Only header
    });
  });

  describe('getAnnualSummaryData', () => {
    it('should return formatted summary data', () => {
      const summary = {
        year: 2024,
        totalGainsKrw: new Decimal(10000000),
        totalLossesKrw: new Decimal(1000000),
        netGainsKrw: new Decimal(9000000),
        deductionKrw: new Decimal(2500000),
        taxableGainsKrw: new Decimal(6500000),
        estimatedTaxKrw: new Decimal(1430000),
        totalTransactions: 10,
        taxableTransactions: [],
      };

      const data = taxService.getAnnualSummaryData(summary);

      expect(data.length).toBe(6);
      expect(data[0]).toEqual({ label: '총 양도차익', value: '10000000' });
      expect(data[1]).toEqual({ label: '총 양도차손', value: '1000000' });
      expect(data[2]).toEqual({ label: '순 양도차익', value: '9000000' });
      expect(data[3]).toEqual({ label: '기본공제', value: '2500000' });
      expect(data[4]).toEqual({ label: '과세표준', value: '6500000' });
      expect(data[5]).toEqual({ label: '예상 세액 (22%)', value: '1430000' });
    });

    it('should handle zero values', () => {
      const summary = {
        year: 2024,
        totalGainsKrw: new Decimal(0),
        totalLossesKrw: new Decimal(0),
        netGainsKrw: new Decimal(0),
        deductionKrw: new Decimal(2500000),
        taxableGainsKrw: new Decimal(0),
        estimatedTaxKrw: new Decimal(0),
        totalTransactions: 0,
        taxableTransactions: [],
      };

      const data = taxService.getAnnualSummaryData(summary);

      expect(data[0]).toEqual({ label: '총 양도차익', value: '0' });
      expect(data[4]).toEqual({ label: '과세표준', value: '0' });
      expect(data[5]).toEqual({ label: '예상 세액 (22%)', value: '0' });
    });
  });

  describe('calculateTaxSummary', () => {
    it('should return a valid tax summary structure', async () => {
      const summary = await taxService.calculateTaxSummary(2024);

      expect(summary).toHaveProperty('year', 2024);
      expect(summary).toHaveProperty('totalGainsKrw');
      expect(summary).toHaveProperty('totalLossesKrw');
      expect(summary).toHaveProperty('netGainsKrw');
      expect(summary).toHaveProperty('deductionKrw');
      expect(summary).toHaveProperty('taxableGainsKrw');
      expect(summary).toHaveProperty('estimatedTaxKrw');
      expect(summary).toHaveProperty('totalTransactions');
      expect(summary).toHaveProperty('taxableTransactions');
    });

    it('should return Decimal instances for monetary values', async () => {
      const summary = await taxService.calculateTaxSummary(2024);

      expect(summary.totalGainsKrw).toBeInstanceOf(Decimal);
      expect(summary.totalLossesKrw).toBeInstanceOf(Decimal);
      expect(summary.netGainsKrw).toBeInstanceOf(Decimal);
      expect(summary.deductionKrw).toBeInstanceOf(Decimal);
      expect(summary.taxableGainsKrw).toBeInstanceOf(Decimal);
      expect(summary.estimatedTaxKrw).toBeInstanceOf(Decimal);
    });

    it('should use 2024 deduction amount for 2024', async () => {
      const summary = await taxService.calculateTaxSummary(2024);
      expect(summary.deductionKrw.equals(new Decimal(2500000))).toBe(true);
    });
  });
});
