/**
 * Impermanent Loss (IL) Calculation Service
 *
 * Provides IL calculation for LP (Liquidity Provider) positions.
 * Impermanent Loss occurs when the price ratio of tokens in a liquidity pool
 * changes compared to when the liquidity was provided.
 *
 * IL Formula:
 * IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
 *
 * Where priceRatio = currentPrice / entryPrice
 */

import Decimal from 'decimal.js';
import { DefiPosition } from '../../stores/defiStore';
import { logger } from '../../utils/logger';
import { toDecimal, isZero } from '../../utils/decimal';

export interface ILCalculationResult {
  positionId: string;
  impermanentLoss: Decimal;       // IL percentage as decimal (e.g., -0.05 for 5% loss)
  impermanentLossUsd: Decimal;    // Estimated IL in USD
  priceRatio: Decimal;            // Current price / Entry price
  hodlValueUsd: Decimal;          // What position would be worth if just held
  currentValueUsd: Decimal;       // Current LP position value
  tokens: {
    symbol: string;
    entryPrice: number;
    currentPrice: number;
    priceChange: number;          // Percentage change
  }[];
}

export interface LiquidationRisk {
  positionId: string;
  healthFactor: number;
  riskLevel: 'safe' | 'moderate' | 'high' | 'critical';
  liquidationPrice?: Decimal;
  currentPrice?: Decimal;
  distanceToLiquidation?: number;  // Percentage distance
}

export interface YieldHistoryPoint {
  timestamp: Date;
  valueUsd: Decimal;
  yieldEarned: Decimal;
  apy: number;
}

/**
 * Calculate Impermanent Loss for a given price ratio
 *
 * @param priceRatio - The ratio of current price to entry price (currentPrice / entryPrice)
 * @returns IL as a decimal (negative value indicates loss)
 */
export function calculateIL(priceRatio: Decimal | number): Decimal {
  const ratio = toDecimal(priceRatio);

  if (ratio.lessThanOrEqualTo(0)) {
    return new Decimal(0);
  }

  // IL = 2 * sqrt(r) / (1 + r) - 1
  const sqrtRatio = ratio.sqrt();
  const il = sqrtRatio.times(2).dividedBy(ratio.plus(1)).minus(1);

  return il;
}

/**
 * Calculate IL percentage (as a percentage, not decimal)
 */
export function calculateILPercent(priceRatio: Decimal | number): number {
  return calculateIL(priceRatio).times(100).toNumber();
}

/**
 * Calculate the HODL value (what tokens would be worth if just held)
 *
 * @param entryAmounts - Amount of each token at entry
 * @param currentPrices - Current price of each token in USD
 */
export function calculateHodlValue(
  entryAmounts: (Decimal | number)[],
  currentPrices: (Decimal | number)[]
): Decimal {
  if (entryAmounts.length !== currentPrices.length) {
    return new Decimal(0);
  }

  let sum = new Decimal(0);
  for (let i = 0; i < entryAmounts.length; i++) {
    const amountDecimal = toDecimal(entryAmounts[i]);
    const priceDecimal = toDecimal(currentPrices[i]);
    sum = sum.plus(amountDecimal.times(priceDecimal));
  }
  return sum;
}

class ImpermanentLossService {
  private static instance: ImpermanentLossService;

  private constructor() {}

  static getInstance(): ImpermanentLossService {
    if (!ImpermanentLossService.instance) {
      ImpermanentLossService.instance = new ImpermanentLossService();
    }
    return ImpermanentLossService.instance;
  }

  /**
   * Calculate Impermanent Loss for an LP position
   *
   * @param position - The DeFi position
   * @param entryPrices - Token prices at time of entry (in USD)
   * @param currentPrices - Current token prices (in USD)
   */
  calculatePositionIL(
    position: DefiPosition,
    entryPrices: number[],
    currentPrices: number[]
  ): ILCalculationResult | null {
    if (position.positionType !== 'lp') {
      logger.debug(`Position ${position.id} is not an LP position`);
      return null;
    }

    if (position.assets.length < 2) {
      logger.debug(`LP position ${position.id} needs at least 2 assets`);
      return null;
    }

    if (entryPrices.length !== currentPrices.length || entryPrices.length !== position.assets.length) {
      logger.debug(`Price arrays don't match asset count for position ${position.id}`);
      return null;
    }

    // For 2-token LP, calculate price ratio of token1/token0
    const entryPrice0 = toDecimal(entryPrices[0]);
    const entryPrice1 = toDecimal(entryPrices[1]);
    const currentPrice0 = toDecimal(currentPrices[0]);
    const currentPrice1 = toDecimal(currentPrices[1]);

    if (isZero(entryPrice0) || isZero(entryPrice1) || isZero(currentPrice0)) {
      logger.debug(`Zero prices detected for position ${position.id}`);
      return null;
    }

    // Entry price ratio (token1/token0)
    const entryRatio = entryPrice1.dividedBy(entryPrice0);
    // Current price ratio (token1/token0)
    const currentRatio = currentPrice1.dividedBy(currentPrice0);

    // Price ratio change
    const priceRatioChange = currentRatio.dividedBy(entryRatio);

    // Calculate IL
    const il = calculateIL(priceRatioChange);

    // Calculate HODL value (what position would be worth if just held tokens)
    const hodlValueUsd = calculateHodlValue(
      position.amounts.map(a => a),
      currentPrices
    );

    // Calculate IL in USD
    const currentValueUsd = position.currentValueUsd;
    const ilUsd = currentValueUsd.minus(hodlValueUsd);

    // Build token info
    const tokens = position.assets.map((symbol, i) => ({
      symbol,
      entryPrice: entryPrices[i],
      currentPrice: currentPrices[i],
      priceChange: entryPrices[i] > 0
        ? ((currentPrices[i] - entryPrices[i]) / entryPrices[i]) * 100
        : 0,
    }));

    logger.debug(`IL calculated for ${position.protocol}: ${il.times(100).toFixed(2)}%`);

    return {
      positionId: position.id,
      impermanentLoss: il,
      impermanentLossUsd: ilUsd,
      priceRatio: priceRatioChange,
      hodlValueUsd,
      currentValueUsd,
      tokens,
    };
  }

  /**
   * Calculate liquidation risk for borrowing positions
   */
  calculateLiquidationRisk(position: DefiPosition): LiquidationRisk | null {
    if (position.positionType !== 'borrowing' && position.healthFactor === null) {
      return null;
    }

    const healthFactor = position.healthFactor ?? Infinity;
    let riskLevel: LiquidationRisk['riskLevel'];

    if (healthFactor >= 2) {
      riskLevel = 'safe';
    } else if (healthFactor >= 1.5) {
      riskLevel = 'moderate';
    } else if (healthFactor >= 1.1) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    // Distance to liquidation (liquidation occurs at health factor = 1)
    const distanceToLiquidation = healthFactor > 1
      ? ((healthFactor - 1) / healthFactor) * 100
      : 0;

    return {
      positionId: position.id,
      healthFactor,
      riskLevel,
      distanceToLiquidation,
    };
  }

  /**
   * Get IL for multiple LP positions
   */
  calculateBatchIL(
    positions: DefiPosition[],
    priceData: Map<string, { entryPrice: number; currentPrice: number }>
  ): Map<string, ILCalculationResult> {
    const results = new Map<string, ILCalculationResult>();

    for (const position of positions) {
      if (position.positionType !== 'lp') continue;

      const entryPrices: number[] = [];
      const currentPrices: number[] = [];
      let hasAllPrices = true;

      for (const asset of position.assets) {
        const prices = priceData.get(asset.toUpperCase());
        if (!prices) {
          hasAllPrices = false;
          break;
        }
        entryPrices.push(prices.entryPrice);
        currentPrices.push(prices.currentPrice);
      }

      if (!hasAllPrices) {
        logger.debug(`Missing price data for position ${position.id}`);
        continue;
      }

      const ilResult = this.calculatePositionIL(position, entryPrices, currentPrices);
      if (ilResult) {
        results.set(position.id, ilResult);
      }
    }

    return results;
  }

  /**
   * Get total IL across all LP positions
   */
  getTotalIL(ilResults: Map<string, ILCalculationResult>): {
    totalILUsd: Decimal;
    averageILPercent: number;
    positionCount: number;
  } {
    let totalILUsd = new Decimal(0);
    let totalILPercent = new Decimal(0);
    let count = 0;

    ilResults.forEach(result => {
      totalILUsd = totalILUsd.plus(result.impermanentLossUsd);
      totalILPercent = totalILPercent.plus(result.impermanentLoss);
      count++;
    });

    return {
      totalILUsd,
      averageILPercent: count > 0 ? totalILPercent.dividedBy(count).times(100).toNumber() : 0,
      positionCount: count,
    };
  }

  /**
   * Estimate IL for hypothetical price change
   */
  estimateILForPriceChange(priceChangePercent: number): {
    il: number;
    description: string;
  } {
    // Convert price change to ratio
    const priceRatio = 1 + (priceChangePercent / 100);
    const il = calculateILPercent(priceRatio);

    let description: string;
    if (Math.abs(il) < 1) {
      description = 'Negligible IL';
    } else if (Math.abs(il) < 5) {
      description = 'Low IL exposure';
    } else if (Math.abs(il) < 10) {
      description = 'Moderate IL exposure';
    } else {
      description = 'High IL exposure';
    }

    return { il, description };
  }

  /**
   * Get IL risk assessment for a position
   */
  getILRiskLevel(ilPercent: number): 'low' | 'moderate' | 'high' | 'severe' {
    const absIL = Math.abs(ilPercent);
    if (absIL < 2) return 'low';
    if (absIL < 5) return 'moderate';
    if (absIL < 10) return 'high';
    return 'severe';
  }
}

export const impermanentLossService = ImpermanentLossService.getInstance();
