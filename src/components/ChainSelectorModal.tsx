import { Modal } from './Modal';
import { Button } from './Button';

export type ChainType = 'evm' | 'solana' | 'sui';

interface ChainOption {
  type: ChainType;
  name: string;
  icon: string;
  description: string;
  wallets: string[];
}

const CHAIN_OPTIONS: ChainOption[] = [
  {
    type: 'evm',
    name: 'EVM Chains',
    icon: '🔷',
    description: 'Ethereum, Arbitrum, Optimism, Base, Polygon',
    wallets: ['MetaMask', 'Rainbow', 'Coinbase Wallet'],
  },
  {
    type: 'solana',
    name: 'Solana',
    icon: '☀️',
    description: 'Solana blockchain',
    wallets: ['Phantom', 'Solflare', 'Backpack'],
  },
  {
    type: 'sui',
    name: 'SUI',
    icon: '💧',
    description: 'SUI blockchain',
    wallets: ['Sui Wallet', 'Suiet', 'Ethos'],
  },
];

interface ChainSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChain: (chain: ChainType) => void;
}

export function ChainSelectorModal({
  isOpen,
  onClose,
  onSelectChain,
}: ChainSelectorModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Network"
      size="sm"
    >
      <div className="space-y-3">
        {CHAIN_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => {
              onSelectChain(option.type);
              onClose();
            }}
            className="w-full p-4 bg-surface-800 hover:bg-surface-750 rounded-lg transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <h3 className="font-medium text-surface-100 group-hover:text-white">
                  {option.name}
                </h3>
                <p className="text-sm text-surface-400">{option.description}</p>
                <p className="text-xs text-surface-500 mt-1">
                  {option.wallets.join(', ')}
                </p>
              </div>
              <svg
                className="w-5 h-5 text-surface-500 group-hover:text-surface-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-surface-700">
        <Button variant="ghost" onClick={onClose} fullWidth>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
