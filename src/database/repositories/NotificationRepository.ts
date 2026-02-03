import { eq, desc, and } from 'drizzle-orm';
import {
  priceAlerts,
  liquidationAlerts,
  notifications,
  type PriceAlert,
  type NewPriceAlert,
  type LiquidationAlert,
  type NewLiquidationAlert,
  type Notification,
  type NewNotification,
} from '../schema';
import { BaseRepository } from './BaseRepository';
import { logger } from '../../utils/logger';

type NotificationType = 'price_alert' | 'liquidation_warning' | 'system' | 'sync_error';

/**
 * Repository for price alerts
 */
class PriceAlertRepositoryClass extends BaseRepository<typeof priceAlerts, PriceAlert, NewPriceAlert> {
  protected readonly table = priceAlerts;
  protected readonly tableName = 'PriceAlert';

  /**
   * Find all active price alerts
   */
  async findActive(): Promise<PriceAlert[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.isActive, true))
        .orderBy(desc(priceAlerts.createdAt));
    } catch (error) {
      logger.error('[PriceAlertRepository] Failed to find active:', error);
      throw error;
    }
  }

  /**
   * Find untriggered active alerts
   */
  async findUntriggered(): Promise<PriceAlert[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(priceAlerts)
        .where(and(eq(priceAlerts.isActive, true), eq(priceAlerts.isTriggered, false)));
    } catch (error) {
      logger.error('[PriceAlertRepository] Failed to find untriggered:', error);
      throw error;
    }
  }

  /**
   * Find alerts by asset
   */
  async findByAsset(asset: string): Promise<PriceAlert[]> {
    try {
      const db = this.getDb();
      return await db.select().from(priceAlerts).where(eq(priceAlerts.asset, asset));
    } catch (error) {
      logger.error('[PriceAlertRepository] Failed to find by asset:', error);
      throw error;
    }
  }

  /**
   * Toggle alert active state
   */
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    try {
      const db = this.getDb();
      await db.update(priceAlerts).set({ isActive }).where(eq(priceAlerts.id, id));
    } catch (error) {
      logger.error('[PriceAlertRepository] Failed to toggle active:', error);
      throw error;
    }
  }

  /**
   * Mark alert as triggered
   */
  async markTriggered(id: string): Promise<void> {
    try {
      const db = this.getDb();
      await db
        .update(priceAlerts)
        .set({ isTriggered: true, triggeredAt: new Date() })
        .where(eq(priceAlerts.id, id));
    } catch (error) {
      logger.error('[PriceAlertRepository] Failed to mark triggered:', error);
      throw error;
    }
  }
}

/**
 * Repository for liquidation alerts
 */
class LiquidationAlertRepositoryClass extends BaseRepository<typeof liquidationAlerts, LiquidationAlert, NewLiquidationAlert> {
  protected readonly table = liquidationAlerts;
  protected readonly tableName = 'LiquidationAlert';

  /**
   * Find all active liquidation alerts
   */
  async findActive(): Promise<LiquidationAlert[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(liquidationAlerts)
        .where(eq(liquidationAlerts.isActive, true))
        .orderBy(desc(liquidationAlerts.createdAt));
    } catch (error) {
      logger.error('[LiquidationAlertRepository] Failed to find active:', error);
      throw error;
    }
  }

  /**
   * Find alerts by exchange
   */
  async findByExchange(exchangeId: string): Promise<LiquidationAlert[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(liquidationAlerts)
        .where(eq(liquidationAlerts.exchangeId, exchangeId));
    } catch (error) {
      logger.error('[LiquidationAlertRepository] Failed to find by exchange:', error);
      throw error;
    }
  }

  /**
   * Find alerts by symbol
   */
  async findBySymbol(symbol: string): Promise<LiquidationAlert[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(liquidationAlerts)
        .where(eq(liquidationAlerts.symbol, symbol));
    } catch (error) {
      logger.error('[LiquidationAlertRepository] Failed to find by symbol:', error);
      throw error;
    }
  }

  /**
   * Update last alert timestamp
   */
  async updateLastAlertAt(id: string): Promise<void> {
    try {
      const db = this.getDb();
      await db
        .update(liquidationAlerts)
        .set({ lastAlertAt: new Date() })
        .where(eq(liquidationAlerts.id, id));
    } catch (error) {
      logger.error('[LiquidationAlertRepository] Failed to update last alert at:', error);
      throw error;
    }
  }
}

/**
 * Repository for notification history
 */
class NotificationRepositoryClass extends BaseRepository<typeof notifications, Notification, NewNotification> {
  protected readonly table = notifications;
  protected readonly tableName = 'Notification';

  /**
   * Find all notifications ordered by date
   */
  async findAllOrdered(): Promise<Notification[]> {
    try {
      const db = this.getDb();
      return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    } catch (error) {
      logger.error('[NotificationRepository] Failed to find all ordered:', error);
      throw error;
    }
  }

  /**
   * Find unread notifications
   */
  async findUnread(): Promise<Notification[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.isRead, false))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      logger.error('[NotificationRepository] Failed to find unread:', error);
      throw error;
    }
  }

  /**
   * Count unread notifications
   */
  async countUnread(): Promise<number> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(notifications)
        .where(eq(notifications.isRead, false));
      return results.length;
    } catch (error) {
      logger.error('[NotificationRepository] Failed to count unread:', error);
      throw error;
    }
  }

  /**
   * Find notifications by type
   */
  async findByType(type: NotificationType): Promise<Notification[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.type, type))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      logger.error('[NotificationRepository] Failed to find by type:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    } catch (error) {
      logger.error('[NotificationRepository] Failed to mark as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const db = this.getDb();
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
    } catch (error) {
      logger.error('[NotificationRepository] Failed to mark all as read:', error);
      throw error;
    }
  }
}

// Export singleton instances
export const PriceAlertRepository = new PriceAlertRepositoryClass();
export const LiquidationAlertRepository = new LiquidationAlertRepositoryClass();
export const NotificationRepository = new NotificationRepositoryClass();
