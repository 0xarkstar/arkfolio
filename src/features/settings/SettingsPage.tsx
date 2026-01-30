import { useEffect, useState } from 'react';
import { useSettingsStore, AppSettings } from '../../stores/settingsStore';
import { getDb } from '../../database/init';
import {
  settings as settingsTable,
  exchanges as exchangesTable,
  balances as balancesTable,
  positions as positionsTable,
  wallets as walletsTable,
  transactions as transactionsTable,
  onchainAssets as onchainAssetsTable,
  defiPositions as defiPositionsTable,
  points as pointsTable,
  taxReports as taxReportsTable,
  priceHistory as priceHistoryTable,
} from '../../database/schema';

export function SettingsPage() {
  const { settings, isLoading, isSaving, loadSettings, updateSetting } = useSettingsStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSettingChange = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    await updateSetting(key, value);
  };

  const handleExportData = async () => {
    try {
      setExportStatus('Exporting...');
      const db = getDb();

      // Export all tables
      const data = {
        exportedAt: new Date().toISOString(),
        version: '0.1.0',
        settings: await db.select().from(settingsTable),
        exchanges: await db.select().from(exchangesTable),
        balances: await db.select().from(balancesTable),
        positions: await db.select().from(positionsTable),
        wallets: await db.select().from(walletsTable),
        transactions: await db.select().from(transactionsTable),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arkfolio-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('Export complete!');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('Export failed');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('Importing...');
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid backup file format');
      }

      const db = getDb();

      // Import exchanges (skip settings and sensitive data)
      if (data.exchanges?.length > 0) {
        for (const exchange of data.exchanges) {
          await db.insert(exchangesTable).values({
            ...exchange,
            apiKeyRef: null, // Don't restore API keys
            apiSecretRef: null,
            passphraseRef: null,
          }).onConflictDoNothing();
        }
      }

      // Import wallets
      if (data.wallets?.length > 0) {
        for (const wallet of data.wallets) {
          await db.insert(walletsTable).values(wallet).onConflictDoNothing();
        }
      }

      // Import transactions
      if (data.transactions?.length > 0) {
        for (const tx of data.transactions) {
          await db.insert(transactionsTable).values(tx).onConflictDoNothing();
        }
      }

      setImportStatus('Import complete! Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus('Import failed: Invalid file');
      setTimeout(() => setImportStatus(null), 3000);
    }

    // Reset file input
    event.target.value = '';
  };

  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      const db = getDb();

      // Delete all data from all tables (order matters due to foreign keys)
      await db.delete(onchainAssetsTable);
      await db.delete(defiPositionsTable);
      await db.delete(pointsTable);
      await db.delete(taxReportsTable);
      await db.delete(priceHistoryTable);
      await db.delete(transactionsTable);
      await db.delete(positionsTable);
      await db.delete(balancesTable);
      await db.delete(walletsTable);
      await db.delete(exchangesTable);
      // Keep settings, just reset them

      // Clear encrypted credentials from safe storage
      if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.safeStorage.list();
          for (const key of keys) {
            await window.electronAPI.safeStorage.delete(key);
          }
        } catch {
          // Safe storage might not be fully available
        }
      }

      setShowClearConfirm(false);
      // Reload the page to reset all state
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm">
          Saving...
        </div>
      )}

      {/* General Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Display Currency</p>
              <p className="text-sm text-surface-400">Choose your preferred display currency</p>
            </div>
            <select
              value={settings.currency}
              onChange={(e) => handleSettingChange('currency', e.target.value as AppSettings['currency'])}
              className="input w-32"
            >
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
              <option value="EUR">EUR</option>
              <option value="BTC">BTC</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Language</p>
              <p className="text-sm text-surface-400">Select interface language</p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value as AppSettings['language'])}
              className="input w-32"
            >
              <option value="en">English</option>
              <option value="ko">Korean</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Theme</p>
              <p className="text-sm text-surface-400">Choose app appearance</p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value as AppSettings['theme'])}
              className="input w-32"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Sync & Data</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Auto Sync</p>
              <p className="text-sm text-surface-400">Automatically sync exchange data</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Sync Interval</p>
              <p className="text-sm text-surface-400">How often to sync data (in minutes)</p>
            </div>
            <select
              value={settings.syncInterval}
              onChange={(e) => handleSettingChange('syncInterval', Number(e.target.value))}
              className="input w-32"
              disabled={!settings.autoSync}
            >
              <option value={1}>1 min</option>
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Notifications</p>
              <p className="text-sm text-surface-400">Receive alerts for price movements</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Tax Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Tax Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Cost Basis Method</p>
              <p className="text-sm text-surface-400">Method for calculating cost basis</p>
            </div>
            <select
              value={settings.taxMethod}
              onChange={(e) => handleSettingChange('taxMethod', e.target.value as AppSettings['taxMethod'])}
              className="input w-40"
            >
              <option value="moving_average">Moving Average</option>
              <option value="fifo">FIFO</option>
              <option value="lifo">LIFO</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Annual Deduction (KRW)</p>
              <p className="text-sm text-surface-400">Basic deduction for tax calculation</p>
            </div>
            <select
              value={settings.taxDeduction}
              onChange={(e) => handleSettingChange('taxDeduction', Number(e.target.value))}
              className="input w-40"
            >
              <option value={2500000}>2,500,000 (Current)</option>
              <option value={50000000}>50,000,000 (2025~)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Backup & Security */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Backup & Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Google Drive Backup</p>
              <p className="text-sm text-surface-400">Sync encrypted backup to Google Drive</p>
            </div>
            <button className="btn-secondary text-sm" disabled>
              Coming Soon
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Export Data</p>
              <p className="text-sm text-surface-400">Download all your data as JSON</p>
            </div>
            <button
              onClick={handleExportData}
              className="btn-secondary text-sm"
              disabled={!!exportStatus}
            >
              {exportStatus || 'Export'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Import Data</p>
              <p className="text-sm text-surface-400">Restore data from a backup file</p>
            </div>
            <label className="btn-secondary text-sm cursor-pointer">
              {importStatus || 'Import'}
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                disabled={!!importStatus}
              />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Clear All Data</p>
              <p className="text-sm text-surface-400">Delete all local data permanently</p>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 bg-loss/20 hover:bg-loss/30 text-loss rounded-lg text-sm transition-colors"
            >
              Clear Data
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">About</h2>
        <div className="space-y-2 text-sm text-surface-400">
          <p><span className="text-surface-300">Version:</span> 0.1.0</p>
          <p><span className="text-surface-300">Build:</span> Development</p>
          <p><span className="text-surface-300">Platform:</span> {navigator.platform}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-surface-800">
          <p className="text-xs text-surface-500">
            ArkFolio - Crypto Portfolio Tracker<br />
            Data is stored locally and encrypted using OS-level security.
          </p>
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-surface-100 mb-2">Clear All Data?</h3>
            <p className="text-surface-400 mb-4">
              This action cannot be undone. All your exchange connections, transaction history,
              and settings will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-secondary"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="px-4 py-2 bg-loss hover:bg-loss/80 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
