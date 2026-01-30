import { useEffect, useState, useMemo } from 'react';
import { useWalletsStore, WalletWithBalances } from '../../stores/walletsStore';
import { Chain, CHAIN_CONFIGS } from '../../services/blockchain';
import { toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Select, Input } from '../../components/Input';
import { ChainAvatar, AssetAvatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { CopyButton } from '../../components/CopyButton';
import { Alert } from '../../components/Alert';
import { Modal, ModalFooter } from '../../components/Modal';
import { SkeletonCard } from '../../components/Skeleton';
import { NoConnectionEmptyState, NoResultsEmptyState } from '../../components/EmptyState';

type SortField = 'label' | 'chain' | 'value' | 'assets';
type SortDirection = 'asc' | 'desc';

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
  const [walletToRemove, setWalletToRemove] = useState<WalletWithBalances | null>(null);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChain, setFilterChain] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const totalValue = getTotalValueUsd();
  const uniqueChains = new Set(wallets.map((w) => w.chain)).size;
  const totalTokens = wallets.reduce((sum, w) => sum + w.tokenBalances.length, 0);

  // Get unique chains in wallets for filter dropdown
  const walletsChains = useMemo(() =>
    Array.from(new Set(wallets.map(w => w.chain))).sort(),
    [wallets]
  );

  // Filter and sort wallets
  const filteredAndSortedWallets = useMemo(() => {
    let filtered = wallets;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        w => w.label.toLowerCase().includes(query) ||
             w.address.toLowerCase().includes(query) ||
             CHAIN_CONFIGS[w.chain]?.name.toLowerCase().includes(query)
      );
    }

    // Apply chain filter
    if (filterChain !== 'all') {
      filtered = filtered.filter(w => w.chain === filterChain);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'label':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'chain':
          comparison = a.chain.localeCompare(b.chain);
          break;
        case 'value':
          comparison = a.totalValueUsd.minus(b.totalValueUsd).toNumber();
          break;
        case 'assets': {
          const assetsA = a.tokenBalances.length + (a.nativeBalance ? 1 : 0);
          const assetsB = b.tokenBalances.length + (b.nativeBalance ? 1 : 0);
          comparison = assetsA - assetsB;
          break;
        }
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [wallets, searchQuery, filterChain, sortField, sortDirection]);

  const handleExportCSV = () => {
    if (wallets.length === 0) {
      toast.error('No wallets to export');
      return;
    }

    const headers = ['Label', 'Address', 'Chain', 'Asset', 'Balance', 'Value (USD)'];
    const rows: string[][] = [];

    filteredAndSortedWallets.forEach(wallet => {
      const chainName = CHAIN_CONFIGS[wallet.chain]?.name || wallet.chain;

      // Add native balance
      if (wallet.nativeBalance && wallet.nativeBalance.balance.greaterThan(0)) {
        rows.push([
          wallet.label,
          wallet.address,
          chainName,
          wallet.nativeBalance.symbol,
          wallet.nativeBalance.balance.toFixed(8),
          wallet.nativeBalance.valueUsd?.toFixed(2) || '0',
        ]);
      }

      // Add token balances
      wallet.tokenBalances.forEach(token => {
        rows.push([
          wallet.label,
          wallet.address,
          chainName,
          token.token.symbol,
          token.balance.toFixed(8),
          token.valueUsd?.toFixed(2) || '0',
        ]);
      });
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallets-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Wallet balances exported to CSV');
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      await addWallet(newWalletAddress, newWalletChain, newWalletLabel);
      toast.success(`Added wallet ${newWalletLabel || formatAddress(newWalletAddress)}`);
      setIsAddModalOpen(false);
      setNewWalletAddress('');
      setNewWalletLabel('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add wallet';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveWallet = (wallet: WalletWithBalances) => {
    setWalletToRemove(wallet);
  };

  const confirmRemoveWallet = async () => {
    if (walletToRemove) {
      await removeWallet(walletToRemove.id);
      toast.info(`Removed ${walletToRemove.label}`);
      setSelectedWallet(null);
      setWalletToRemove(null);
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading && wallets.length === 0 ? (
          <>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total On-chain Value</p>
              <p className="text-2xl font-bold text-surface-100 font-tabular">
                {formatCurrency(totalValue.toNumber())}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Wallets</p>
              <p className="text-2xl font-bold text-surface-100">{wallets.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Chains</p>
              <p className="text-2xl font-bold text-surface-100">{uniqueChains}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total Tokens</p>
              <p className="text-2xl font-bold text-surface-100">{totalTokens}</p>
            </Card>
          </>
        )}
      </div>

      {/* Wallets List */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-surface-100">
            Connected Wallets
            {(searchQuery || filterChain !== 'all') && (
              <span className="text-surface-400 font-normal text-sm ml-2">
                ({filteredAndSortedWallets.length} of {wallets.length})
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search..."
              size="sm"
              className="w-32"
            />
            <Select
              value={filterChain}
              onChange={(e) => setFilterChain(e.target.value)}
              options={[
                { value: 'all', label: 'All Chains' },
                ...walletsChains.map(chain => ({
                  value: chain,
                  label: CHAIN_CONFIGS[chain]?.name || chain,
                })),
              ]}
              size="sm"
              className="w-32"
            />
            <Select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-');
                setSortField(field as SortField);
                setSortDirection(dir as SortDirection);
              }}
              options={[
                { value: 'value-desc', label: 'Value: High to Low' },
                { value: 'value-asc', label: 'Value: Low to High' },
                { value: 'label-asc', label: 'Name: A to Z' },
                { value: 'label-desc', label: 'Name: Z to A' },
                { value: 'chain-asc', label: 'Chain: A to Z' },
                { value: 'assets-desc', label: 'Assets: Most First' },
              ]}
              size="sm"
              className="w-40"
            />
            {wallets.length > 0 && (
              <Button onClick={handleExportCSV} variant="ghost" size="xs">
                Export CSV
              </Button>
            )}
            <Button onClick={() => setIsAddModalOpen(true)} size="sm">
              Add Wallet
            </Button>
          </div>
        </div>

        {isLoading && wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-surface-400">Loading wallets...</div>
          </div>
        ) : wallets.length === 0 ? (
          <NoConnectionEmptyState onConnect={() => setIsAddModalOpen(true)} />
        ) : filteredAndSortedWallets.length === 0 ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setFilterChain('all');
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredAndSortedWallets.map((wallet) => (
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
                  <ChainAvatar chain={wallet.chain} size="md" />
                  <div>
                    <p className="font-medium text-surface-100">{wallet.label}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-surface-400 font-mono">
                        {formatAddress(wallet.address)}
                      </p>
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <CopyButton text={wallet.address} iconSize={12} />
                      </span>
                    </div>
                  </div>
                  <Badge size="sm">{CHAIN_CONFIGS[wallet.chain]?.name || wallet.chain}</Badge>
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
      </Card>

      {/* Selected Wallet Details */}
      {selectedWallet && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-100">
              {selectedWallet.label} Details
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={() => syncWallet(selectedWallet.id)}
                disabled={selectedWallet.isLoading}
                variant="secondary"
                size="sm"
                loading={selectedWallet.isLoading}
              >
                Refresh
              </Button>
              <Button
                onClick={() => handleRemoveWallet(selectedWallet)}
                variant="danger"
                size="sm"
              >
                Remove
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-surface-400">Address</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-surface-200">{selectedWallet.address}</p>
              <CopyButton text={selectedWallet.address} />
            </div>
          </div>

          {/* Native Balance */}
          {selectedWallet.nativeBalance &&
            selectedWallet.nativeBalance.balance.greaterThan(0) && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-surface-300 mb-2">Native Balance</h3>
                <div className="flex items-center justify-between p-3 bg-surface-800 rounded">
                  <div className="flex items-center gap-3">
                    <AssetAvatar symbol={selectedWallet.nativeBalance.symbol} size="sm" />
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
                      <AssetAvatar symbol={token.token.symbol} size="sm" />
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
        </Card>
      )}

      {/* Supported Chains */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Supported Chains</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {SUPPORTED_CHAINS.map((chain) => (
            <div
              key={chain.id}
              className="flex flex-col items-center p-4 bg-surface-800 rounded-lg"
            >
              <ChainAvatar chain={chain.id} size="md" className="mb-2" />
              <p className="text-sm text-surface-300">{chain.name}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Wallet Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddError(null);
        }}
        title="Add Wallet"
        size="md"
      >
        {addError && (
          <Alert variant="error" className="mb-4" dismissible onDismiss={() => setAddError(null)}>
            {addError}
          </Alert>
        )}

        <form onSubmit={handleAddWallet} className="space-y-4">
          <Select
            label="Chain"
            value={newWalletChain}
            onChange={(e) => setNewWalletChain(e.target.value as Chain)}
            options={SUPPORTED_CHAINS.map((chain) => ({
              value: chain.id,
              label: chain.name,
            }))}
          />

          <Input
            label="Wallet Address"
            value={newWalletAddress}
            onChange={(e) => setNewWalletAddress(e.target.value)}
            className="font-mono"
            placeholder="0x..."
            required
          />

          <Input
            label="Label (Optional)"
            value={newWalletLabel}
            onChange={(e) => setNewWalletLabel(e.target.value)}
            placeholder="My Main Wallet"
          />

          <ModalFooter>
            <Button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setAddError(null);
              }}
              variant="secondary"
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isAdding || !newWalletAddress}
              loading={isAdding}
            >
              Add Wallet
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Remove Wallet Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!walletToRemove}
        title="Remove Wallet"
        message={`Are you sure you want to remove "${walletToRemove?.label}"? This will delete all tracked balances for this wallet.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemoveWallet}
        onCancel={() => setWalletToRemove(null)}
      />
    </div>
  );
}
