import { useEffect, useState } from 'react';
import { useWalletsStore, WalletWithBalances } from '../../stores/walletsStore';
import { Chain, CHAIN_CONFIGS } from '../../services/blockchain';
import { toast } from '../../components/Toast';

const SUPPORTED_CHAINS = [
  { id: Chain.ETHEREUM, name: 'Ethereum', icon: 'E' },
  { id: Chain.ARBITRUM, name: 'Arbitrum', icon: 'A' },
  { id: Chain.OPTIMISM, name: 'Optimism', icon: 'O' },
  { id: Chain.BASE, name: 'Base', icon: 'B' },
  { id: Chain.POLYGON, name: 'Polygon', icon: 'P' },
  { id: Chain.BSC, name: 'BSC', icon: 'B' },
  { id: Chain.AVALANCHE, name: 'Avalanche', icon: 'A' },
  { id: Chain.SOLANA, name: 'Solana', icon: 'S' },
];

export function WalletsPage() {
  const {
    wallets,
    isLoading,
    loadWallets,
    addWallet,
    removeWallet,
    syncWallet,
    getTotalValueUsd,
  } = useWalletsStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWalletChain, setNewWalletChain] = useState<Chain>(Chain.ETHEREUM);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletWithBalances | null>(null);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const totalValue = getTotalValueUsd();
  const uniqueChains = new Set(wallets.map((w) => w.chain)).size;
  const totalTokens = wallets.reduce((sum, w) => sum + w.tokenBalances.length, 0);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      await addWallet(newWalletAddress, newWalletChain, newWalletLabel);
      setIsAddModalOpen(false);
      setNewWalletAddress('');
      setNewWalletLabel('');
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to add wallet');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    if (confirm('Are you sure you want to remove this wallet?')) {
      await removeWallet(walletId);
      setSelectedWallet(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBalance = (value: number) => {
    if (value >= 1000) return value.toFixed(2);
    if (value >= 1) return value.toFixed(4);
    if (value >= 0.0001) return value.toFixed(6);
    return value.toFixed(8);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Address copied to clipboard');
    } catch {
      toast.error('Failed to copy address');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total On-chain Value</p>
          <p className="text-2xl font-bold text-surface-100 font-tabular">
            {formatCurrency(totalValue.toNumber())}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Wallets</p>
          <p className="text-2xl font-bold text-surface-100">{wallets.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Chains</p>
          <p className="text-2xl font-bold text-surface-100">{uniqueChains}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total Tokens</p>
          <p className="text-2xl font-bold text-surface-100">{totalTokens}</p>
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

        {isLoading && wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-surface-400">Loading wallets...</div>
          </div>
        ) : wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">&#128091;</div>
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
                onClick={() => setSelectedWallet(wallet)}
                className={`group flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedWallet?.id === wallet.id
                    ? 'bg-primary-600/20 border border-primary-600'
                    : 'bg-surface-800 hover:bg-surface-750'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-primary-400 font-medium">
                    {CHAIN_CONFIGS[wallet.chain]?.name[0] || wallet.chain[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">{wallet.label}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-surface-400 font-mono">
                        {formatAddress(wallet.address)}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(wallet.address);
                        }}
                        className="p-0.5 text-surface-500 hover:text-surface-300 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy address"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-surface-700 rounded text-xs text-surface-300">
                    {CHAIN_CONFIGS[wallet.chain]?.name || wallet.chain}
                  </span>
                </div>
                <div className="text-right">
                  {wallet.isLoading ? (
                    <p className="text-surface-400 text-sm">Syncing...</p>
                  ) : wallet.error ? (
                    <p className="text-loss text-sm">{wallet.error}</p>
                  ) : (
                    <>
                      <p className="font-medium text-surface-100 font-tabular">
                        {formatCurrency(wallet.totalValueUsd.toNumber())}
                      </p>
                      <p className="text-sm text-surface-400">
                        {wallet.tokenBalances.length + (wallet.nativeBalance ? 1 : 0)} assets
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Wallet Details */}
      {selectedWallet && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-100">
              {selectedWallet.label} Details
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => syncWallet(selectedWallet.id)}
                disabled={selectedWallet.isLoading}
                className="btn-secondary text-sm"
              >
                {selectedWallet.isLoading ? 'Syncing...' : 'Refresh'}
              </button>
              <button
                onClick={() => handleRemoveWallet(selectedWallet.id)}
                className="px-3 py-1.5 bg-loss/20 hover:bg-loss/30 text-loss rounded text-sm transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-surface-400">Address</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-surface-200">{selectedWallet.address}</p>
              <button
                onClick={() => copyToClipboard(selectedWallet.address)}
                className="p-1 text-surface-400 hover:text-surface-200 transition-colors"
                title="Copy address"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Native Balance */}
          {selectedWallet.nativeBalance &&
            selectedWallet.nativeBalance.balance.greaterThan(0) && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-surface-300 mb-2">Native Balance</h3>
                <div className="flex items-center justify-between p-3 bg-surface-800 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium">
                      {selectedWallet.nativeBalance.symbol.slice(0, 2)}
                    </div>
                    <span className="font-medium text-surface-100">
                      {selectedWallet.nativeBalance.symbol}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-surface-100 font-tabular">
                      {formatBalance(selectedWallet.nativeBalance.balance.toNumber())}
                    </p>
                    {selectedWallet.nativeBalance.valueUsd && (
                      <p className="text-sm text-surface-400 font-tabular">
                        {formatCurrency(selectedWallet.nativeBalance.valueUsd.toNumber())}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Token Balances */}
          {selectedWallet.tokenBalances.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-surface-300 mb-2">Tokens</h3>
              <div className="space-y-2">
                {selectedWallet.tokenBalances.map((token, index) => (
                  <div
                    key={`${token.token.address}-${index}`}
                    className="flex items-center justify-between p-3 bg-surface-800 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {token.token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-surface-100">{token.token.symbol}</p>
                        <p className="text-xs text-surface-500">{token.token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-surface-100 font-tabular">
                        {formatBalance(token.balance.toNumber())}
                      </p>
                      {token.valueUsd && (
                        <p className="text-sm text-surface-400 font-tabular">
                          {formatCurrency(token.valueUsd.toNumber())}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedWallet.isLoading &&
            !selectedWallet.nativeBalance &&
            selectedWallet.tokenBalances.length === 0 && (
              <p className="text-surface-400 text-center py-4">No assets found</p>
            )}
        </div>
      )}

      {/* Supported Chains */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Supported Chains</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {SUPPORTED_CHAINS.map((chain) => (
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
                onClick={() => {
                  setIsAddModalOpen(false);
                  setAddError(null);
                }}
                className="text-surface-400 hover:text-surface-100 text-2xl"
              >
                &times;
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-loss/20 border border-loss/30 rounded text-loss text-sm">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddWallet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Chain
                </label>
                <select
                  value={newWalletChain}
                  onChange={(e) => setNewWalletChain(e.target.value as Chain)}
                  className="input w-full"
                >
                  {SUPPORTED_CHAINS.map((chain) => (
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
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  className="input w-full font-mono"
                  placeholder="0x..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={newWalletLabel}
                  onChange={(e) => setNewWalletLabel(e.target.value)}
                  className="input w-full"
                  placeholder="My Main Wallet"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddError(null);
                  }}
                  className="btn-secondary flex-1"
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isAdding || !newWalletAddress}
                >
                  {isAdding ? 'Adding...' : 'Add Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
