import { useState } from 'react';
import { SupportedExchange, ExchangeCredentials } from '../../../services/exchanges';
import { useExchangeStore } from '../../../stores/exchangeStore';

interface AddExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const exchangeOptions = [
  { id: SupportedExchange.BINANCE, name: 'Binance', requiresPassphrase: false },
  { id: SupportedExchange.UPBIT, name: 'Upbit', requiresPassphrase: false },
  { id: SupportedExchange.OKX, name: 'OKX', requiresPassphrase: true },
];

export function AddExchangeModal({ isOpen, onClose }: AddExchangeModalProps) {
  const { addExchange, isLoading } = useExchangeStore();
  const [step, setStep] = useState<'select' | 'credentials'>('select');
  const [selectedExchange, setSelectedExchange] = useState<typeof exchangeOptions[0] | null>(null);
  const [credentials, setCredentials] = useState<ExchangeCredentials>({
    apiKey: '',
    apiSecret: '',
    passphrase: '',
  });
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectExchange = (exchange: typeof exchangeOptions[0]) => {
    setSelectedExchange(exchange);
    setAccountName(`${exchange.name} Account`);
    setStep('credentials');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedExchange) return;

    try {
      await addExchange(selectedExchange.id, accountName, credentials);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exchange');
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedExchange(null);
    setCredentials({ apiKey: '', apiSecret: '', passphrase: '' });
    setAccountName('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-surface-100">
            {step === 'select' ? 'Select Exchange' : `Connect ${selectedExchange?.name}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-surface-400 hover:text-surface-100 transition-colors"
          >
            &times;
          </button>
        </div>

        {step === 'select' ? (
          <div className="space-y-3">
            {exchangeOptions.map(exchange => (
              <button
                key={exchange.id}
                onClick={() => handleSelectExchange(exchange)}
                className="w-full flex items-center gap-4 p-4 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-lg">
                  {exchange.name[0]}
                </div>
                <div>
                  <p className="font-medium text-surface-100">{exchange.name}</p>
                  <p className="text-sm text-surface-400">
                    {exchange.requiresPassphrase ? 'Requires API Key, Secret & Passphrase' : 'Requires API Key & Secret'}
                  </p>
                </div>
              </button>
            ))}
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
                Your API credentials are encrypted using your operating system's secure storage
                (Keychain on macOS, Credential Manager on Windows).
              </p>
            </div>

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
