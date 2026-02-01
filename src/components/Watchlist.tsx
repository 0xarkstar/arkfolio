import { useEffect, useState } from 'react';
import { useWatchlistStore, WatchlistItem } from '../stores/watchlistStore';
import { toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { SkeletonAssetRow } from './Skeleton';

// Common crypto assets for quick add
const POPULAR_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'ATOM', name: 'Cosmos' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'OP', name: 'Optimism' },
  { symbol: 'APT', name: 'Aptos' },
  { symbol: 'SUI', name: 'Sui' },
];

export function Watchlist() {
  const {
    items,
    prices,
    isLoading,
    loadWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    refreshPrices,
    isInWatchlist,
  } = useWatchlistStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName, setCustomName] = useState('');
  const [itemToRemove, setItemToRemove] = useState<WatchlistItem | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // Refresh prices periodically
  useEffect(() => {
    if (items.length === 0) return;

    const doRefresh = async () => {
      await refreshPrices();
      setLastRefresh(new Date());
    };

    doRefresh();
    const interval = setInterval(doRefresh, 60000);
    return () => clearInterval(interval);
  }, [items, refreshPrices]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPrices();
      setLastRefresh(new Date());
      toast.success('Watchlist prices updated');
    } catch {
      toast.error('Failed to refresh prices');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddCustom = async () => {
    if (!customSymbol.trim()) return;

    await addToWatchlist(
      customSymbol.trim(),
      customName.trim() || customSymbol.trim().toUpperCase()
    );
    toast.success(`Added ${customSymbol.toUpperCase()} to watchlist`);
    setCustomSymbol('');
    setCustomName('');
    setShowAddModal(false);
  };

  const handleQuickAdd = async (symbol: string, name: string) => {
    await addToWatchlist(symbol, name);
    toast.success(`Added ${symbol} to watchlist`);
  };

  const handleRemove = (item: WatchlistItem) => {
    setItemToRemove(item);
  };

  const confirmRemove = async () => {
    if (itemToRemove) {
      await removeFromWatchlist(itemToRemove.id);
      toast.info(`Removed ${itemToRemove.symbol} from watchlist`);
      setItemToRemove(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-surface-100">Watchlist</h2>
          {lastRefresh && items.length > 0 && (
            <p className="text-xs text-surface-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              variant="ghost"
              size="xs"
              loading={isRefreshing}
            >
              Refresh
            </Button>
          )}
          <Button
            onClick={() => setShowAddModal(true)}
            variant="ghost"
            size="sm"
          >
            + Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SkeletonAssetRow key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-3xl mb-2">&#9734;</div>
          <p className="text-surface-400 text-sm">No assets in watchlist</p>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="ghost"
            size="sm"
            className="mt-3"
          >
            Add your first asset
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const priceData = prices.get(item.symbol);
            const price = priceData?.priceUsd.toNumber() || 0;
            const change = priceData?.change24h || 0;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-3 bg-surface-800 rounded-lg group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium text-primary-400">
                    {item.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">{item.symbol}</p>
                    <p className="text-xs text-surface-500">{item.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium text-surface-100 font-tabular">
                      {price > 0 ? formatCurrency(price) : '-'}
                    </p>
                    <p className={`text-xs font-tabular ${change >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(item)}
                    className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-loss transition-opacity"
                    aria-label={`Remove ${item.symbol} from watchlist`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add to Watchlist"
        size="md"
      >
        {/* Quick Add */}
        <div className="mb-6">
          <p className="text-sm text-surface-400 mb-3">Popular Assets</p>
          <div className="grid grid-cols-4 gap-2">
            {POPULAR_ASSETS.filter(a => !isInWatchlist(a.symbol)).slice(0, 8).map((asset) => (
              <Button
                key={asset.symbol}
                onClick={() => handleQuickAdd(asset.symbol, asset.name)}
                variant="secondary"
                size="sm"
              >
                {asset.symbol}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Add */}
        <div className="border-t border-surface-700 pt-4">
          <p className="text-sm text-surface-400 mb-3">Or add custom asset</p>
          <div className="space-y-3">
            <Input
              type="text"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (e.g., DOGE)"
            />
            <Input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name (optional)"
            />
            <Button
              onClick={handleAddCustom}
              disabled={!customSymbol.trim()}
              variant="primary"
              className="w-full"
            >
              Add to Watchlist
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!itemToRemove}
        title="Remove from Watchlist"
        message={`Remove ${itemToRemove?.symbol} from your watchlist?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setItemToRemove(null)}
      />
    </Card>
  );
}
