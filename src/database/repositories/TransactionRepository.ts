import { eq, and, gte, lte, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import {
  transactions,
  type Transaction,
  type NewTransaction,
} from '../schema';
import { BaseRepository } from './BaseRepository';
import { generateId } from '../init';
import { logger } from '../../utils/logger';

/**
 * Repository for transaction records with duplicate checking
 */
class TransactionRepositoryClass extends BaseRepository<typeof transactions, Transaction, NewTransaction> {
  protected readonly table = transactions;
  protected readonly tableName = 'Transaction';

  /**
   * Find transactions by exchange ID
   */
  async findByExchangeId(exchangeId: string): Promise<Transaction[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(transactions)
        .where(eq(transactions.exchangeId, exchangeId))
        .orderBy(desc(transactions.timestamp));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to find by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Find transactions by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<Transaction[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(transactions)
        .where(eq(transactions.walletAddress, walletAddress.toLowerCase()))
        .orderBy(desc(transactions.timestamp));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to find by wallet address:', error);
      throw error;
    }
  }

  /**
   * Find transactions within a date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(transactions)
        .where(
          and(
            gte(transactions.timestamp, startDate),
            lte(transactions.timestamp, endDate)
          )
        )
        .orderBy(desc(transactions.timestamp));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to find by date range:', error);
      throw error;
    }
  }

  /**
   * Find transactions by type
   */
  async findByType(type: string): Promise<Transaction[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(transactions)
        .where(eq(transactions.type, type))
        .orderBy(desc(transactions.timestamp));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to find by type:', error);
      throw error;
    }
  }

  /**
   * Check if a transaction exists by hash
   */
  async existsByHash(txHash: string): Promise<boolean> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(transactions)
        .where(eq(transactions.txHash, txHash))
        .limit(1);
      return results.length > 0;
    } catch (error) {
      logger.error('[TransactionRepository] Failed to check existence by hash:', error);
      throw error;
    }
  }

  /**
   * Create transaction if it doesn't already exist (idempotent insert)
   * Returns true if created, false if already existed
   */
  async createIfNotExists(data: NewTransaction): Promise<{ created: boolean; transaction: Transaction }> {
    try {
      // Check for existing transaction
      const txHash = data.txHash;
      if (txHash) {
        const exists = await this.existsByHash(txHash);
        if (exists) {
          const existing = await this.findByHash(txHash);
          return { created: false, transaction: existing! };
        }
      }

      const db = this.getDb();
      const id = data.id || generateId();
      const record = { ...data, id };
      await db.insert(transactions).values(record);
      logger.debug(`[TransactionRepository] Created transaction ${id}`);
      return { created: true, transaction: record as Transaction };
    } catch (error) {
      logger.error('[TransactionRepository] Failed to create if not exists:', error);
      throw error;
    }
  }

  /**
   * Find transaction by hash
   */
  async findByHash(txHash: string): Promise<Transaction | null> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(transactions)
        .where(eq(transactions.txHash, txHash))
        .limit(1);
      return results[0] || null;
    } catch (error) {
      logger.error('[TransactionRepository] Failed to find by hash:', error);
      throw error;
    }
  }

  /**
   * Delete transactions by exchange ID
   */
  async deleteByExchangeId(exchangeId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(transactions).where(eq(transactions.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to delete by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Delete transactions by wallet address
   */
  async deleteByWalletAddress(walletAddress: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(transactions).where(eq(transactions.walletAddress, walletAddress.toLowerCase()));
    } catch (error) {
      logger.error('[TransactionRepository] Failed to delete by wallet address:', error);
      throw error;
    }
  }

  /**
   * Get transaction count by exchange ID
   */
  async countByExchangeId(exchangeId: string): Promise<number> {
    try {
      const db = this.getDb();
      const results = await db.select().from(transactions).where(eq(transactions.exchangeId, exchangeId));
      return results.length;
    } catch (error) {
      logger.error('[TransactionRepository] Failed to count by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Transform database transaction to domain model with Decimal types
   */
  toDomainModel(dbTx: Transaction): {
    id: string;
    exchangeId: string | null;
    walletAddress: string | null;
    txHash: string | null;
    type: string;
    asset: string;
    amount: Decimal;
    priceUsd: Decimal | null;
    priceKrw: Decimal | null;
    fee: Decimal | null;
    feeAsset: string | null;
    timestamp: Date;
    rawData: string | null;
    createdAt: Date | null;
  } {
    return {
      id: dbTx.id,
      exchangeId: dbTx.exchangeId,
      walletAddress: dbTx.walletAddress,
      txHash: dbTx.txHash,
      type: dbTx.type,
      asset: dbTx.asset,
      amount: new Decimal(dbTx.amount || 0),
      priceUsd: dbTx.priceUsd ? new Decimal(dbTx.priceUsd) : null,
      priceKrw: dbTx.priceKrw ? new Decimal(dbTx.priceKrw) : null,
      fee: dbTx.fee ? new Decimal(dbTx.fee) : null,
      feeAsset: dbTx.feeAsset,
      timestamp: dbTx.timestamp,
      rawData: dbTx.rawData,
      createdAt: dbTx.createdAt,
    };
  }
}

// Export singleton instance
export const TransactionRepository = new TransactionRepositoryClass();
