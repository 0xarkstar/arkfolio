import { useState } from 'react';
import { SupportedExchange, ExchangeCredentials } from '../../../services/exchanges';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { toast } from '../../../components/Toast';
import { Modal, ModalFooter } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Alert } from '../../../components/Alert';
import { Badge } from '../../../components/Badge';

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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'select' ? 'Add Exchange' : `Connect ${selectedExchange?.name}`}
      size="md"
    >
      {step === 'select' ? (
        <div>
          {/* Tab selector */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => setTab('cex')}
              variant={tab === 'cex' ? 'primary' : 'secondary'}
              className="flex-1"
            >
              CEX
            </Button>
            <Button
              onClick={() => setTab('dex')}
              variant={tab === 'dex' ? 'primary' : 'secondary'}
              className="flex-1"
            >
              DEX / Perp
            </Button>
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
                  <Badge variant="info" size="sm">Wallet</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          <Input
            label="Account Name"
            type="text"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="My Trading Account"
            required
          />

          {selectedExchange?.type === 'dex' ? (
            // DEX: Wallet address input
            <>
              <Input
                label="Wallet Address"
                type="text"
                value={credentials.apiKey}
                onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })}
                className="font-mono text-sm"
                placeholder={getAddressPlaceholder()}
                hint={selectedExchange.addressType === 'cosmos'
                  ? 'Enter your dYdX address (dydx1...)'
                  : 'Enter your EVM wallet address (0x...)'}
                required
              />

              {selectedExchange.id === SupportedExchange.DYDX && (
                <Input
                  label="Subaccount Number (Optional)"
                  type="number"
                  value={credentials.apiSecret === 'readonly' ? '' : credentials.apiSecret}
                  onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value || 'readonly' })}
                  placeholder="0"
                  hint="Default is 0. Only change if you use multiple subaccounts."
                />
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
              <Input
                label="API Key"
                type="password"
                value={credentials.apiKey}
                onChange={e => setCredentials({ ...credentials, apiKey: e.target.value })}
                className="font-mono"
                placeholder="Enter your API key"
                required
              />

              <Input
                label="API Secret"
                type="password"
                value={credentials.apiSecret}
                onChange={e => setCredentials({ ...credentials, apiSecret: e.target.value })}
                className="font-mono"
                placeholder="Enter your API secret"
                required
              />

              {selectedExchange?.requiresPassphrase && (
                <Input
                  label="Passphrase"
                  type="password"
                  value={credentials.passphrase}
                  onChange={e => setCredentials({ ...credentials, passphrase: e.target.value })}
                  className="font-mono"
                  placeholder="Enter your passphrase"
                  required
                />
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

          <ModalFooter>
            <Button
              type="button"
              onClick={() => setStep('select')}
              variant="secondary"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              loading={isLoading}
            >
              Connect
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
