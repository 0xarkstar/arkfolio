import { useEffect, useState } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { Button, IconButton } from './Button';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    isNotificationsLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotificationStore();

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  if (!isOpen) return null;

  const getSeverityStyles = (severity: string | null) => {
    switch (severity) {
      case 'critical':
        return 'border-l-4 border-l-loss bg-loss/5';
      case 'warning':
        return 'border-l-4 border-l-warning bg-warning/5';
      default:
        return 'border-l-4 border-l-primary-500 bg-primary-500/5';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price_alert':
        return '📈';
      case 'liquidation_warning':
        return '⚠️';
      case 'sync_error':
        return '🔄';
      default:
        return '🔔';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-surface-900 border-l border-surface-700 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-surface-100">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="xs" variant="ghost" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            <IconButton aria-label="Close notifications" onClick={onClose}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isNotificationsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-surface-400">
              <span className="text-4xl mb-2">🔔</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-surface-800/50 transition-colors ${
                    !notification.isRead ? getSeverityStyles(notification.severity) : ''
                  }`}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !notification.isRead && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getTypeIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm font-medium truncate ${notification.isRead ? 'text-surface-400' : 'text-surface-100'}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${notification.isRead ? 'text-surface-500' : 'text-surface-300'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-surface-500 mt-2">
                        {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-surface-700">
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={clearNotifications}
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// Notification Bell Button for Header
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, loadNotifications } = useNotificationStore();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-loss rounded-full transform translate-x-1 -translate-y-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
