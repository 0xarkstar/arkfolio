import { getDb, generateId } from '../../database/init';
import { transactions } from '../../database/schema';
import { exchangeManager, Trade, Transfer } from '../exchanges';
import { priceService } from '../price';
import { eq, and } from 'drizzle-orm';

interface SyncProgress {
  exchangeId: string;
  accountId: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  tradesCount: number;
  transfersCount: number;
  error?: string;
}

interface SyncResult {
  accountId: string;
  tradesAdded: number;
  transfersAdded: number;
  errors: string[];
}

class TransactionSyncService {
  private static instance: TransactionSyncService;
  private syncProgress: Map<string, SyncProgress> = new Map();

  private constructor() {}

  static getInstance(): TransactionSyncService {
    if (!TransactionSyncService.instance) {
      TransactionSyncService.instance = new TransactionSyncService();
    }
    return TransactionSyncService.instance;
  }

  /**
   * Get sync progress for an account
   */
  getSyncProgress(accountId: string): SyncProgress | undefined {
    return this.syncProgress.get(accountId);
  }

  /**
   * Sync transactions for a specific exchange account
   */
  async syncExchangeTransactions(
    accountId: string,
    options: { since?: Date; limit?: number } = {}
  ): Promise<SyncResult> {
    const adapter = exchangeManager.getAdapter(accountId);
    if (!adapter) {
      throw new Error('Exchange not connected');
    }

    const result: SyncResult = {
      accountId,
      tradesAdded: 0,
      transfersAdded: 0,
      errors: [],
    };

    // Update progress
    this.syncProgress.set(accountId, {
      exchangeId: adapter.exchangeId,
      accountId,
      status: 'syncing',
      tradesCount: 0,
      transfersCount: 0,
    });

    try {
      const since = options.since?.getTime();
      const limit = options.limit || 500;

      // Fetch trades
      const trades = await adapter.getTradeHistory({ since, limit });
      for (const trade of trades) {
        try {
          await this.storeTrade(accountId, trade);
          result.tradesAdded++;
        } catch (error) {
          result.errors.push(`Trade ${trade.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update progress
      this.syncProgress.set(accountId, {
        ...this.syncProgress.get(accountId)!,
        tradesCount: result.tradesAdded,
      });

      // Fetch deposits
      const deposits = await adapter.getDepositHistory({ since, limit });
      for (const deposit of deposits) {
        try {
          await this.storeTransfer(accountId, deposit, 'transfer_in');
          result.transfersAdded++;
        } catch (error) {
          result.errors.push(`Deposit ${deposit.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Fetch withdrawals
      const withdrawals = await adapter.getWithdrawHistory({ since, limit });
      for (const withdrawal of withdrawals) {
        try {
          await this.storeTransfer(accountId, withdrawal, 'transfer_out');
          result.transfersAdded++;
        } catch (error) {
          result.errors.push(`Withdrawal ${withdrawal.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update progress
      this.syncProgress.set(accountId, {
        ...this.syncProgress.get(accountId)!,
        status: 'completed',
        transfersCount: result.transfersAdded,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      result.errors.push(errorMessage);

      this.syncProgress.set(accountId, {
        ...this.syncProgress.get(accountId)!,
        status: 'error',
        error: errorMessage,
      });
    }

    return result;
  }

  /**
   * Store a trade in the database
   */
  private async storeTrade(accountId: string, trade: Trade): Promise<void> {
    const db = getDb();

    // Check if trade already exists
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.exchangeId, accountId),
          eq(transactions.txHash, trade.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return; // Skip duplicate
    }

    // Get price data
    const priceData = await priceService.getPrice(trade.symbol.split('/')[0]);
    const usdKrwRate = await priceService.getUsdKrwRate();

    const priceUsd = trade.price.toNumber();
    const priceKrw = priceData?.priceKrw.toNumber() || priceUsd * usdKrwRate.toNumber();

    await db.insert(transactions).values({
      id: generateId(),
      exchangeId: accountId,
      txHash: trade.id,
      type: trade.side,
      asset: trade.symbol.split('/')[0],
      amount: trade.amount.toNumber(),
      priceUsd,
      priceKrw,
      fee: trade.fee.toNumber(),
      feeAsset: trade.feeAsset,
      timestamp: trade.timestamp,
      rawData: JSON.stringify(trade),
      createdAt: new Date(),
    });
  }

  /**
   * Store a transfer (deposit/withdrawal) in the database
   */
  private async storeTransfer(
    accountId: string,
    transfer: Transfer,
    type: 'transfer_in' | 'transfer_out'
  ): Promise<void> {
    const db = getDb();

    // Check if transfer already exists
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.exchangeId, accountId),
          eq(transactions.txHash, transfer.txHash || transfer.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return; // Skip duplicate
    }

    // Get price data at time of transfer
    const priceData = await priceService.getPrice(transfer.asset);
    const usdKrwRate = await priceService.getUsdKrwRate();

    const priceUsd = priceData?.priceUsd.toNumber() || 0;
    const priceKrw = priceData?.priceKrw.toNumber() || priceUsd * usdKrwRate.toNumber();

    await db.insert(transactions).values({
      id: generateId(),
      exchangeId: accountId,
      txHash: transfer.txHash || transfer.id,
      type,
      asset: transfer.asset,
      amount: transfer.amount.toNumber(),
      priceUsd,
      priceKrw,
      fee: transfer.fee?.toNumber() || 0,
      feeAsset: transfer.asset,
      timestamp: transfer.timestamp,
      rawData: JSON.stringify(transfer),
      createdAt: new Date(),
    });
  }

  /**
   * Sync all connected exchanges
   */
  async syncAllExchanges(
    accountIds: string[],
    options: { since?: Date; limit?: number } = {}
  ): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    for (const accountId of accountIds) {
      try {
        const result = await this.syncExchangeTransactions(accountId, options);
        results.set(accountId, result);
      } catch (error) {
        results.set(accountId, {
          accountId,
          tradesAdded: 0,
          transfersAdded: 0,
          errors: [error instanceof Error ? error.message : 'Sync failed'],
        });
      }
    }

    return results;
  }

  /**
   * Get transaction count for an account
   */
  async getTransactionCount(accountId: string): Promise<number> {
    const db = getDb();
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.exchangeId, accountId));
    return result.length;
  }

  /**
   * Get last sync timestamp for an account
   */
  async getLastSyncTimestamp(accountId: string): Promise<Date | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.exchangeId, accountId))
      .orderBy(transactions.timestamp)
      .limit(1);

    if (result.length > 0 && result[0].timestamp) {
      return result[0].timestamp as Date;
    }
    return null;
  }
}

export const transactionSyncService = TransactionSyncService.getInstance();
