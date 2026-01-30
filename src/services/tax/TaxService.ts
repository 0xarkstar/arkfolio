import Decimal from 'decimal.js';
import { getDb, generateId } from '../../database/init';
import { transactions, taxReports } from '../../database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export interface TaxableTransaction {
  id: string;
  date: Date;
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'SWAP' | 'REWARD';
  asset: string;
  amount: Decimal;
  priceKrw: Decimal;
  totalKrw: Decimal;
  fee: Decimal;
  feeAsset: string;
  exchangeId: string | null;
  walletAddress: string | null;
  gainLossKrw: Decimal | null; // Only for SELL transactions
  costBasisKrw: Decimal | null; // Cost basis at time of sale
}

export interface AssetLot {
  id: string;
  asset: string;
  amount: Decimal;
  costBasisPerUnit: Decimal; // KRW per unit
  acquiredAt: Date;
  source: string; // exchange id or wallet address
}

export interface TaxSummary {
  year: number;
  totalGainsKrw: Decimal;
  totalLossesKrw: Decimal;
  netGainsKrw: Decimal;
  deductionKrw: Decimal;
  taxableGainsKrw: Decimal;
  estimatedTaxKrw: Decimal;
  totalTransactions: number;
  taxableTransactions: TaxableTransaction[];
}

// Korean tax constants
const TAX_RATE = 0.22; // 22% including local income tax
const DEDUCTION_AMOUNT_2024 = 2500000; // 250만원 for 2024
const DEDUCTION_AMOUNT_2025 = 50000000; // 5000만원 from 2025

class TaxService {
  private static instance: TaxService;
  private assetLots: Map<string, AssetLot[]> = new Map();

  private constructor() {}

  static getInstance(): TaxService {
    if (!TaxService.instance) {
      TaxService.instance = new TaxService();
    }
    return TaxService.instance;
  }

  /**
   * Get the applicable deduction amount for a tax year
   */
  getDeductionAmount(year: number): Decimal {
    return new Decimal(year >= 2025 ? DEDUCTION_AMOUNT_2025 : DEDUCTION_AMOUNT_2024);
  }

  /**
   * Calculate tax summary for a given year using Moving Average Cost Basis
   */
  async calculateTaxSummary(year: number): Promise<TaxSummary> {
    const db = getDb();

    // Get all transactions for the year
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const allTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.timestamp, startOfYear),
          lte(transactions.timestamp, endOfYear)
        )
      )
      .orderBy(transactions.timestamp);

    // Reset asset lots for fresh calculation
    this.assetLots.clear();

    // Also load previous year's transactions to build up cost basis
    const previousYearStart = new Date(year - 5, 0, 1); // Go back 5 years for cost basis
    const previousTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.timestamp, previousYearStart),
          lte(transactions.timestamp, new Date(year - 1, 11, 31, 23, 59, 59))
        )
      )
      .orderBy(transactions.timestamp);

    // Process previous transactions to build up cost basis (but don't count gains/losses)
    for (const tx of previousTransactions) {
      await this.processTransactionForCostBasis(tx);
    }

    // Process current year transactions and calculate gains/losses
    const taxableTransactions: TaxableTransaction[] = [];
    let totalGains = new Decimal(0);
    let totalLosses = new Decimal(0);

    for (const tx of allTransactions) {
      const processed = await this.processTransaction(tx);
      if (processed) {
        taxableTransactions.push(processed);

        if (processed.gainLossKrw) {
          if (processed.gainLossKrw.greaterThan(0)) {
            totalGains = totalGains.plus(processed.gainLossKrw);
          } else {
            totalLosses = totalLosses.plus(processed.gainLossKrw.abs());
          }
        }
      }
    }

    const netGains = totalGains.minus(totalLosses);
    const deduction = this.getDeductionAmount(year);
    const taxableGains = Decimal.max(netGains.minus(deduction), new Decimal(0));
    const estimatedTax = taxableGains.times(TAX_RATE);

    return {
      year,
      totalGainsKrw: totalGains,
      totalLossesKrw: totalLosses,
      netGainsKrw: netGains,
      deductionKrw: deduction,
      taxableGainsKrw: taxableGains,
      estimatedTaxKrw: estimatedTax,
      totalTransactions: allTransactions.length,
      taxableTransactions: taxableTransactions.filter(tx => tx.type === 'SELL'),
    };
  }

  /**
   * Process a transaction for cost basis tracking only (no gain/loss calculation)
   */
  private async processTransactionForCostBasis(tx: typeof transactions.$inferSelect): Promise<void> {
    const amount = new Decimal(tx.amount);
    const priceKrw = tx.priceKrw ? new Decimal(tx.priceKrw) : new Decimal(0);

    if (tx.type === 'buy' || tx.type === 'transfer_in' || tx.type === 'reward' || tx.type === 'airdrop') {
      // Add to cost basis
      this.addAssetLot({
        id: tx.id,
        asset: tx.asset,
        amount,
        costBasisPerUnit: priceKrw,
        acquiredAt: tx.timestamp as Date,
        source: tx.exchangeId || tx.walletAddress || 'unknown',
      });
    } else if (tx.type === 'sell' || tx.type === 'transfer_out') {
      // Remove from cost basis
      this.removeFromLots(tx.asset, amount);
    }
  }

  /**
   * Process a transaction and calculate gain/loss if applicable
   */
  private async processTransaction(tx: typeof transactions.$inferSelect): Promise<TaxableTransaction | null> {
    const amount = new Decimal(tx.amount);
    let priceKrw = tx.priceKrw ? new Decimal(tx.priceKrw) : null;

    // If no KRW price, try to fetch from price service
    if (!priceKrw && tx.priceUsd) {
      // Convert USD to KRW (approximate rate)
      const usdKrwRate = 1350; // Could fetch real rate
      priceKrw = new Decimal(tx.priceUsd).times(usdKrwRate);
    }

    if (!priceKrw) {
      priceKrw = new Decimal(0);
    }

    const totalKrw = amount.times(priceKrw);
    const fee = tx.fee ? new Decimal(tx.fee) : new Decimal(0);

    const baseTransaction: TaxableTransaction = {
      id: tx.id,
      date: tx.timestamp as Date,
      type: this.mapTransactionType(tx.type),
      asset: tx.asset,
      amount,
      priceKrw,
      totalKrw,
      fee,
      feeAsset: tx.feeAsset || tx.asset,
      exchangeId: tx.exchangeId,
      walletAddress: tx.walletAddress,
      gainLossKrw: null,
      costBasisKrw: null,
    };

    if (tx.type === 'buy' || tx.type === 'transfer_in' || tx.type === 'reward' || tx.type === 'airdrop') {
      // Add to cost basis
      this.addAssetLot({
        id: tx.id,
        asset: tx.asset,
        amount,
        costBasisPerUnit: priceKrw,
        acquiredAt: tx.timestamp as Date,
        source: tx.exchangeId || tx.walletAddress || 'unknown',
      });
      return baseTransaction;
    } else if (tx.type === 'sell') {
      // Calculate gain/loss using Moving Average Cost Basis
      const avgCostBasis = this.getAverageCostBasis(tx.asset);
      const costBasisTotal = avgCostBasis.times(amount);
      const gainLoss = totalKrw.minus(costBasisTotal).minus(fee.times(priceKrw));

      // Remove from lots
      this.removeFromLots(tx.asset, amount);

      return {
        ...baseTransaction,
        gainLossKrw: gainLoss,
        costBasisKrw: costBasisTotal,
      };
    } else if (tx.type === 'transfer_out') {
      // Transfer out doesn't trigger taxable event but reduces cost basis
      this.removeFromLots(tx.asset, amount);
      return baseTransaction;
    }

    return baseTransaction;
  }

  /**
   * Map database transaction type to display type
   */
  private mapTransactionType(type: string): TaxableTransaction['type'] {
    switch (type.toLowerCase()) {
      case 'buy': return 'BUY';
      case 'sell': return 'SELL';
      case 'transfer_in': return 'TRANSFER_IN';
      case 'transfer_out': return 'TRANSFER_OUT';
      case 'swap': return 'SWAP';
      case 'reward':
      case 'airdrop': return 'REWARD';
      default: return 'BUY';
    }
  }

  /**
   * Add an asset lot for cost basis tracking
   */
  private addAssetLot(lot: AssetLot): void {
    const lots = this.assetLots.get(lot.asset) || [];
    lots.push(lot);
    this.assetLots.set(lot.asset, lots);
  }

  /**
   * Get the average cost basis for an asset (Moving Average method)
   */
  private getAverageCostBasis(asset: string): Decimal {
    const lots = this.assetLots.get(asset) || [];
    if (lots.length === 0) return new Decimal(0);

    let totalCost = new Decimal(0);
    let totalAmount = new Decimal(0);

    for (const lot of lots) {
      totalCost = totalCost.plus(lot.amount.times(lot.costBasisPerUnit));
      totalAmount = totalAmount.plus(lot.amount);
    }

    if (totalAmount.isZero()) return new Decimal(0);
    return totalCost.div(totalAmount);
  }

  /**
   * Remove amount from lots using FIFO method
   */
  private removeFromLots(asset: string, amount: Decimal): void {
    const lots = this.assetLots.get(asset) || [];
    let remaining = amount;

    while (remaining.greaterThan(0) && lots.length > 0) {
      const lot = lots[0];
      if (lot.amount.lessThanOrEqualTo(remaining)) {
        remaining = remaining.minus(lot.amount);
        lots.shift();
      } else {
        lot.amount = lot.amount.minus(remaining);
        remaining = new Decimal(0);
      }
    }

    this.assetLots.set(asset, lots);
  }

  /**
   * Save tax report to database
   */
  async saveTaxReport(summary: TaxSummary): Promise<string> {
    const db = getDb();
    const id = generateId();

    await db.insert(taxReports).values({
      id,
      year: summary.year,
      totalGainsKrw: summary.totalGainsKrw.toNumber(),
      totalLossesKrw: summary.totalLossesKrw.toNumber(),
      netGainsKrw: summary.netGainsKrw.toNumber(),
      taxableGainsKrw: summary.taxableGainsKrw.toNumber(),
      estimatedTaxKrw: summary.estimatedTaxKrw.toNumber(),
      reportData: JSON.stringify({
        transactions: summary.taxableTransactions.map(tx => ({
          ...tx,
          amount: tx.amount.toString(),
          priceKrw: tx.priceKrw.toString(),
          totalKrw: tx.totalKrw.toString(),
          fee: tx.fee.toString(),
          gainLossKrw: tx.gainLossKrw?.toString(),
          costBasisKrw: tx.costBasisKrw?.toString(),
        })),
      }),
    });

    return id;
  }

  /**
   * Get saved tax report for a year
   */
  async getTaxReport(year: number): Promise<TaxSummary | null> {
    const db = getDb();
    const reports = await db
      .select()
      .from(taxReports)
      .where(eq(taxReports.year, year))
      .orderBy(desc(taxReports.generatedAt))
      .limit(1);

    if (reports.length === 0) return null;

    const report = reports[0];
    const reportData = report.reportData ? JSON.parse(report.reportData) : { transactions: [] };

    return {
      year: report.year,
      totalGainsKrw: new Decimal(report.totalGainsKrw || 0),
      totalLossesKrw: new Decimal(report.totalLossesKrw || 0),
      netGainsKrw: new Decimal(report.netGainsKrw || 0),
      deductionKrw: this.getDeductionAmount(report.year),
      taxableGainsKrw: new Decimal(report.taxableGainsKrw || 0),
      estimatedTaxKrw: new Decimal(report.estimatedTaxKrw || 0),
      totalTransactions: reportData.transactions?.length || 0,
      taxableTransactions: (reportData.transactions || []).map((tx: Record<string, unknown>) => ({
        ...tx,
        date: new Date(tx.date as string),
        amount: new Decimal(tx.amount as string || 0),
        priceKrw: new Decimal(tx.priceKrw as string || 0),
        totalKrw: new Decimal(tx.totalKrw as string || 0),
        fee: new Decimal(tx.fee as string || 0),
        gainLossKrw: tx.gainLossKrw ? new Decimal(tx.gainLossKrw as string) : null,
        costBasisKrw: tx.costBasisKrw ? new Decimal(tx.costBasisKrw as string) : null,
      })),
    };
  }

  /**
   * Export tax report to CSV format for HomeTax
   */
  exportToCSV(summary: TaxSummary): string {
    const headers = [
      '거래일시',
      '거래유형',
      '자산명',
      '거래수량',
      '단가(원)',
      '거래금액(원)',
      '수수료',
      '양도차익(원)',
    ];

    const rows = summary.taxableTransactions.map(tx => [
      tx.date.toISOString().split('T')[0],
      tx.type === 'SELL' ? '매도' : tx.type === 'BUY' ? '매수' : tx.type,
      tx.asset,
      tx.amount.toString(),
      tx.priceKrw.toFixed(0),
      tx.totalKrw.toFixed(0),
      tx.fee.toString(),
      tx.gainLossKrw?.toFixed(0) || '0',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
  }

  /**
   * Get annual summary for Excel export
   */
  getAnnualSummaryData(summary: TaxSummary): Record<string, unknown>[] {
    return [
      { label: '총 양도차익', value: summary.totalGainsKrw.toFixed(0) },
      { label: '총 양도차손', value: summary.totalLossesKrw.toFixed(0) },
      { label: '순 양도차익', value: summary.netGainsKrw.toFixed(0) },
      { label: '기본공제', value: summary.deductionKrw.toFixed(0) },
      { label: '과세표준', value: summary.taxableGainsKrw.toFixed(0) },
      { label: '예상 세액 (22%)', value: summary.estimatedTaxKrw.toFixed(0) },
    ];
  }
}

export const taxService = TaxService.getInstance();
