import { useState } from 'react';
import { SupportedExchange, ExchangeCredentials } from '../../../services/exchanges';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { toast } from '../../../components/Toast';

interface AddExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExchangeType = 'cex' | 'dex';

interface ExchangeOption {
  id: SupportedExchange;
  name: string;
  type: ExchangeType;
  requiresPassphrase: boolean;
  addressType?: 'evm' | 'cosmos';
  description: string;
}

const exchangeOptions: ExchangeOption[] = [
  // CEX
  { id: SupportedExchange.BINANCE, name: 'Binance', type: 'cex', requiresPassphrase: false, description: 'Spot, Futures, Earn' },
  { id: SupportedExchange.UPBIT, name: 'Upbit', type: 'cex', requiresPassphrase: false, description: 'Spot trading' },
  { id: SupportedExchange.OKX, name: 'OKX', type: 'cex', requiresPassphrase: true, description: 'Spot, Futures, Earn' },
  // DEX
  { id: SupportedExchange.HYPERLIQUID, name: 'Hyperliquid', type: 'dex', requiresPassphrase: false, addressType: 'evm', description: 'Perpetuals DEX' },
  { id: SupportedExchange.DYDX, name: 'dYdX', type: 'dex', requiresPassphrase: false, addressType: 'cosmos', description: 'Perpetuals DEX (v4)' },
];

export function AddExchangeModal({ isOpen, onClose }: AddExchangeModalProps) {
  const { addExchange, isLoading } = useExchangeStore();
  const [step, setStep] = useState<'select' | 'credentials'>('select');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeOption | null>(null);
  const [credentials, setCredentials] = useState<ExchangeCredentials>({
    apiKey: '',
    apiSecret: '',
    passphrase: '',
  });
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ExchangeType>('cex');

  if (!isOpen) return null;

  const handleSelectExchange = (exchange: ExchangeOption) => {
    setSelectedExchange(exchange);
    setAccountName(`${exchange.name} Account`);
    setCredentials({ apiKey: '', apiSecret: '', passphrase: '' });
    setStep('credentials');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedExchange) return;

    try {
      // For DEX, only wallet address is needed (stored in apiKey)
      const creds: ExchangeCredentials = selectedExchange.type === 'dex'
        ? { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret || 'readonly' }
        : credentials;

      await addExchange(selectedExchange.id, accountName, creds);
      toast.success(`Connected to ${selectedExchange.name}`);
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add exchange';
      setError(message);
      toast.error(message);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedExchange(null);
    setCredentials({ apiKey: '', apiSecret: '', passphrase: '' });
    setAccountName('');
    setError(null);
    setTab('cex');
    onClose();
  };

  const filteredExchanges = exchangeOptions.filter(e => e.type === tab);

  const getAddressPlaceholder = () => {
    if (!selectedExchange) return '';
    if (selectedExchange.addressType === 'cosmos') return 'dydx1...';
    return '0x...';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-surface-100">
            {step === 'select' ? 'Add Exchange' : `Connect ${selectedExchange?.name}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-surface-400 hover:text-surface-100 transition-colors text-2xl"
          >
            &times;
          </button>
        </div>

        {step === 'select' ? (
          <div>
            {/* Tab selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab('cex')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'cex'
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-100'
                }`}
              >
                CEX
              </button>
              <button
                onClick={() => setTab('dex')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'dex'
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-100'
                }`}
              >
                DEX / Perp
              </button>
            </div>

            <div className="space-y-3">
              {filteredExchanges.map(exchange => (
                <button
                  key={exchange.id}
                  onClick={() => handleSelectExchange(exchange)}
                  className="w-full flex items-center gap-4 p-4 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-lg font-medium text-primary-400">
                    {exchange.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-surface-100">{exchange.name}</p>
                    <p className="text-sm text-surface-400">{exchange.description}</p>
                  </div>
                  {exchange.type === 'dex' && (
                    <span className="px-2 py-0.5 bg-primary-600/20 text-primary-400 text-xs rounded">
                      Wallet
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-loss text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="input w-full"
                placeholder="My Trading Account"
                required
              />
            </div>

            {selectedExchange?.type === 'dex' ? (
              // DEX: Wallet address input
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={credentials.apiKey}
                    onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })}
                    className="input w-full font-mono text-sm"
                    placeholder={getAddressPlaceholder()}
                    required
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    {selectedExchange.addressType === 'cosmos'
                      ? 'Enter your dYdX address (dydx1...)'
                      : 'Enter your EVM wallet address (0x...)'}
                  </p>
                </div>

                {selectedExchange.id === SupportedExchange.DYDX && (
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">
                      Subaccount Number (Optional)
                    </label>
                    <input
                      type="number"
                      value={credentials.apiSecret === 'readonly' ? '' : credentials.apiSecret}
                      onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value || 'readonly' })}
                      className="input w-full"
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-surface-500 mt-1">
                      Default is 0. Only change if you use multiple subaccounts.
                    </p>
                  </div>
                )}

                <div className="bg-surface-800 rounded-lg p-3 text-sm text-surface-400">
                  <p className="font-medium text-surface-300 mb-1">Read-Only Access</p>
                  <p>
                    DEX tracking only requires your public wallet address.
                    No private keys or signatures are needed.
                  </p>
                </div>
              </>
            ) : (
              // CEX: API key inputs
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={credentials.apiKey}
                    onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })}
                    className="input w-full font-mono"
                    placeholder="Enter your API key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={credentials.apiSecret}
                    onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value })}
                    className="input w-full font-mono"
                    placeholder="Enter your API secret"
                    required
                  />
                </div>

                {selectedExchange?.requiresPassphrase && (
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">
                      Passphrase
                    </label>
                    <input
                      type="password"
                      value={credentials.passphrase}
                      onChange={e => setCredentials({ ...credentials, passphrase: e.target.value })}
                      className="input w-full font-mono"
                      placeholder="Enter your passphrase"
                      required
                    />
                  </div>
                )}

                <div className="bg-surface-800 rounded-lg p-3 text-sm text-surface-400">
                  <p className="font-medium text-surface-300 mb-1">Security Note</p>
                  <p>
                    API credentials are encrypted using your OS secure storage
                    (Keychain/Credential Manager). Use read-only API keys.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex-1"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
