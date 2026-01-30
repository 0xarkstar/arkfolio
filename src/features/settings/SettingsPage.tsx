import { useState } from 'react';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    currency: 'USD',
    language: 'en',
    theme: 'dark',
    autoSync: true,
    syncInterval: 5,
    notifications: true,
    taxMethod: 'moving_average',
    taxDeduction: 2500000,
  });

  return (
    <div className="space-y-6 max-w-2xl">
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
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
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
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="input w-32"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Theme</p>
              <p className="text-sm text-surface-400">Choose app appearance</p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
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
                onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
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
              onChange={(e) => setSettings({ ...settings, syncInterval: Number(e.target.value) })}
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
                onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
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
              onChange={(e) => setSettings({ ...settings, taxMethod: e.target.value })}
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
              onChange={(e) => setSettings({ ...settings, taxDeduction: Number(e.target.value) })}
              className="input w-40"
            >
              <option value={2500000}>₩2,500,000 (Current)</option>
              <option value={50000000}>₩50,000,000 (2025~)</option>
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
            <button className="btn-secondary text-sm">
              Connect
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Export Data</p>
              <p className="text-sm text-surface-400">Download all your data as JSON</p>
            </div>
            <button className="btn-secondary text-sm">
              Export
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-100">Clear All Data</p>
              <p className="text-sm text-surface-400">Delete all local data permanently</p>
            </div>
            <button className="px-4 py-2 bg-loss/20 hover:bg-loss/30 text-loss rounded-lg text-sm transition-colors">
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
    </div>
  );
}
