import { create } from 'zustand';
import { getDb, generateId } from '../database/init';
import {
  priceAlerts,
  liquidationAlerts,
  notifications,
  PriceAlert,
  LiquidationAlert,
  Notification,
} from '../database/schema';
import { eq, desc } from 'drizzle-orm';
import { toast } from '../components/Toast';

interface NotificationState {
  // Price Alerts
  priceAlerts: PriceAlert[];
  isPriceAlertsLoading: boolean;

  // Liquidation Alerts
  liquidationAlerts: LiquidationAlert[];
  isLiquidationAlertsLoading: boolean;

  // Notification History
  notifications: Notification[];
  unreadCount: number;
  isNotificationsLoading: boolean;

  // Actions - Price Alerts
  loadPriceAlerts: () => Promise<void>;
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'isTriggered' | 'triggeredAt'>) => Promise<void>;
  deletePriceAlert: (id: string) => Promise<void>;
  togglePriceAlert: (id: string, isActive: boolean) => Promise<void>;

  // Actions - Liquidation Alerts
  loadLiquidationAlerts: () => Promise<void>;
  addLiquidationAlert: (alert: Omit<LiquidationAlert, 'id' | 'createdAt' | 'lastAlertAt'>) => Promise<void>;
  deleteLiquidationAlert: (id: string) => Promise<void>;

  // Actions - Notifications
  loadNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;

  // Alert Checking
  checkPriceAlerts: (prices: Map<string, number>) => Promise<void>;
  checkLiquidationAlerts: (positions: Array<{ symbol: string; markPrice: number; liquidationPrice: number }>) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  priceAlerts: [],
  isPriceAlertsLoading: false,
  liquidationAlerts: [],
  isLiquidationAlertsLoading: false,
  notifications: [],
  unreadCount: 0,
  isNotificationsLoading: false,

  // Price Alerts
  loadPriceAlerts: async () => {
    set({ isPriceAlertsLoading: true });
    try {
      const db = getDb();
      const alerts = await db.select().from(priceAlerts).orderBy(desc(priceAlerts.createdAt));
      set({ priceAlerts: alerts, isPriceAlertsLoading: false });
    } catch (error) {
      console.error('Failed to load price alerts:', error);
      set({ isPriceAlertsLoading: false });
    }
  },

  addPriceAlert: async (alert) => {
    try {
      const db = getDb();
      const newAlert: PriceAlert = {
        id: generateId(),
        ...alert,
        isTriggered: false,
        triggeredAt: null,
        createdAt: new Date(),
      };
      await db.insert(priceAlerts).values(newAlert);
      set((state) => ({ priceAlerts: [newAlert, ...state.priceAlerts] }));
      toast.success(`Price alert set for ${alert.asset}`);
    } catch (error) {
      console.error('Failed to add price alert:', error);
      toast.error('Failed to create price alert');
    }
  },

  deletePriceAlert: async (id) => {
    try {
      const db = getDb();
      await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
      set((state) => ({ priceAlerts: state.priceAlerts.filter((a) => a.id !== id) }));
      toast.info('Price alert deleted');
    } catch (error) {
      console.error('Failed to delete price alert:', error);
      toast.error('Failed to delete price alert');
    }
  },

  togglePriceAlert: async (id, isActive) => {
    try {
      const db = getDb();
      await db.update(priceAlerts).set({ isActive }).where(eq(priceAlerts.id, id));
      set((state) => ({
        priceAlerts: state.priceAlerts.map((a) => (a.id === id ? { ...a, isActive } : a)),
      }));
    } catch (error) {
      console.error('Failed to toggle price alert:', error);
    }
  },

  // Liquidation Alerts
  loadLiquidationAlerts: async () => {
    set({ isLiquidationAlertsLoading: true });
    try {
      const db = getDb();
      const alerts = await db.select().from(liquidationAlerts).orderBy(desc(liquidationAlerts.createdAt));
      set({ liquidationAlerts: alerts, isLiquidationAlertsLoading: false });
    } catch (error) {
      console.error('Failed to load liquidation alerts:', error);
      set({ isLiquidationAlertsLoading: false });
    }
  },

  addLiquidationAlert: async (alert) => {
    try {
      const db = getDb();
      const newAlert: LiquidationAlert = {
        id: generateId(),
        ...alert,
        lastAlertAt: null,
        createdAt: new Date(),
      };
      await db.insert(liquidationAlerts).values(newAlert);
      set((state) => ({ liquidationAlerts: [newAlert, ...state.liquidationAlerts] }));
      toast.success(`Liquidation alert set for ${alert.symbol}`);
    } catch (error) {
      console.error('Failed to add liquidation alert:', error);
      toast.error('Failed to create liquidation alert');
    }
  },

  deleteLiquidationAlert: async (id) => {
    try {
      const db = getDb();
      await db.delete(liquidationAlerts).where(eq(liquidationAlerts.id, id));
      set((state) => ({ liquidationAlerts: state.liquidationAlerts.filter((a) => a.id !== id) }));
      toast.info('Liquidation alert deleted');
    } catch (error) {
      console.error('Failed to delete liquidation alert:', error);
      toast.error('Failed to delete liquidation alert');
    }
  },

  // Notifications
  loadNotifications: async () => {
    set({ isNotificationsLoading: true });
    try {
      const db = getDb();
      const notifs = await db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(100);
      const unread = notifs.filter((n) => !n.isRead).length;
      set({ notifications: notifs, unreadCount: unread, isNotificationsLoading: false });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({ isNotificationsLoading: false });
    }
  },

  addNotification: async (notification) => {
    try {
      const db = getDb();
      const newNotif: Notification = {
        id: generateId(),
        ...notification,
        isRead: false,
        createdAt: new Date(),
      };
      await db.insert(notifications).values(newNotif);
      set((state) => ({
        notifications: [newNotif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));

      // Show toast based on severity
      if (notification.severity === 'critical') {
        toast.error(notification.message, 10000);
      } else if (notification.severity === 'warning') {
        toast.warning(notification.message, 6000);
      } else {
        toast.info(notification.message);
      }
    } catch (error) {
      console.error('Failed to add notification:', error);
    }
  },

  markAsRead: async (id) => {
    try {
      const db = getDb();
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const db = getDb();
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },

  clearNotifications: async () => {
    try {
      const db = getDb();
      await db.delete(notifications);
      set({ notifications: [], unreadCount: 0 });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  },

  // Alert Checking
  checkPriceAlerts: async (prices) => {
    const { priceAlerts: alerts, addNotification } = get();
    const activeAlerts = alerts.filter((a) => a.isActive && !a.isTriggered);

    for (const alert of activeAlerts) {
      const currentPrice = prices.get(alert.asset);
      if (!currentPrice) continue;

      const triggered =
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (triggered) {
        const db = getDb();
        await db
          .update(priceAlerts)
          .set({ isTriggered: true, triggeredAt: new Date(), isActive: false })
          .where(eq(priceAlerts.id, alert.id));

        set((state) => ({
          priceAlerts: state.priceAlerts.map((a) =>
            a.id === alert.id ? { ...a, isTriggered: true, triggeredAt: new Date(), isActive: false } : a
          ),
        }));

        await addNotification({
          type: 'price_alert',
          title: `${alert.asset} Price Alert`,
          message: `${alert.asset} has reached $${currentPrice.toLocaleString()} (${alert.condition} $${alert.targetPrice.toLocaleString()})`,
          severity: 'warning',
          metadata: JSON.stringify({ asset: alert.asset, price: currentPrice, targetPrice: alert.targetPrice }),
        });
      }
    }
  },

  checkLiquidationAlerts: async (positions) => {
    const { liquidationAlerts: alerts, addNotification } = get();
    const activeAlerts = alerts.filter((a) => a.isActive);
    const now = Date.now();

    for (const alert of activeAlerts) {
      const position = positions.find((p) => p.symbol === alert.symbol);
      if (!position || !position.liquidationPrice) continue;

      const distanceToLiquidation = Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice;
      const threshold = alert.warningThreshold || 0.1;

      if (distanceToLiquidation <= threshold) {
        // Check if we already alerted recently (within 1 hour)
        if (alert.lastAlertAt && now - alert.lastAlertAt.getTime() < 3600000) continue;

        const db = getDb();
        await db
          .update(liquidationAlerts)
          .set({ lastAlertAt: new Date() })
          .where(eq(liquidationAlerts.id, alert.id));

        set((state) => ({
          liquidationAlerts: state.liquidationAlerts.map((a) =>
            a.id === alert.id ? { ...a, lastAlertAt: new Date() } : a
          ),
        }));

        const percentFromLiq = (distanceToLiquidation * 100).toFixed(1);

        await addNotification({
          type: 'liquidation_warning',
          title: `Liquidation Warning: ${alert.symbol}`,
          message: `${alert.symbol} is ${percentFromLiq}% from liquidation price ($${position.liquidationPrice.toLocaleString()})`,
          severity: 'critical',
          metadata: JSON.stringify({
            symbol: alert.symbol,
            markPrice: position.markPrice,
            liquidationPrice: position.liquidationPrice,
          }),
        });
      }
    }
  },
}));
