import { useState } from 'react';

interface Wallet {
  id: string;
  address: string;
  chain: string;
  label: string;
  balance: number;
  tokens: number;
}

const mockWallets: Wallet[] = [
  {
    id: '1',
    address: '0x1234...5678',
    chain: 'Ethereum',
    label: 'Main Wallet',
    balance: 45230,
    tokens: 12,
  },
  {
    id: '2',
    address: '0xabcd...efgh',
    chain: 'Arbitrum',
    label: 'DeFi Wallet',
    balance: 18500,
    tokens: 8,
  },
  {
    id: '3',
    address: '7nYB...x9Kp',
    chain: 'Solana',
    label: 'Solana Wallet',
    balance: 5200,
    tokens: 5,
  },
];

const supportedChains = [
  { id: 'ethereum', name: 'Ethereum', icon: 'E' },
  { id: 'arbitrum', name: 'Arbitrum', icon: 'A' },
  { id: 'optimism', name: 'Optimism', icon: 'O' },
  { id: 'base', name: 'Base', icon: 'B' },
  { id: 'polygon', name: 'Polygon', icon: 'P' },
  { id: 'bsc', name: 'BSC', icon: 'B' },
  { id: 'solana', name: 'Solana', icon: 'S' },
];

export function WalletsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [wallets] = useState<Wallet[]>(mockWallets);

  const totalValue = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total On-chain Value</p>
          <p className="text-2xl font-bold text-surface-100 font-tabular">
            ${totalValue.toLocaleString()}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Wallets</p>
          <p className="text-2xl font-bold text-surface-100">{wallets.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Chains</p>
          <p className="text-2xl font-bold text-surface-100">
            {new Set(wallets.map(w => w.chain)).size}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total Tokens</p>
          <p className="text-2xl font-bold text-surface-100">
            {wallets.reduce((sum, w) => sum + w.tokens, 0)}
          </p>
        </div>
      </div>

      {/* Wallets List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-100">Connected Wallets</h2>
          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary">
            Add Wallet
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">👛</div>
            <p className="text-surface-400 mb-4">No wallets connected</p>
            <button onClick={() => setIsAddModalOpen(true)} className="btn-secondary">
              Add Your First Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-4 bg-surface-800 rounded-lg hover:bg-surface-750 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-primary-400 font-medium">
                    {wallet.chain[0]}
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">{wallet.label}</p>
                    <p className="text-sm text-surface-400">{wallet.address}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-surface-700 rounded text-xs text-surface-300">
                    {wallet.chain}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-surface-100 font-tabular">
                    ${wallet.balance.toLocaleString()}
                  </p>
                  <p className="text-sm text-surface-400">{wallet.tokens} tokens</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supported Chains */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Supported Chains</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {supportedChains.map((chain) => (
            <div
              key={chain.id}
              className="flex flex-col items-center p-4 bg-surface-800 rounded-lg"
            >
              <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-primary-400 font-bold mb-2">
                {chain.icon}
              </div>
              <p className="text-sm text-surface-300">{chain.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Wallet Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-surface-100">Add Wallet</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-surface-400 hover:text-surface-100"
              >
                &times;
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Chain
                </label>
                <select className="input w-full">
                  {supportedChains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  className="input w-full font-mono"
                  placeholder="0x... or ENS name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="My Main Wallet"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
