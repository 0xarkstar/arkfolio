import { NFT, NFTCollection } from '../../../stores/nftStore';
import { NftCard } from './NftCard';

interface NftGridProps {
  nfts: NFT[];
  collections?: NFTCollection[];
  groupByCollection?: boolean;
  onRemoveNft?: (nft: NFT) => void;
}

export function NftGrid({ nfts, collections, groupByCollection = false, onRemoveNft }: NftGridProps) {
  if (groupByCollection && collections && collections.length > 0) {
    return (
      <div className="space-y-8">
        {collections.map((collection) => (
          <div key={`${collection.chain}-${collection.contractAddress}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-surface-100">{collection.name}</h3>
                <p className="text-sm text-surface-400">
                  {collection.itemCount} item{collection.itemCount !== 1 ? 's' : ''} on {collection.chain}
                </p>
              </div>
              {collection.totalFloorValue.greaterThan(0) && (
                <div className="text-right">
                  <p className="text-sm text-surface-400">Total Floor</p>
                  <p className="font-bold text-surface-100 font-tabular">
                    ${collection.totalFloorValue.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {collection.items.map((nft) => (
                <NftCard key={nft.id} nft={nft} onRemove={onRemoveNft} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {nfts.map((nft) => (
        <NftCard key={nft.id} nft={nft} onRemove={onRemoveNft} />
      ))}
    </div>
  );
}
