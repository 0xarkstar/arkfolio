import { getDb, generateId } from '../../database/init';
import { portfolioSnapshots } from '../../database/schema';
import { desc, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';

export interface SnapshotData {
  totalValueUsd: Decimal;
  cexValueUsd: Decimal;
  onchainValueUsd: Decimal;
  defiValueUsd: Decimal;
  breakdown?: {
    holdings: Array<{ symbol: string; valueUsd: number }>;
  };
}

export interface PortfolioDataPoint {
  time: string; // YYYY-MM-DD format
  value: number;
}

export type SnapshotPeriod = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

/**
 * Service for managing portfolio snapshots for historical charts
 */
class SnapshotService {
  private static instance: SnapshotService;
  private lastSnapshotDate: Date | null = null;

  private constructor() {}

  static getInstance(): SnapshotService {
    if (!SnapshotService.instance) {
      SnapshotService.instance = new SnapshotService();
    }
    return SnapshotService.instance;
  }

  /**
   * Save a portfolio snapshot
   */
  async saveSnapshot(data: SnapshotData): Promise<void> {
    const db = getDb();
    const now = new Date();

    // Only save one snapshot per day
    const today = this.getDateString(now);
    if (this.lastSnapshotDate && this.getDateString(this.lastSnapshotDate) === today) {
      console.log('Snapshot already saved for today, skipping');
      return;
    }

    try {
      await db.insert(portfolioSnapshots).values({
        id: generateId(),
        timestamp: now,
        totalValueUsd: data.totalValueUsd.toNumber(),
        cexValueUsd: data.cexValueUsd.toNumber(),
        onchainValueUsd: data.onchainValueUsd.toNumber(),
        defiValueUsd: data.defiValueUsd.toNumber(),
        breakdown: data.breakdown ? JSON.stringify(data.breakdown) : null,
      });

      this.lastSnapshotDate = now;
      console.log(`Portfolio snapshot saved: $${data.totalValueUsd.toFixed(2)}`);
    } catch (error) {
      console.error('Failed to save portfolio snapshot:', error);
    }
  }

  /**
   * Get snapshots for a given period
   */
  async getSnapshots(period: SnapshotPeriod): Promise<PortfolioDataPoint[]> {
    const db = getDb();
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '1D':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1W':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'ALL':
      default:
        startDate = new Date(0); // Beginning of time
    }

    try {
      const snapshots = await db
        .select()
        .from(portfolioSnapshots)
        .where(gte(portfolioSnapshots.timestamp, startDate))
        .orderBy(portfolioSnapshots.timestamp);

      return snapshots.map((s) => ({
        time: this.getDateString(new Date(s.timestamp as unknown as number)),
        value: s.totalValueUsd,
      }));
    } catch (error) {
      console.error('Failed to get portfolio snapshots:', error);
      return [];
    }
  }

  /**
   * Get the latest snapshot
   */
  async getLatestSnapshot(): Promise<PortfolioDataPoint | null> {
    const db = getDb();

    try {
      const [snapshot] = await db
        .select()
        .from(portfolioSnapshots)
        .orderBy(desc(portfolioSnapshots.timestamp))
        .limit(1);

      if (!snapshot) return null;

      return {
        time: this.getDateString(new Date(snapshot.timestamp as unknown as number)),
        value: snapshot.totalValueUsd,
      };
    } catch (error) {
      console.error('Failed to get latest snapshot:', error);
      return null;
    }
  }

  /**
   * Check if we need to take a snapshot today
   */
  async shouldTakeSnapshot(): Promise<boolean> {
    const latest = await this.getLatestSnapshot();
    if (!latest) return true;

    const today = this.getDateString(new Date());
    return latest.time !== today;
  }

  /**
   * Clean up old snapshots (keep last 2 years)
   */
  async cleanupOldSnapshots(): Promise<number> {
    const db = getDb();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    try {
      await db
        .delete(portfolioSnapshots)
        .where(lte(portfolioSnapshots.timestamp, twoYearsAgo));

      console.log(`Cleaned up old snapshots`);
      return 0; // Drizzle doesn't return count easily
    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error);
      return 0;
    }
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export const snapshotService = SnapshotService.getInstance();
