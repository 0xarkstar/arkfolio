import { NFT } from '../../../stores/nftStore';
import { Badge } from '../../../components/Badge';
import Decimal from 'decimal.js';

interface NftCardProps {
  nft: NFT;
  onRemove?: (nft: NFT) => void;
}

export function NftCard({ nft, onRemove }: NftCardProps) {
  const formatValue = (value: Decimal | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value.toNumber());
  };

  const getChainColor = (chain: string): 'default' | 'info' | 'success' | 'warning' => {
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return 'info';
      case 'solana':
        return 'success';
      case 'sui':
        return 'warning';
      default:
        return 'default';
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-surface-800 rounded-xl overflow-hidden hover:ring-1 hover:ring-primary-500/50 transition-all group">
      {/* Image placeholder */}
      <div className="aspect-square bg-surface-700 relative">
        {nft.imageUrl ? (
          <img
            src={nft.imageUrl}
            alt={nft.tokenName || `NFT #${nft.tokenId}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-surface-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}

        {/* Chain badge */}
        <div className="absolute top-2 left-2">
          <Badge variant={getChainColor(nft.chain)} size="sm">
            {nft.chain}
          </Badge>
        </div>

        {/* Remove button (on hover) */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(nft);
            }}
            className="absolute top-2 right-2 p-1.5 bg-surface-900/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-surface-400 hover:text-loss"
            title="Remove NFT"
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-surface-100 truncate">
            {nft.tokenName || nft.collectionName || 'Unknown'}
          </h3>
          <span className="text-xs text-surface-500 flex-shrink-0">
            #{nft.tokenId.length > 8 ? nft.tokenId.slice(0, 8) + '...' : nft.tokenId}
          </span>
        </div>

        {nft.collectionName && nft.tokenName !== nft.collectionName && (
          <p className="text-xs text-surface-400 mb-2 truncate">{nft.collectionName}</p>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-400">Floor</span>
          <span className="text-surface-100 font-tabular">
            {formatValue(nft.floorPrice)}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-surface-700">
          <p className="text-xs text-surface-500 truncate" title={nft.contractAddress}>
            {truncateAddress(nft.contractAddress)}
          </p>
        </div>
      </div>
    </div>
  );
}
