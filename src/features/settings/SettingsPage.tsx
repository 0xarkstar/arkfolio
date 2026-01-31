import { useEffect, useState } from 'react';
import { useDisconnect } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, AppSettings } from '../../stores/settingsStore';
import { getDb } from '../../database/init';
import { toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Switch, Select, Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { SkeletonCard } from '../../components/Skeleton';
import { zapperService } from '../../services/defi';
import { availableLanguages, changeLanguage } from '../../i18n';
import { ApiKeyManager } from './components';
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
  const { disconnect } = useDisconnect();
  const { i18n } = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Zapper API key state
  const [zapperApiKey, setZapperApiKey] = useState('');
  const [zapperApiKeyMasked, setZapperApiKeyMasked] = useState<string | null>(null);
  const [isTestingZapper, setIsTestingZapper] = useState(false);
  const [zapperConfigured, setZapperConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
    // Load Zapper API key from safe storage
    loadZapperApiKey();
  }, [loadSettings]);

  const loadZapperApiKey = async () => {
    try {
      // Only use safe storage - no localStorage fallback for security
      if (window.electronAPI?.safeStorage) {
        const key = await window.electronAPI.safeStorage.decrypt('zapper_api_key');
        if (key) {
          zapperService.configure({ apiKey: key });
          setZapperConfigured(true);
          setZapperApiKeyMasked(zapperService.getApiKeyMasked());
        }
      }
      // Note: API keys require Electron's safe storage for secure handling
    } catch {
      // Safe storage not available or no key stored
      console.warn('Safe storage not available for API key retrieval');
    }
  };

  const handleSaveZapperApiKey = async () => {
    if (!zapperApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsTestingZapper(true);
    try {
      const key = zapperApiKey.trim();

      // Configure the service
      zapperService.configure({ apiKey: key });

      // Try to test, but don't block on failure (CORS issues in dev mode)
      try {
        const isValid = await zapperService.testConnection();
        if (!isValid) {
          console.warn('Zapper API test failed, but saving key anyway (may be CORS issue)');
        }
      } catch (testError) {
        console.warn('Zapper API test error (likely CORS):', testError);
        // Continue anyway - the key will be tested when actually used
      }

      // Save to safe storage only - no insecure fallback
      if (window.electronAPI?.safeStorage) {
        await window.electronAPI.safeStorage.encrypt('zapper_api_key', key);
      } else {
        toast.error('Secure storage not available. Please run in Electron for API key storage.');
        zapperService.clearConfig();
        return;
      }

      setZapperConfigured(true);
      setZapperApiKeyMasked(zapperService.getApiKeyMasked());
      setZapperApiKey('');
      toast.success('Zapper API key saved. Test it by syncing DeFi positions.');
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
      zapperService.clearConfig();
    } finally {
      setIsTestingZapper(false);
    }
  };

  const handleRemoveZapperApiKey = async () => {
    try {
      if (window.electronAPI?.safeStorage) {
        await window.electronAPI.safeStorage.delete('zapper_api_key');
      }

      zapperService.clearConfig();
      setZapperConfigured(false);
      setZapperApiKeyMasked(null);
      toast.info('Zapper API key removed');
    } catch {
      toast.error('Failed to remove API key');
    }
  };

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

      setExportStatus(null);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus(null);
      toast.error('Failed to export data');
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

      setImportStatus(null);
      toast.success('Data imported successfully. Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus(null);
      toast.error('Failed to import data: Invalid file format');
    }

    // Reset file input
    event.target.value = '';
  };

  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      const db = getDb();

      // Disconnect wallet first (prevents auto-reconnect from adding it back)
      try {
        disconnect();
      } catch {
        // Wallet might not be connected
      }

      // Clear wagmi/RainbowKit localStorage state
      const keysToRemove = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith('wagmi') ||
          key.startsWith('rk-') ||
          key.startsWith('walletconnect') ||
          key.includes('wallet') ||
          key.includes('Wallet')
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));

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
      toast.success('All data cleared. Reloading...');
      // Reload the page to reset all state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast.error('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Saving indicator */}
      {isSaving && (
        <Alert variant="info" className="fixed top-4 right-4 max-w-xs z-50">
          Saving changes...
        </Alert>
      )}

      {/* General Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Display Currency</p>
              <p className="text-sm text-surface-400">Choose your preferred display currency</p>
            </div>
            <Select
              value={settings.currency}
              onChange={(e) => handleSettingChange('currency', e.target.value as AppSettings['currency'])}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'KRW', label: 'KRW' },
                { value: 'EUR', label: 'EUR' },
                { value: 'BTC', label: 'BTC' },
              ]}
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Language</p>
              <p className="text-sm text-surface-400">Select interface language</p>
            </div>
            <Select
              value={i18n.language.split('-')[0]}
              onChange={(e) => {
                changeLanguage(e.target.value);
                handleSettingChange('language', e.target.value as AppSettings['language']);
              }}
              options={availableLanguages.map((lang) => ({
                value: lang.code,
                label: lang.nativeName,
              }))}
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Theme</p>
              <p className="text-sm text-surface-400">Choose app appearance</p>
            </div>
            <Select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value as AppSettings['theme'])}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
              className="w-32"
            />
          </div>
        </div>
      </Card>

      {/* Sync Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Sync & Data</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Auto Sync</p>
              <p className="text-sm text-surface-400">Automatically sync exchange data</p>
            </div>
            <Switch
              checked={settings.autoSync}
              onChange={(checked) => handleSettingChange('autoSync', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Sync Interval</p>
              <p className="text-sm text-surface-400">How often to sync data (in minutes)</p>
            </div>
            <Select
              value={String(settings.syncInterval)}
              onChange={(e) => handleSettingChange('syncInterval', Number(e.target.value))}
              disabled={!settings.autoSync}
              options={[
                { value: '1', label: '1 min' },
                { value: '5', label: '5 min' },
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
                { value: '60', label: '1 hour' },
              ]}
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Realtime Sync</p>
              <p className="text-sm text-surface-400">
                Use WebSocket for instant balance/position updates
                <br />
                <span className="text-surface-500 text-xs">
                  Uses more battery and resources. Recommended for active trading.
                </span>
              </p>
            </div>
            <Switch
              checked={settings.realtimeSync}
              onChange={(checked) => handleSettingChange('realtimeSync', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Notifications</p>
              <p className="text-sm text-surface-400">Receive alerts for price movements</p>
            </div>
            <Switch
              checked={settings.notifications}
              onChange={(checked) => handleSettingChange('notifications', checked)}
            />
          </div>
        </div>
      </Card>

      {/* Tax Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Tax Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Cost Basis Method</p>
              <p className="text-sm text-surface-400">Method for calculating cost basis</p>
            </div>
            <Select
              value={settings.taxMethod}
              onChange={(e) => handleSettingChange('taxMethod', e.target.value as AppSettings['taxMethod'])}
              options={[
                { value: 'moving_average', label: 'Moving Average' },
                { value: 'fifo', label: 'FIFO' },
                { value: 'lifo', label: 'LIFO' },
              ]}
              className="w-40"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Annual Deduction (KRW)</p>
              <p className="text-sm text-surface-400">Basic deduction for tax calculation</p>
            </div>
            <Select
              value={String(settings.taxDeduction)}
              onChange={(e) => handleSettingChange('taxDeduction', Number(e.target.value))}
              options={[
                { value: '2500000', label: '2,500,000 (Current)' },
                { value: '50000000', label: '50,000,000 (2025~)' },
              ]}
              className="w-40"
            />
          </div>
        </div>
      </Card>

      {/* API Keys */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">API Keys</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-surface-100">Zapper API Key</p>
                <p className="text-sm text-surface-400">
                  Required for automatic DeFi position detection.{' '}
                  <a
                    href="https://studio.zapper.xyz/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300"
                  >
                    Get your key
                  </a>
                </p>
              </div>
            </div>
            {zapperConfigured ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 px-3 py-2 bg-surface-800 rounded-lg text-surface-300 font-mono text-sm">
                  {zapperApiKeyMasked}
                </div>
                <Button
                  onClick={handleRemoveZapperApiKey}
                  variant="danger"
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  type="password"
                  value={zapperApiKey}
                  onChange={(e) => setZapperApiKey(e.target.value)}
                  placeholder="Enter your Zapper API key"
                  className="flex-1 font-mono"
                />
                <Button
                  onClick={handleSaveZapperApiKey}
                  disabled={isTestingZapper || !zapperApiKey.trim()}
                  loading={isTestingZapper}
                  size="sm"
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Exchange API Key Management */}
      <Card className="p-6">
        <ApiKeyManager />
      </Card>

      {/* Backup & Security */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Backup & Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Google Drive Backup</p>
              <p className="text-sm text-surface-400">Sync encrypted backup to Google Drive</p>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Coming Soon
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Export Data</p>
              <p className="text-sm text-surface-400">Download all your data as JSON</p>
            </div>
            <Button
              onClick={handleExportData}
              variant="secondary"
              size="sm"
              loading={!!exportStatus}
            >
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Import Data</p>
              <p className="text-sm text-surface-400">Restore data from a backup file</p>
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 px-3 py-1.5 text-sm gap-1.5 bg-surface-700 hover:bg-surface-600 text-surface-100 border border-surface-600">
                {importStatus || 'Import'}
              </span>
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
            <Button
              onClick={() => setShowClearConfirm(true)}
              variant="danger"
              size="sm"
            >
              Clear Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-surface-300">Global Search</span>
            <kbd className="px-2 py-1 bg-surface-700 rounded text-xs text-surface-300 font-mono">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + K
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-surface-300">Close Modal / Cancel</span>
            <kbd className="px-2 py-1 bg-surface-700 rounded text-xs text-surface-300 font-mono">
              Esc
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-surface-300">Show Shortcuts</span>
            <kbd className="px-2 py-1 bg-surface-700 rounded text-xs text-surface-300 font-mono">
              ?
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-surface-300">Navigate Pages</span>
            <kbd className="px-2 py-1 bg-surface-700 rounded text-xs text-surface-300 font-mono">
              1-8
            </kbd>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card className="p-6">
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
        <div className="mt-4 flex gap-3">
          <a
            href="https://github.com/0xarkstar/arkfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            GitHub
          </a>
          <span className="text-surface-600">|</span>
          <a
            href="https://github.com/0xarkstar/arkfolio/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            Report Issue
          </a>
        </div>
      </Card>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Data?"
        message="This action cannot be undone. All your exchange connections, transaction history, and settings will be permanently deleted."
        confirmLabel={isClearing ? 'Clearing...' : 'Clear All Data'}
        variant="danger"
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
