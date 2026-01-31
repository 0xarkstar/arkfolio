import { useState, useEffect } from 'react';
import { useExchangeStore, ExchangeAccount } from '../../../stores/exchangeStore';
import { ExchangeCredentials } from '../../../services/exchanges';
import { toast } from '../../../components/Toast';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { Modal, ModalFooter } from '../../../components/Modal';
import { Alert } from '../../../components/Alert';

interface ApiKeyHistory {
  exchangeId: string;
  lastRotated: Date | null;
  rotationCount: number;
}

// Key for storing API key history metadata in secure storage
const API_KEY_HISTORY_STORAGE_KEY = 'arkfolio_api_key_history';

// Helper to check if electronAPI is available
const hasElectronAPI = (): boolean => {
  return typeof window !== 'undefined' && 'electronAPI' in window;
};

export function ApiKeyManager() {
  const { accounts, loadAccounts, connectExchange, syncExchange } = useExchangeStore();
  const [selectedAccount, setSelectedAccount] = useState<ExchangeAccount | null>(null);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Form state for new API key
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');

  // History tracking (stored in memory - in production would be persisted)
  const [keyHistory, setKeyHistory] = useState<Map<string, ApiKeyHistory>>(new Map());

  useEffect(() => {
    loadAccounts();
    loadKeyHistory();
  }, [loadAccounts]);

  const loadKeyHistory = async () => {
    try {
      let stored: string | null = null;

      // Try to load from secure storage first (Electron)
      if (hasElectronAPI()) {
        stored = await (window as any).electronAPI.safeStorage.decrypt(API_KEY_HISTORY_STORAGE_KEY);
      }

      // Fallback to localStorage for web or migration
      if (!stored && typeof localStorage !== 'undefined') {
        stored = localStorage.getItem('api_key_history');
        // Migrate from localStorage to secure storage if available
        if (stored && hasElectronAPI()) {
          await (window as any).electronAPI.safeStorage.encrypt(API_KEY_HISTORY_STORAGE_KEY, stored);
          localStorage.removeItem('api_key_history');
        }
      }

      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map<string, ApiKeyHistory>();
        for (const item of parsed) {
          map.set(item.exchangeId, {
            ...item,
            lastRotated: item.lastRotated ? new Date(item.lastRotated) : null,
          });
        }
        setKeyHistory(map);
      }
    } catch {
      // Ignore parse errors
    }
  };

  const saveKeyHistory = async (history: Map<string, ApiKeyHistory>) => {
    try {
      const arr = Array.from(history.values());
      const data = JSON.stringify(arr);

      // Save to secure storage if available (Electron)
      if (hasElectronAPI()) {
        await (window as any).electronAPI.safeStorage.encrypt(API_KEY_HISTORY_STORAGE_KEY, data);
      } else if (typeof localStorage !== 'undefined') {
        // Fallback to localStorage for web
        localStorage.setItem('api_key_history', data);
      }
    } catch {
      // Ignore save errors
    }
  };

  const resetForm = () => {
    setNewApiKey('');
    setNewApiSecret('');
    setNewPassphrase('');
    setTestError(null);
  };

  const handleOpenRotate = (account: ExchangeAccount) => {
    setSelectedAccount(account);
    setShowRotateModal(true);
    resetForm();
  };

  const handleCloseRotate = () => {
    setShowRotateModal(false);
    setSelectedAccount(null);
    resetForm();
  };

  const handleTestNewKey = async () => {
    if (!selectedAccount || !newApiKey || !newApiSecret) {
      setTestError('Please enter both API key and secret');
      return;
    }

    setIsTesting(true);
    setTestError(null);

    try {
      const credentials: ExchangeCredentials = {
        apiKey: newApiKey,
        apiSecret: newApiSecret,
        passphrase: newPassphrase || undefined,
      };

      // Try to connect with the new credentials
      await connectExchange(selectedAccount.id, credentials);

      // Test by syncing
      await syncExchange(selectedAccount.id);

      toast.success('New API key verified successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify API key';
      setTestError(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleRotateKey = async () => {
    if (!selectedAccount || !newApiKey || !newApiSecret) {
      setTestError('Please test the new key first');
      return;
    }

    setIsRotating(true);

    try {
      const credentials: ExchangeCredentials = {
        apiKey: newApiKey,
        apiSecret: newApiSecret,
        passphrase: newPassphrase || undefined,
      };

      // Connect with new credentials (this saves to safe storage)
      await connectExchange(selectedAccount.id, credentials);

      // Sync to verify
      await syncExchange(selectedAccount.id);

      // Update history
      const history = new Map(keyHistory);
      const current = history.get(selectedAccount.id) || {
        exchangeId: selectedAccount.id,
        lastRotated: null,
        rotationCount: 0,
      };
      history.set(selectedAccount.id, {
        ...current,
        lastRotated: new Date(),
        rotationCount: current.rotationCount + 1,
      });
      setKeyHistory(history);
      await saveKeyHistory(history);

      toast.success(`API key for ${selectedAccount.name} rotated successfully`);
      handleCloseRotate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rotate API key';
      setTestError(message);
      toast.error(message);
    } finally {
      setIsRotating(false);
    }
  };

  const getKeyAge = (accountId: string): string => {
    const history = keyHistory.get(accountId);
    if (!history?.lastRotated) {
      return 'Never rotated';
    }

    const days = Math.floor(
      (Date.now() - history.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const needsRotation = (accountId: string): boolean => {
    const history = keyHistory.get(accountId);
    if (!history?.lastRotated) return true;

    const daysSinceRotation = Math.floor(
      (Date.now() - history.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceRotation > 90; // Recommend rotation every 90 days
  };

  const connectedAccounts = accounts.filter((a) => a.isConnected);

  if (connectedAccounts.length === 0) {
    return (
      <div className="p-6 bg-surface-800 rounded-xl text-center">
        <p className="text-surface-400">
          No exchange accounts connected. Add exchanges in the Exchanges page to manage API keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-100">Exchange API Keys</h3>
        <p className="text-xs text-surface-500">Rotate keys regularly for security</p>
      </div>

      <div className="space-y-3">
        {connectedAccounts.map((account) => {
          const shouldRotate = needsRotation(account.id);

          return (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-surface-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-surface-100">{account.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={account.isConnected ? 'success' : 'default'}
                      size="sm"
                    >
                      {account.isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                    <span className="text-xs text-surface-500">
                      Last rotated: {getKeyAge(account.id)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {shouldRotate && (
                  <Badge variant="warning" size="sm">
                    Rotation recommended
                  </Badge>
                )}
                <Button
                  onClick={() => handleOpenRotate(account)}
                  variant="secondary"
                  size="sm"
                >
                  Rotate Key
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rotation Modal */}
      <Modal
        isOpen={showRotateModal}
        onClose={handleCloseRotate}
        title={`Rotate API Key - ${selectedAccount?.name}`}
        size="md"
      >
        <div className="space-y-4">
          <Alert variant="info">
            <strong>How key rotation works:</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
              <li>Generate a new API key on your exchange</li>
              <li>Enter the new key below and test it</li>
              <li>Once verified, click "Rotate" to activate</li>
              <li>Delete the old key from your exchange</li>
            </ol>
          </Alert>

          {testError && (
            <Alert variant="error" onDismiss={() => setTestError(null)}>
              {testError}
            </Alert>
          )}

          <Input
            label="New API Key"
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="Enter new API key"
            required
          />

          <Input
            label="New API Secret"
            type="password"
            value={newApiSecret}
            onChange={(e) => setNewApiSecret(e.target.value)}
            placeholder="Enter new API secret"
            required
          />

          {selectedAccount?.exchangeId === 'okx' && (
            <Input
              label="Passphrase"
              type="password"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              placeholder="Enter passphrase (OKX only)"
            />
          )}

          <ModalFooter>
            <Button onClick={handleCloseRotate} variant="ghost" disabled={isRotating}>
              Cancel
            </Button>
            <Button
              onClick={handleTestNewKey}
              variant="secondary"
              disabled={!newApiKey || !newApiSecret || isTesting || isRotating}
              loading={isTesting}
            >
              Test Key
            </Button>
            <Button
              onClick={handleRotateKey}
              variant="primary"
              disabled={!newApiKey || !newApiSecret || isRotating}
              loading={isRotating}
            >
              Rotate Key
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
