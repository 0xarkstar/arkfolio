import { useState } from 'react';
import { useNavigationStore, ViewId } from '../../stores/navigationStore';
import { useAppStore } from '../../stores/appStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWalletsStore } from '../../stores/walletsStore';

const viewTitles: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  portfolio: 'Portfolio',
  exchanges: 'Exchanges',
  wallets: 'Wallets',
  defi: 'DeFi Positions',
  risk: 'Risk Management',
  tax: 'Tax Report',
  settings: 'Settings',
};

export default function Header() {
  const { currentView } = useNavigationStore();
  const { isDbReady } = useAppStore();
  const { syncAllExchanges, accounts } = useExchangeStore();
  const { wallets, syncAllWallets } = useWalletsStore();
  const { settings } = useSettingsStore();

  const [isSyncing, setIsSyncing] = useState(false);

  const connectedCount = accounts.filter(a => a.isConnected).length;
  const lastSync = accounts.reduce((latest, a) => {
    if (a.lastSync && (!latest || a.lastSync > latest)) {
      return a.lastSync;
    }
    return latest;
  }, null as Date | null);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const promises: Promise<void>[] = [];
      if (connectedCount > 0) {
        promises.push(syncAllExchanges());
      }
      if (wallets.length > 0) {
        promises.push(syncAllWallets());
      }
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <header className="h-14 bg-surface-900 border-b border-surface-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-surface-100">
          {viewTitles[currentView]}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isDbReady ? 'bg-profit' : 'bg-warning animate-pulse'
            }`}
          />
          <span className="text-xs text-surface-500">
            {isDbReady ? 'Ready' : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {settings.autoSync && (
          <div className="flex items-center gap-1.5 text-xs text-surface-500">
            <span className="w-1.5 h-1.5 rounded-full bg-profit"></span>
            <span>Auto-sync {settings.syncInterval}m</span>
          </div>
        )}

        <div className="text-sm text-surface-400">
          <span>Last sync: </span>
          <span className="text-surface-300">{formatLastSync(lastSync)}</span>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={connectedCount === 0 && wallets.length === 0 || isSyncing}
          className="btn-secondary text-sm py-1.5 flex items-center gap-2 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isSyncing ? 'animate-spin' : ''}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {isSyncing ? 'Syncing...' : 'Sync All'}
        </button>
      </div>
    </header>
  );
}
