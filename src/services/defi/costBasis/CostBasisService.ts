import Decimal from 'decimal.js';
import { DefiPosition } from '../../../stores/defiStore';
import { zapperService } from '../ZapperService';
import { logger } from '../../../utils/logger';
import { PositionCostBasis, CostBasisEntry } from './constants';
import { zapperGraphQL, TimelineEventV2 } from './ZapperGraphQL';
import { transactionMatcher } from './TransactionMatcher';
import { costBasisCalculator } from './CostBasisCalculator';

/**
 * Service for calculating cost basis of DeFi positions using Zapper Transaction API
 *
 * Uses Zapper's transactionHistoryV2 query to get human-readable transaction history
 * with interpreted descriptions like "Deposited 1,000 USDC to Aave"
 */
class CostBasisService {
  private static instance: CostBasisService;
  private cachedTransactions: Map<string, TimelineEventV2[]> = new Map();
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): CostBasisService {
    if (!CostBasisService.instance) {
      CostBasisService.instance = new CostBasisService();
    }
    return CostBasisService.instance;
  }

  /**
   * Fetch transaction history from Zapper
   */
  async fetchTransactionHistory(
    walletAddress: string,
    options: { skipCache?: boolean; maxPages?: number } = {}
  ): Promise<TimelineEventV2[]> {
    return zapperGraphQL.fetchTransactionHistory(walletAddress, {
      maxPages: options.maxPages,
      cachedTransactions: this.cachedTransactions,
      cacheTimestamps: this.cacheTimestamps,
      cacheTtlMs: this.cacheTtlMs,
      skipCache: options.skipCache,
    });
  }

  /**
   * Fetch transaction history with progress callback
   */
  async fetchTransactionHistoryWithProgress(
    walletAddress: string,
    _onProgress?: (fetched: number, page: number) => void
  ): Promise<TimelineEventV2[]> {
    return this.fetchTransactionHistory(walletAddress, { skipCache: true });
  }

  /**
   * Calculate cost basis for a DeFi position
   */
  async calculateCostBasis(
    position: DefiPosition,
    walletAddress: string
  ): Promise<PositionCostBasis | null> {
    try {
      const transactions = await this.fetchTransactionHistory(walletAddress);
      const apiKey = zapperService.getApiKey();
      if (!apiKey) {
        throw new Error('Zapper API key not found');
      }

      // Find matched transactions for this position
      const cacheStats = this.getCacheStats();
      logger.debug(`=== Searching transactions for ${position.protocol} (${position.chain}) ===`);
      logger.debug(`[Cache] ${cacheStats.txDetailsCount} tx details cached in localStorage`);

      const matchedTxs = transactionMatcher.findMatchingTransactions(transactions, position);

      if (matchedTxs.length === 0) {
        logger.debug(`No transactions found for ${position.protocol}`);
        return null;
      }

      logger.debug(`Found ${matchedTxs.length} matching transactions, fetching details...`);

      // Fetch details for each matched transaction (limit to first 10)
      const entries: CostBasisEntry[] = [];
      const txsToProcess = matchedTxs.slice(0, 10);

      for (const tx of txsToProcess) {
        const timestamp = new Date(tx.transaction.timestamp * 1000);
        logger.debug(`Fetching details for ${tx.transaction.hash.slice(0, 10)}... (${timestamp.toLocaleDateString()})`);

        const details = await zapperGraphQL.fetchTransactionDetails(
          tx.transaction.hash,
          tx.transaction.network,
          apiKey
        );

        if (details && details.description) {
          if (!transactionMatcher.isEntryTransaction(details.description)) {
            logger.debug(`  -> Not an entry tx: "${details.description.slice(0, 50)}..."`);
            continue;
          }

          logger.debug(`  -> Entry: "${details.description.slice(0, 50)}..."`);
          logger.debug(`  -> Tokens found: ${details.tokens.length}`);

          const entry = this.buildEntryFromDetails(
            details,
            tx.transaction.hash,
            timestamp,
            position
          );

          if (entry) {
            entries.push(entry);
            logger.debug(`  -> Added entry: $${entry.totalCostUsd.toFixed(2)}`);
          } else {
            logger.debug(`  -> Skipped: could not determine cost`);
          }
        }

        // Small delay between detail requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (entries.length === 0) {
        logger.debug(`No entry transactions with cost data found for ${position.protocol}`);
        return null;
      }

      const result = costBasisCalculator.buildPositionCostBasis(position.id, entries);

      logger.debug(`Cost basis for ${position.protocol}:`);
      logger.debug(`  Entries: ${result.entries.length}`);
      logger.debug(`  First entry: ${result.firstEntryDate?.toLocaleDateString()}`);
      logger.debug(`  Total cost: $${result.totalCostBasisUsd.toFixed(2)}`);

      return result;
    } catch (error) {
      logger.error(`Failed to calculate cost basis for position ${position.id}:`, error);
      return null;
    }
  }

  /**
   * Build a cost basis entry from transaction details
   */
  private buildEntryFromDetails(
    details: { description: string; tokens: Array<{ symbol: string; amount: Decimal; priceUsd: number }> },
    txHash: string,
    timestamp: Date,
    position: DefiPosition
  ): CostBasisEntry | null {
    let totalCost = new Decimal(0);
    let mainSymbol = position.assets[0] || 'UNKNOWN';
    let mainAmount = new Decimal(0);
    let mainPrice = 0;

    if (details.tokens.length === 0) {
      // No tokens in API response - try to parse from description
      const parsed = transactionMatcher.parseAmountFromDescription(details.description);
      if (parsed) {
        logger.debug(`  -> Parsed from description: ${parsed.amount} ${parsed.symbol}`);
        mainSymbol = parsed.symbol;
        mainAmount = parsed.amount;
        // Estimate price using current position value ratio
        if (position.amounts[0] && position.amounts[0].greaterThan(0)) {
          mainPrice = position.currentValueUsd.dividedBy(position.amounts[0]).toNumber();
        }
        totalCost = mainAmount.times(mainPrice);
        logger.debug(`  -> Estimated cost: $${totalCost.toFixed(2)} (price: $${mainPrice.toFixed(2)})`);
      }
    } else {
      for (const token of details.tokens) {
        const tokenCost = token.amount.times(token.priceUsd);
        totalCost = totalCost.plus(tokenCost);

        // Use the first significant token as main
        if (mainAmount.isZero() && token.amount.greaterThan(0)) {
          mainSymbol = token.symbol;
          mainAmount = token.amount;
          mainPrice = token.priceUsd;
        }

        logger.debug(`  -> Token: ${token.amount.toFixed(4)} ${token.symbol} @ $${token.priceUsd.toFixed(2)} = $${tokenCost.toFixed(2)}`);
      }
    }

    if (totalCost.greaterThan(0)) {
      return {
        date: timestamp,
        tokenSymbol: mainSymbol,
        amount: mainAmount,
        priceAtTime: mainPrice,
        totalCostUsd: totalCost,
        txHash,
        description: details.description,
      };
    }

    return null;
  }

  /**
   * Calculate cost basis for multiple positions with real-time updates
   */
  async calculateCostBasisBatch(
    positions: DefiPosition[],
    walletAddress: string,
    onProgress?: (completed: number, total: number) => void,
    onPositionCalculated?: (positionId: string, costBasis: PositionCostBasis) => void
  ): Promise<Map<string, PositionCostBasis>> {
    const results = new Map<string, PositionCostBasis>();

    // Fetch transaction history once (it will be cached)
    logger.debug(`[CostBasisService] Fetching transaction history for ${walletAddress}...`);
    await this.fetchTransactionHistory(walletAddress);

    let completed = 0;
    for (const position of positions) {
      logger.debug(`[CostBasisService] Processing position: ${position.protocol} (${position.id})`);
      const costBasis = await this.calculateCostBasis(position, walletAddress);

      if (costBasis) {
        logger.debug(`[CostBasisService] Cost basis found: $${costBasis.totalCostBasisUsd.toFixed(2)}`);
        results.set(position.id, costBasis);
        if (onPositionCalculated) {
          logger.debug(`[CostBasisService] Calling onPositionCalculated callback...`);
          onPositionCalculated(position.id, costBasis);
        }
      } else {
        logger.debug(`[CostBasisService] No cost basis found for ${position.protocol}`);
      }

      completed++;
      onProgress?.(completed, positions.length);
    }

    logger.debug(`[CostBasisService] Batch complete. ${results.size} positions with cost basis.`);
    return results;
  }

  /**
   * Calculate unrealized P&L for an open position
   */
  calculateUnrealizedPnL(
    costBasis: PositionCostBasis,
    currentValueUsd: Decimal
  ): { unrealizedPnL: Decimal; unrealizedPnLPercent: number } {
    return costBasisCalculator.calculateUnrealizedPnL(costBasis, currentValueUsd);
  }

  /**
   * Calculate realized P&L for a closed position
   */
  calculateRealizedPnL(
    costBasis: PositionCostBasis,
    exitValueUsd: Decimal
  ): { realizedPnL: Decimal; realizedPnLPercent: number } {
    return costBasisCalculator.calculateRealizedPnL(costBasis, exitValueUsd);
  }

  /**
   * Clear the transaction cache (memory only)
   */
  clearCache(): void {
    this.cachedTransactions.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Clear all caches including localStorage tx details
   */
  clearAllCaches(): void {
    this.clearCache();
    const cleared = zapperGraphQL.clearTxDetailsCache();
    logger.debug(`Cleared ${cleared} cached transaction details`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { txDetailsCount: number; memoryTxCount: number } {
    return {
      txDetailsCount: zapperGraphQL.getTxDetailsCacheCount(),
      memoryTxCount: this.cachedTransactions.size,
    };
  }
}

export const costBasisService = CostBasisService.getInstance();
