// CCXT types
type Exchange = import('ccxt').Exchange;

import { EarnPosition } from '../types';
import { toDecimal } from './CCXTMappers';
import { logger } from '../../../utils/logger';

// Extended Exchange type for private API methods not in CCXT types
interface ExtendedExchange extends Exchange {
  // Binance private methods
  privateGetSimpleEarnFlexiblePosition?: () => Promise<{
    rows?: Array<{
      asset: string;
      totalAmount: string;
      latestAnnualPercentageRate?: string;
      cumulativeBonusRewards?: string;
    }>;
  }>;
  privateGetSimpleEarnLockedPosition?: () => Promise<{
    rows?: Array<{
      positionId: string;
      asset: string;
      amount: string;
      apy?: string;
      rewardAmt?: string;
      rewardAsset?: string;
      deliverDate?: number;
    }>;
  }>;
  // OKX private methods
  privateGetFinanceSavingsBalance?: () => Promise<{
    data?: Array<{
      ccy: string;
      amt: string;
      rate?: string;
      earnings?: string;
    }>;
  }>;
  privateGetFinanceStakingDefiBalance?: () => Promise<{
    data?: Array<{
      ccy: string;
      amt: string;
      productId: string;
      term?: string;
      apy?: string;
      earnings?: string;
    }>;
  }>;
  // Kraken private methods
  privatePostEarnAllocations?: () => Promise<{
    result?: {
      items?: Array<{
        strategy_id: string;
        native_asset: string;
        amount_allocated: { total: string };
        lock_type?: { type: string };
        payout?: { estimated_reward?: { amount: string } };
        total_rewarded?: string;
      }>;
    };
  }>;
}

/**
 * Fetch Binance Simple Earn positions (Flexible & Locked)
 */
export async function getBinanceEarnPositions(exchange: Exchange): Promise<EarnPosition[]> {
  const positions: EarnPosition[] = [];
  const extExchange = exchange as ExtendedExchange;

  try {
    // Binance Simple Earn - Flexible positions
    if (extExchange.privateGetSimpleEarnFlexiblePosition) {
      const flexibleResponse = await extExchange.privateGetSimpleEarnFlexiblePosition();
      if (flexibleResponse?.rows) {
        for (const pos of flexibleResponse.rows) {
          if (parseFloat(pos.totalAmount) > 0) {
            positions.push({
              id: `binance-flex-${pos.asset}`,
              asset: pos.asset,
              amount: toDecimal(pos.totalAmount),
              apy: parseFloat(pos.latestAnnualPercentageRate || '0') * 100,
              productType: 'flexible',
              accruedInterest: toDecimal(pos.cumulativeBonusRewards || '0'),
              redeemable: true,
            });
          }
        }
      }
    }

    // Binance Simple Earn - Locked positions
    if (extExchange.privateGetSimpleEarnLockedPosition) {
      try {
        const lockedResponse = await extExchange.privateGetSimpleEarnLockedPosition();
        if (lockedResponse?.rows) {
          for (const pos of lockedResponse.rows) {
            if (parseFloat(pos.amount) > 0) {
              positions.push({
                id: `binance-locked-${pos.positionId}`,
                asset: pos.asset,
                amount: toDecimal(pos.amount),
                apy: parseFloat(pos.apy || '0') * 100,
                productType: 'locked',
                accruedInterest: toDecimal(pos.rewardAmt || '0'),
                endDate: pos.deliverDate ? new Date(pos.deliverDate) : undefined,
                redeemable: false,
              });
            }
          }
        }
      } catch {
        // Locked earn might not be available for all accounts
      }
    }
  } catch (error) {
    logger.debug('[CCXTEarnProviders] Binance earn API error:', error);
  }

  return positions;
}

/**
 * Fetch OKX Earn positions (Simple Earn & Staking)
 */
export async function getOkxEarnPositions(exchange: Exchange): Promise<EarnPosition[]> {
  const positions: EarnPosition[] = [];
  const extExchange = exchange as ExtendedExchange;

  try {
    // OKX Finance - Savings positions
    if (extExchange.privateGetFinanceSavingsBalance) {
      const savingsResponse = await extExchange.privateGetFinanceSavingsBalance();
      if (savingsResponse?.data) {
        for (const pos of savingsResponse.data) {
          if (parseFloat(pos.amt) > 0) {
            positions.push({
              id: `okx-savings-${pos.ccy}`,
              asset: pos.ccy,
              amount: toDecimal(pos.amt),
              apy: parseFloat(pos.rate || '0') * 100,
              productType: 'flexible',
              accruedInterest: toDecimal(pos.earnings || '0'),
              redeemable: true,
            });
          }
        }
      }
    }

    // OKX Staking positions
    if (extExchange.privateGetFinanceStakingDefiBalance) {
      try {
        const stakingResponse = await extExchange.privateGetFinanceStakingDefiBalance();
        if (stakingResponse?.data) {
          for (const pos of stakingResponse.data) {
            if (parseFloat(pos.amt) > 0) {
              positions.push({
                id: `okx-staking-${pos.ccy}-${pos.productId}`,
                asset: pos.ccy,
                amount: toDecimal(pos.amt),
                apy: parseFloat(pos.apy || '0') * 100,
                productType: 'staking',
                accruedInterest: toDecimal(pos.earnings || '0'),
                redeemable: true,
              });
            }
          }
        }
      } catch {
        // Staking might not be available
      }
    }
  } catch (error) {
    logger.debug('[CCXTEarnProviders] OKX earn API error:', error);
  }

  return positions;
}

/**
 * Fetch Kraken Staking positions
 */
export async function getKrakenEarnPositions(exchange: Exchange): Promise<EarnPosition[]> {
  const positions: EarnPosition[] = [];
  const extExchange = exchange as ExtendedExchange;

  try {
    // Kraken Earn/Staking positions
    if (extExchange.privatePostEarnAllocations) {
      const stakingResponse = await extExchange.privatePostEarnAllocations();
      if (stakingResponse?.result?.items) {
        for (const pos of stakingResponse.result.items) {
          if (parseFloat(pos.amount_allocated?.total) > 0) {
            positions.push({
              id: `kraken-earn-${pos.strategy_id}`,
              asset: pos.native_asset,
              amount: toDecimal(pos.amount_allocated.total),
              apy: parseFloat(pos.payout?.estimated_reward?.amount || '0'),
              productType: 'staking',
              accruedInterest: toDecimal(pos.total_rewarded || '0'),
              redeemable: true,
            });
          }
        }
      }
    }
  } catch (error) {
    logger.debug('[CCXTEarnProviders] Kraken earn API error:', error);
  }

  return positions;
}
