import { eq, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import {
  exchanges,
  balances,
  positions,
  type Exchange,
  type NewExchange,
  type Balance,
  type NewBalance,
  type Position,
  type NewPosition,
} from '../schema';
import { BaseRepository } from './BaseRepository';
import { generateId } from '../init';
import { logger } from '../../utils/logger';

/**
 * Repository for exchange accounts
 */
class ExchangeRepositoryClass extends BaseRepository<typeof exchanges, Exchange, NewExchange> {
  protected readonly table = exchanges;
  protected readonly tableName = 'Exchange';

  /**
   * Find all exchanges ordered by creation date
   */
  async findAllOrdered(): Promise<Exchange[]> {
    try {
      const db = this.getDb();
      return await db.select().from(exchanges).orderBy(desc(exchanges.createdAt));
    } catch (error) {
      logger.error('[ExchangeRepository] Failed to find all ordered:', error);
      throw error;
    }
  }

  /**
   * Find exchange by name
   */
  async findByName(name: string): Promise<Exchange | null> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(exchanges)
        .where(eq(exchanges.name, name))
        .limit(1);
      return results[0] || null;
    } catch (error) {
      logger.error('[ExchangeRepository] Failed to find by name:', error);
      throw error;
    }
  }
}

/**
 * Repository for balance records
 */
class BalanceRepositoryClass extends BaseRepository<typeof balances, Balance, NewBalance> {
  protected readonly table = balances;
  protected readonly tableName = 'Balance';

  /**
   * Find balances by exchange ID
   */
  async findByExchangeId(exchangeId: string): Promise<Balance[]> {
    try {
      const db = this.getDb();
      return await db.select().from(balances).where(eq(balances.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[BalanceRepository] Failed to find by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Delete all balances for an exchange
   */
  async deleteByExchangeId(exchangeId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(balances).where(eq(balances.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[BalanceRepository] Failed to delete by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Sync balances for an exchange (delete old, insert new)
   */
  async syncForExchange(
    exchangeId: string,
    newBalances: Array<{
      asset: string;
      free: Decimal;
      locked: Decimal;
      balanceType: 'spot' | 'futures' | 'margin' | 'earn' | 'funding';
    }>
  ): Promise<void> {
    try {
      const db = this.getDb();
      // Delete existing balances
      await db.delete(balances).where(eq(balances.exchangeId, exchangeId));

      // Insert new balances
      for (const balance of newBalances) {
        await db.insert(balances).values({
          id: generateId(),
          exchangeId,
          asset: balance.asset,
          free: balance.free.toNumber(),
          locked: balance.locked.toNumber(),
          balanceType: balance.balanceType,
          updatedAt: new Date(),
        });
      }
      logger.debug(`[BalanceRepository] Synced ${newBalances.length} balances for exchange ${exchangeId}`);
    } catch (error) {
      logger.error('[BalanceRepository] Failed to sync balances:', error);
      throw error;
    }
  }

  /**
   * Transform database balance to domain model with Decimal types
   */
  toDomainModel(dbBalance: Balance): {
    id: string;
    exchangeId: string;
    asset: string;
    free: Decimal;
    locked: Decimal;
    total: Decimal;
    balanceType: 'spot' | 'futures' | 'margin' | 'earn' | 'funding';
    updatedAt: Date | null;
  } {
    const free = new Decimal(dbBalance.free || 0);
    const locked = new Decimal(dbBalance.locked || 0);
    return {
      id: dbBalance.id,
      exchangeId: dbBalance.exchangeId || '',
      asset: dbBalance.asset,
      free,
      locked,
      total: free.plus(locked),
      balanceType: dbBalance.balanceType,
      updatedAt: dbBalance.updatedAt,
    };
  }
}

/**
 * Repository for position records
 */
class PositionRepositoryClass extends BaseRepository<typeof positions, Position, NewPosition> {
  protected readonly table = positions;
  protected readonly tableName = 'Position';

  /**
   * Find positions by exchange ID
   */
  async findByExchangeId(exchangeId: string): Promise<Position[]> {
    try {
      const db = this.getDb();
      return await db.select().from(positions).where(eq(positions.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[PositionRepository] Failed to find by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Delete all positions for an exchange
   */
  async deleteByExchangeId(exchangeId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(positions).where(eq(positions.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[PositionRepository] Failed to delete by exchange ID:', error);
      throw error;
    }
  }

  /**
   * Sync positions for an exchange (delete old, insert new)
   */
  async syncForExchange(
    exchangeId: string,
    newPositions: Array<{
      symbol: string;
      side: 'long' | 'short';
      size: Decimal;
      entryPrice: Decimal;
      markPrice: Decimal;
      unrealizedPnl: Decimal;
      leverage: number;
      marginType: 'cross' | 'isolated';
      liquidationPrice?: Decimal;
    }>
  ): Promise<void> {
    try {
      const db = this.getDb();
      // Delete existing positions
      await db.delete(positions).where(eq(positions.exchangeId, exchangeId));

      // Insert new positions
      for (const position of newPositions) {
        await db.insert(positions).values({
          id: generateId(),
          exchangeId,
          symbol: position.symbol,
          side: position.side,
          size: position.size.toNumber(),
          entryPrice: position.entryPrice.toNumber(),
          markPrice: position.markPrice.toNumber(),
          unrealizedPnl: position.unrealizedPnl.toNumber(),
          leverage: position.leverage,
          marginType: position.marginType,
          liquidationPrice: position.liquidationPrice?.toNumber(),
          updatedAt: new Date(),
        });
      }
      logger.debug(`[PositionRepository] Synced ${newPositions.length} positions for exchange ${exchangeId}`);
    } catch (error) {
      logger.error('[PositionRepository] Failed to sync positions:', error);
      throw error;
    }
  }

  /**
   * Transform database position to domain model with Decimal types
   */
  toDomainModel(dbPosition: Position): {
    id: string;
    exchangeId: string;
    symbol: string;
    side: 'long' | 'short';
    size: Decimal;
    entryPrice: Decimal;
    markPrice: Decimal;
    unrealizedPnl: Decimal;
    leverage: number;
    marginType: 'cross' | 'isolated';
    liquidationPrice: Decimal | null;
    updatedAt: Date | null;
  } {
    return {
      id: dbPosition.id,
      exchangeId: dbPosition.exchangeId || '',
      symbol: dbPosition.symbol,
      side: dbPosition.side,
      size: new Decimal(dbPosition.size || 0),
      entryPrice: new Decimal(dbPosition.entryPrice || 0),
      markPrice: new Decimal(dbPosition.markPrice || 0),
      unrealizedPnl: new Decimal(dbPosition.unrealizedPnl || 0),
      leverage: dbPosition.leverage || 1,
      marginType: dbPosition.marginType || 'cross',
      liquidationPrice: dbPosition.liquidationPrice ? new Decimal(dbPosition.liquidationPrice) : null,
      updatedAt: dbPosition.updatedAt,
    };
  }
}

// Export singleton instances
export const ExchangeRepository = new ExchangeRepositoryClass();
export const BalanceRepository = new BalanceRepositoryClass();
export const PositionRepository = new PositionRepositoryClass();
