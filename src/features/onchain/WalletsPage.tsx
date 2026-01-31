import { useEffect, useState, useMemo } from 'react';
import { useWalletsStore, WalletWithBalances } from '../../stores/walletsStore';
import { CHAIN_CONFIGS } from '../../services/blockchain';
import { toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Select, Input, Switch } from '../../components/Input';
import { ChainAvatar, AssetAvatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { CopyButton } from '../../components/CopyButton';
import { Alert } from '../../components/Alert';
import { Modal, ModalFooter } from '../../components/Modal';
import { SkeletonCard, SectionLoading } from '../../components/Skeleton';
import { NoConnectionEmptyState, NoResultsEmptyState } from '../../components/EmptyState';
import { ChainSelectorModal, ChainType } from '../../components/ChainSelectorModal';
import { useWalletConnectionSync } from '../../hooks/useWalletConnectionSync';
import { useSolanaWalletSync } from '../../hooks/useSolanaWalletSync';
import { useSuiWalletSync } from '../../hooks/useSuiWalletSync';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWalletModal as useSolanaWalletModal } from '@solana/wallet-adapter-react-ui';
import { ConnectModal as SuiConnectModal } from '@mysten/dapp-kit';

type SortField = 'label' | 'type' | 'value' | 'chains';
type SortDirection = 'asc' | 'desc';

export function WalletsPage() {
  // Sync connected wallets from all chains to store
  useWalletConnectionSync();  // EVM (RainbowKit)
  useSolanaWalletSync();       // Solana
  useSuiWalletSync();          // SUI

  // Chain selector modal state
  const [isChainSelectorOpen, setIsChainSelectorOpen] = useState(false);

  // SUI wallet connect modal state
  const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

  // Wallet connection modals
  const { openConnectModal: openEvmModal } = useConnectModal();
  const { setVisible: openSolanaModal } = useSolanaWalletModal();

  const handleChainSelect = (chain: ChainType) => {
    switch (chain) {
      case 'evm':
        openEvmModal?.();
        break;
      case 'solana':
        openSolanaModal(true);
        break;
      case 'sui':
        // Open SUI connect modal
        setIsSuiModalOpen(true);
        break;
    }
  };

  const {
    wallets,
    isLoading,
    loadWallets,
    addWallet,
    removeWallet,
    syncWallet,
    getTotalValueUsd,
    showUnknownTokens,
    setShowUnknownTokens,
  } = useWalletsStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletWithBalances | null>(null);
  const [walletToRemove, setWalletToRemove] = useState<WalletWithBalances | null>(null);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const totalValue = getTotalValueUsd();
  const totalChains = wallets.reduce((sum, w) => sum + w.chainBalances.length, 0);
  const totalTokens = wallets.reduce(
    (sum, w) => sum + w.chainBalances.reduce((cs, cb) => cs + cb.tokenBalances.length + (cb.nativeBalance ? 1 : 0), 0),
    0
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
             w.walletType.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(w => w.walletType === filterType);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'label':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'type':
          comparison = a.walletType.localeCompare(b.walletType);
          break;
        case 'value':
          comparison = a.totalValueUsd.minus(b.totalValueUsd).toNumber();
          break;
        case 'chains':
          comparison = a.chainBalances.length - b.chainBalances.length;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [wallets, searchQuery, filterType, sortField, sortDirection]);

  const handleExportCSV = () => {
    if (wallets.length === 0) {
      toast.error('No wallets to export');
      return;
    }

    const headers = ['Label', 'Address', 'Type', 'Chain', 'Asset', 'Balance', 'Value (USD)'];
    const rows: string[][] = [];

    filteredAndSortedWallets.forEach(wallet => {
      wallet.chainBalances.forEach(chainBalance => {
        const chainName = CHAIN_CONFIGS[chainBalance.chain]?.name || chainBalance.chain;

        // Add native balance
        if (chainBalance.nativeBalance && chainBalance.nativeBalance.balance.greaterThan(0)) {
          rows.push([
            wallet.label,
            wallet.address,
            wallet.walletType,
            chainName,
            chainBalance.nativeBalance.symbol,
            chainBalance.nativeBalance.balance.toFixed(8),
            chainBalance.nativeBalance.valueUsd?.toFixed(2) || '0',
          ]);
        }

        // Add token balances
        chainBalance.tokenBalances.forEach(token => {
          rows.push([
            wallet.label,
            wallet.address,
            wallet.walletType,
            chainName,
            token.token.symbol,
            token.balance.toFixed(8),
            token.valueUsd?.toFixed(2) || '0',
          ]);
        });
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
      await addWallet(newWalletAddress, newWalletLabel);
      const type = /^0x[a-fA-F0-9]{40}$/.test(newWalletAddress) ? 'EVM' : 'Solana';
      toast.success(`Added ${type} wallet ${newWalletLabel || formatAddress(newWalletAddress)}`);
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

  const getWalletChainSummary = (wallet: WalletWithBalances) => {
    if (wallet.chainBalances.length === 0) return 'No assets';
    const chainNames = wallet.chainBalances
      .slice(0, 3)
      .map(cb => CHAIN_CONFIGS[cb.chain]?.name || cb.chain);
    const more = wallet.chainBalances.length > 3 ? ` +${wallet.chainBalances.length - 3}` : '';
    return chainNames.join(', ') + more;
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
              <p className="text-sm text-surface-400">Active Chains</p>
              <p className="text-2xl font-bold text-surface-100">{totalChains}</p>
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
            {(searchQuery || filterType !== 'all') && (
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
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'EVM', label: 'EVM Wallets' },
                { value: 'SOLANA', label: 'Solana Wallets' },
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
                { value: 'chains-desc', label: 'Chains: Most First' },
              ]}
              size="sm"
              className="w-40"
            />
            <div className="flex items-center gap-2 px-2 py-1 bg-surface-800 rounded-lg" title="Show tokens not listed on CoinGecko">
              <span className="text-xs text-surface-400 whitespace-nowrap">Unknown tokens</span>
              <Switch
                checked={showUnknownTokens}
                onChange={setShowUnknownTokens}
                size="sm"
              />
            </div>
            {wallets.length > 0 && (
              <Button onClick={handleExportCSV} variant="ghost" size="xs">
                Export CSV
              </Button>
            )}
            <Button onClick={() => setIsChainSelectorOpen(true)} size="sm" variant="primary">
              Connect Wallet
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} size="sm" variant="secondary">
              Add Manually
            </Button>
          </div>
        </div>

        {isLoading && wallets.length === 0 ? (
          <SectionLoading message="Loading wallets..." />
        ) : wallets.length === 0 ? (
          <NoConnectionEmptyState onConnect={() => setIsAddModalOpen(true)} />
        ) : filteredAndSortedWallets.length === 0 ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setFilterType('all');
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
                  <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-lg">
                    {wallet.walletType === 'EVM' ? '⟠' : '◎'}
                  </div>
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
                  <Badge size="sm" variant={wallet.walletType === 'EVM' ? 'primary' : 'info'}>
                    {wallet.walletType}
                  </Badge>
                  {wallet.chainBalances.length > 0 && (
                    <span className="text-xs text-surface-500">
                      {getWalletChainSummary(wallet)}
                    </span>
                  )}
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
                        {wallet.chainBalances.length} chains
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

          {/* Chain Balances */}
          {selectedWallet.chainBalances.length > 0 ? (
            <div className="space-y-6">
              {selectedWallet.chainBalances.map((chainBalance) => (
                <div key={chainBalance.chain}>
                  <div className="flex items-center gap-2 mb-3">
                    <ChainAvatar chain={chainBalance.chain} size="sm" />
                    <h3 className="text-sm font-medium text-surface-300">
                      {CHAIN_CONFIGS[chainBalance.chain]?.name || chainBalance.chain}
                    </h3>
                    <span className="text-xs text-surface-500">
                      {formatCurrency(chainBalance.totalValueUsd.toNumber())}
                    </span>
                  </div>

                  <div className="space-y-2 pl-6">
                    {/* Native Balance */}
                    {chainBalance.nativeBalance &&
                      chainBalance.nativeBalance.balance.greaterThan(0) && (
                        <div className="flex items-center justify-between p-3 bg-surface-800 rounded">
                          <div className="flex items-center gap-3">
                            <AssetAvatar symbol={chainBalance.nativeBalance.symbol} size="sm" />
                            <span className="font-medium text-surface-100">
                              {chainBalance.nativeBalance.symbol}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-surface-100 font-tabular">
                              {formatBalance(chainBalance.nativeBalance.balance.toNumber())}
                            </p>
                            {chainBalance.nativeBalance.valueUsd && (
                              <p className="text-sm text-surface-400 font-tabular">
                                {formatCurrency(chainBalance.nativeBalance.valueUsd.toNumber())}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Token Balances */}
                    {chainBalance.tokenBalances.map((token, index) => (
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
              ))}
            </div>
          ) : (
            !selectedWallet.isLoading && (
              <p className="text-surface-400 text-center py-4">No assets found</p>
            )
          )}
        </Card>
      )}

      {/* Supported Chains Info */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Supported Chains</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔷</span>
              <span className="font-medium text-surface-200">EVM Wallets</span>
            </div>
            <p className="text-sm text-surface-400">
              One address works across Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche
            </p>
            <p className="text-xs text-surface-500 mt-2">
              MetaMask, Rainbow, Coinbase Wallet
            </p>
          </div>
          <div className="p-4 bg-surface-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">☀️</span>
              <span className="font-medium text-surface-200">Solana Wallets</span>
            </div>
            <p className="text-sm text-surface-400">
              Solana blockchain with SPL tokens
            </p>
            <p className="text-xs text-surface-500 mt-2">
              Phantom, Solflare, Backpack
            </p>
          </div>
          <div className="p-4 bg-surface-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">💧</span>
              <span className="font-medium text-surface-200">SUI Wallets</span>
            </div>
            <p className="text-sm text-surface-400">
              SUI blockchain with Move-based tokens
            </p>
            <p className="text-xs text-surface-500 mt-2">
              Sui Wallet, Suiet, Ethos
            </p>
          </div>
        </div>
      </Card>

      {/* Chain Selector Modal */}
      <ChainSelectorModal
        isOpen={isChainSelectorOpen}
        onClose={() => setIsChainSelectorOpen(false)}
        onSelectChain={handleChainSelect}
      />

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
          <div>
            <Input
              label="Wallet Address"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="font-mono"
              placeholder="0x... (EVM) or Solana address"
              required
            />
            <p className="text-xs text-surface-500 mt-1">
              EVM addresses (0x...) will be tracked across all EVM chains automatically
            </p>
          </div>

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

      {/* SUI Wallet Connect Modal */}
      <SuiConnectModal
        trigger={<span style={{ display: 'none' }} />}
        open={isSuiModalOpen}
        onOpenChange={setIsSuiModalOpen}
      />
    </div>
  );
}
