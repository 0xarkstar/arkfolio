import { useEffect, useState } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { Card } from '../../components/Card';
import { Button, IconButton } from '../../components/Button';
import { Input, Select } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCard } from '../../components/Skeleton';
import { toast } from '../../components/Toast';

export function AlertsPage() {
  const {
    priceAlerts,
    liquidationAlerts,
    isPriceAlertsLoading,
    loadPriceAlerts,
    addPriceAlert,
    deletePriceAlert,
    togglePriceAlert,
    loadLiquidationAlerts,
    deleteLiquidationAlert,
  } = useNotificationStore();

  const [showAddAlert, setShowAddAlert] = useState(false);
  const [newAlertAsset, setNewAlertAsset] = useState('');
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<'above' | 'below'>('above');
  const [newAlertNote, setNewAlertNote] = useState('');

  useEffect(() => {
    loadPriceAlerts();
    loadLiquidationAlerts();
  }, [loadPriceAlerts, loadLiquidationAlerts]);

  const handleAddAlert = async () => {
    if (!newAlertAsset.trim()) {
      toast.error('Please enter an asset symbol');
      return;
    }
    if (!newAlertPrice || parseFloat(newAlertPrice) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    await addPriceAlert({
      asset: newAlertAsset.toUpperCase().trim(),
      targetPrice: parseFloat(newAlertPrice),
      condition: newAlertCondition,
      isActive: true,
      note: newAlertNote.trim() || null,
    });

    setNewAlertAsset('');
    setNewAlertPrice('');
    setNewAlertNote('');
    setShowAddAlert(false);
  };

  const activeAlerts = priceAlerts.filter((a) => a.isActive && !a.isTriggered);
  const triggeredAlerts = priceAlerts.filter((a) => a.isTriggered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Price Alerts</h1>
          <p className="text-surface-400 mt-1">Get notified when assets reach your target prices</p>
        </div>
        <Button onClick={() => setShowAddAlert(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Alert
        </Button>
      </div>

      {/* Add Alert Form */}
      {showAddAlert && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Create Price Alert</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Asset</label>
              <Input
                value={newAlertAsset}
                onChange={(e) => setNewAlertAsset(e.target.value)}
                placeholder="BTC, ETH, SOL..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Condition</label>
              <Select
                value={newAlertCondition}
                onChange={(e) => setNewAlertCondition(e.target.value as 'above' | 'below')}
                options={[
                  { value: 'above', label: 'Price goes above' },
                  { value: 'below', label: 'Price goes below' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Target Price (USD)</label>
              <Input
                type="number"
                value={newAlertPrice}
                onChange={(e) => setNewAlertPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Note (optional)</label>
              <Input
                value={newAlertNote}
                onChange={(e) => setNewAlertNote(e.target.value)}
                placeholder="Reminder note..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowAddAlert(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAlert}>Create Alert</Button>
          </div>
        </Card>
      )}

      {/* Active Alerts */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">
          Active Alerts
          {activeAlerts.length > 0 && (
            <span className="ml-2 text-sm font-normal text-surface-400">({activeAlerts.length})</span>
          )}
        </h2>

        {isPriceAlertsLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : activeAlerts.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No active alerts"
            description="Create a price alert to get notified when assets reach your target prices."
          />
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-surface-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-surface-200">
                      {alert.asset.substring(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-surface-100">{alert.asset}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          alert.condition === 'above'
                            ? 'bg-profit/20 text-profit'
                            : 'bg-loss/20 text-loss'
                        }`}
                      >
                        {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </div>
                    <p className="text-surface-400 text-sm">
                      Target: ${alert.targetPrice.toLocaleString()}
                      {alert.note && <span className="ml-2 text-surface-500">• {alert.note}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alert.isActive ?? false}
                      onChange={(e) => togglePriceAlert(alert.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
                  </label>
                  <IconButton
                    aria-label="Delete alert"
                    variant="danger"
                    size="sm"
                    onClick={() => deletePriceAlert(alert.id)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Triggered Alerts History */}
      {triggeredAlerts.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">
            Triggered Alerts
            <span className="ml-2 text-sm font-normal text-surface-400">({triggeredAlerts.length})</span>
          </h2>
          <div className="space-y-3">
            {triggeredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-surface-800/50 rounded-lg opacity-75"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-profit/20 rounded-full flex items-center justify-center">
                    <span className="text-profit">✓</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-surface-300">{alert.asset}</span>
                      <span className="text-xs text-surface-500">
                        {alert.condition === 'above' ? 'reached above' : 'dropped below'} $
                        {alert.targetPrice.toLocaleString()}
                      </span>
                    </div>
                    {alert.triggeredAt && (
                      <p className="text-surface-500 text-xs">
                        Triggered on {new Date(alert.triggeredAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <IconButton
                  aria-label="Delete alert"
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePriceAlert(alert.id)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </IconButton>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Liquidation Alerts Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">
          Liquidation Alerts
          {liquidationAlerts.length > 0 && (
            <span className="ml-2 text-sm font-normal text-surface-400">({liquidationAlerts.length})</span>
          )}
        </h2>
        <p className="text-surface-400 text-sm mb-4">
          Liquidation alerts are automatically created for your futures positions. You'll be notified when a position gets close to its liquidation price.
        </p>

        {liquidationAlerts.length === 0 ? (
          <EmptyState
            icon="⚠️"
            title="No liquidation alerts"
            description="Liquidation alerts will appear here when you have open futures positions."
          />
        ) : (
          <div className="space-y-3">
            {liquidationAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-surface-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
                    <span className="text-warning">⚠️</span>
                  </div>
                  <div>
                    <span className="font-medium text-surface-100">{alert.symbol}</span>
                    <p className="text-surface-400 text-sm">
                      Liquidation: ${alert.liquidationPrice?.toLocaleString()} • Alert at{' '}
                      {((alert.warningThreshold || 0.1) * 100).toFixed(0)}% distance
                    </p>
                  </div>
                </div>
                <IconButton
                  aria-label="Delete alert"
                  variant="danger"
                  size="sm"
                  onClick={() => deleteLiquidationAlert(alert.id)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
