import Decimal from 'decimal.js';
import { PositionCostBasis, CostBasisEntry } from './constants';

/**
 * Calculator for cost basis and P&L calculations
 */
export class CostBasisCalculator {
  /**
   * Calculate unrealized P&L for an open position
   */
  calculateUnrealizedPnL(
    costBasis: PositionCostBasis,
    currentValueUsd: Decimal
  ): {
    unrealizedPnL: Decimal;
    unrealizedPnLPercent: number;
  } {
    const unrealizedPnL = currentValueUsd.minus(costBasis.totalCostBasisUsd);
    const unrealizedPnLPercent = costBasis.totalCostBasisUsd.greaterThan(0)
      ? unrealizedPnL.dividedBy(costBasis.totalCostBasisUsd).times(100).toNumber()
      : 0;

    return { unrealizedPnL, unrealizedPnLPercent };
  }

  /**
   * Calculate realized P&L for a closed position
   */
  calculateRealizedPnL(
    costBasis: PositionCostBasis,
    exitValueUsd: Decimal
  ): {
    realizedPnL: Decimal;
    realizedPnLPercent: number;
  } {
    const realizedPnL = exitValueUsd.minus(costBasis.totalCostBasisUsd);
    const realizedPnLPercent = costBasis.totalCostBasisUsd.greaterThan(0)
      ? realizedPnL.dividedBy(costBasis.totalCostBasisUsd).times(100).toNumber()
      : 0;

    return { realizedPnL, realizedPnLPercent };
  }

  /**
   * Calculate total cost basis from entries
   */
  calculateTotalCostBasis(entries: CostBasisEntry[]): Decimal {
    return entries.reduce((sum, e) => sum.plus(e.totalCostUsd), new Decimal(0));
  }

  /**
   * Sort entries by date (oldest first)
   */
  sortEntriesByDate(entries: CostBasisEntry[]): CostBasisEntry[] {
    return [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Build a PositionCostBasis from entries
   */
  buildPositionCostBasis(positionId: string, entries: CostBasisEntry[]): PositionCostBasis {
    const sortedEntries = this.sortEntriesByDate(entries);
    const totalCostBasisUsd = this.calculateTotalCostBasis(sortedEntries);
    const firstEntryDate = sortedEntries.length > 0 ? sortedEntries[0].date : null;

    return {
      positionId,
      entries: sortedEntries,
      totalCostBasisUsd,
      firstEntryDate,
    };
  }
}

export const costBasisCalculator = new CostBasisCalculator();
