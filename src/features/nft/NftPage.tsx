import { useEffect, useState, useMemo } from 'react';
import { useNftStore, NFT } from '../../stores/nftStore';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Select, Input } from '../../components/Input';
import { Modal, ModalFooter } from '../../components/Modal';
import { Alert } from '../../components/Alert';
import { SkeletonCard, SectionLoading } from '../../components/Skeleton';
import { NoDataEmptyState, NoResultsEmptyState } from '../../components/EmptyState';
import { NftGrid } from './components/NftGrid';
import Decimal from 'decimal.js';

const SUPPORTED_CHAINS = ['all', 'ethereum', 'solana', 'sui', 'arbitrum', 'optimism', 'base', 'polygon'];

export function NftPage() {
  const {
    nfts,
    collections,
    isLoading,
    isSyncing,
    error,
    selectedChain,
    searchQuery,
    loadNfts,
    addNft,
    removeNft,
    refreshFloorPrices,
    setSelectedChain,
    setSearchQuery,
    getTotalValueUsd,
    getFilteredNfts,
  } = useNftStore();

  const { wallets, loadWallets } = useWalletsStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [nftToRemove, setNftToRemove] = useState<NFT | null>(null);
  const [groupByCollection, setGroupByCollection] = useState(true);

  // Form state
  const [formWalletId, setFormWalletId] = useState('');
  const [formContractAddress, setFormContractAddress] = useState('');
  const [formTokenId, setFormTokenId] = useState('');
  const [formTokenName, setFormTokenName] = useState('');
  const [formCollectionName, setFormCollectionName] = useState('');

  useEffect(() => {
    loadNfts();
    loadWallets();
  }, [loadNfts, loadWallets]);

  const resetForm = () => {
    setFormWalletId('');
    setFormContractAddress('');
    setFormTokenId('');
    setFormTokenName('');
    setFormCollectionName('');
    setAddError(null);
  };

  const handleAddNft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      if (!formWalletId) {
        throw new Error('Please select a wallet');
      }
      if (!formContractAddress.trim()) {
        throw new Error('Please enter a contract address');
      }
      if (!formTokenId.trim()) {
        throw new Error('Please enter a token ID');
      }

      const selectedWallet = wallets.find((w) => w.id === formWalletId);
      if (!selectedWallet) {
        throw new Error('Selected wallet not found');
      }

      // Determine chain from wallet type
      const chain = selectedWallet.walletType === 'SOLANA' ? 'solana' : 'ethereum';

      await addNft({
        walletId: formWalletId,
        walletAddress: selectedWallet.address,
        contractAddress: formContractAddress.trim(),
        tokenId: formTokenId.trim(),
        tokenName: formTokenName.trim() || null,
        tokenSymbol: null,
        chain,
        collectionName: formCollectionName.trim() || formTokenName.trim() || undefined,
      });

      toast.success('NFT added successfully');
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add NFT';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveNft = (nft: NFT) => {
    setNftToRemove(nft);
  };

  const confirmRemoveNft = async () => {
    if (nftToRemove) {
      await removeNft(nftToRemove.id);
      toast.info('NFT removed');
      setNftToRemove(null);
    }
  };

  const handleRefreshPrices = async () => {
    try {
      await refreshFloorPrices();
      toast.success('Floor prices refreshed');
    } catch (err) {
      toast.error('Failed to refresh floor prices');
    }
  };

  const filteredNfts = getFilteredNfts();
  const totalValue = getTotalValueUsd();

  // Get unique chains from NFTs
  const uniqueChains = useMemo(() => {
    const chains = new Set(nfts.map((n) => n.chain.toLowerCase()));
    return SUPPORTED_CHAINS.filter((c) => c === 'all' || chains.has(c));
  }, [nfts]);

  // Filter collections based on selected chain
  const filteredCollections = useMemo(() => {
    if (selectedChain === 'all') return collections;
    return collections.filter((c) => c.chain.toLowerCase() === selectedChain.toLowerCase());
  }, [collections, selectedChain]);

  // Stats
  const nftCount = nfts.length;
  const collectionCount = collections.length;
  const chainCount = new Set(nfts.map((n) => n.chain)).size;

  const formatCurrency = (value: Decimal | number) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">NFT Gallery</h1>
          <p className="text-surface-400 mt-1">Track your NFT collections across chains</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefreshPrices}
            variant="ghost"
            size="sm"
            loading={isSyncing}
            disabled={isSyncing || nfts.length === 0}
          >
            Refresh Prices
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="primary"
            disabled={wallets.length === 0}
          >
            Add NFT
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => {}}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading && nfts.length === 0 ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total NFTs</p>
              <p className="text-2xl font-bold text-surface-100">{nftCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Collections</p>
              <p className="text-2xl font-bold text-surface-100">{collectionCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Chains</p>
              <p className="text-2xl font-bold text-surface-100">{chainCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Est. Floor Value</p>
              <p className="text-2xl font-bold text-surface-100 font-tabular">
                {totalValue.greaterThan(0) ? formatCurrency(totalValue) : '-'}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search NFTs..."
              className="w-64"
            />
            <Select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              options={uniqueChains.map((chain) => ({
                value: chain,
                label: chain === 'all' ? 'All Chains' : chain.charAt(0).toUpperCase() + chain.slice(1),
              }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupByCollection(true)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                groupByCollection
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
              }`}
            >
              By Collection
            </button>
            <button
              onClick={() => setGroupByCollection(false)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                !groupByCollection
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
              }`}
            >
              All NFTs
            </button>
          </div>
        </div>
      </Card>

      {/* NFT Grid */}
      <Card className="p-6">
        {isLoading ? (
          <SectionLoading message="Loading NFTs..." />
        ) : nfts.length === 0 ? (
          <NoDataEmptyState
            onAction={() => setShowAddModal(true)}
          />
        ) : filteredNfts.length === 0 ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setSelectedChain('all');
            }}
          />
        ) : (
          <NftGrid
            nfts={filteredNfts}
            collections={filteredCollections}
            groupByCollection={groupByCollection}
            onRemoveNft={handleRemoveNft}
          />
        )}
      </Card>

      {/* Setup Notice */}
      {nfts.length === 0 && wallets.length === 0 && !isLoading && (
        <Card className="p-6 border-primary-600/30 bg-primary-600/5">
          <h3 className="text-lg font-semibold text-surface-100 mb-2">
            NFT Tracking
          </h3>
          <p className="text-surface-400 text-sm mb-4">
            To track your NFTs, first connect your wallets in the Wallets page.
            <br />
            Supported chains: Ethereum, Solana, SUI, Arbitrum, Optimism, Base, Polygon
          </p>
          <Button
            variant="primary"
            onClick={() => {
              const { setView } = useNftStore.getState() as any;
              if (typeof setView === 'function') {
                setView('wallets');
              }
            }}
          >
            Go to Wallets
          </Button>
        </Card>
      )}

      {/* Add NFT Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add NFT"
        size="md"
      >
        {addError && (
          <Alert variant="error" className="mb-4">
            {addError}
          </Alert>
        )}

        <form onSubmit={handleAddNft} className="space-y-4">
          <Select
            label="Wallet"
            value={formWalletId}
            onChange={(e) => setFormWalletId(e.target.value)}
            options={[
              { value: '', label: 'Select a wallet...' },
              ...wallets.map((w) => ({
                value: w.id,
                label: `${w.label || w.address.slice(0, 10) + '...'} (${w.walletType})`,
              })),
            ]}
            required
          />

          <Input
            label="Contract Address"
            type="text"
            value={formContractAddress}
            onChange={(e) => setFormContractAddress(e.target.value)}
            placeholder="0x..."
            required
          />

          <Input
            label="Token ID"
            type="text"
            value={formTokenId}
            onChange={(e) => setFormTokenId(e.target.value)}
            placeholder="1234"
            required
          />

          <Input
            label="Token Name (Optional)"
            type="text"
            value={formTokenName}
            onChange={(e) => setFormTokenName(e.target.value)}
            placeholder="Bored Ape #1234"
          />

          <Input
            label="Collection Name (Optional)"
            type="text"
            value={formCollectionName}
            onChange={(e) => setFormCollectionName(e.target.value)}
            placeholder="Bored Ape Yacht Club"
          />

          <ModalFooter>
            <Button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              variant="secondary"
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isAdding}
              loading={isAdding}
            >
              Add NFT
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Remove NFT Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!nftToRemove}
        title="Remove NFT"
        message={`Are you sure you want to remove ${nftToRemove?.tokenName || `NFT #${nftToRemove?.tokenId}`}?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemoveNft}
        onCancel={() => setNftToRemove(null)}
      />
    </div>
  );
}

export default NftPage;
