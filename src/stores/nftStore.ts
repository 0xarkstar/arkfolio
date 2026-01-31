import { create } from 'zustand';
import Decimal from 'decimal.js';
import { getDb, generateId } from '../database/init';
import { onchainAssets, wallets } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface NFT {
  id: string;
  walletId: string;
  walletAddress: string;
  contractAddress: string;
  tokenId: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  chain: string;
  imageUrl?: string;
  collectionName?: string;
  floorPrice?: Decimal;
  lastSalePrice?: Decimal;
  updatedAt: Date;
}

export interface NFTCollection {
  contractAddress: string;
  name: string;
  chain: string;
  items: NFT[];
  totalFloorValue: Decimal;
  itemCount: number;
}

interface NftState {
  nfts: NFT[];
  collections: NFTCollection[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  selectedChain: string;
  searchQuery: string;

  // Actions
  loadNfts: () => Promise<void>;
  addNft: (nft: Omit<NFT, 'id' | 'updatedAt'>) => Promise<string>;
  updateNft: (id: string, updates: Partial<NFT>) => Promise<void>;
  removeNft: (id: string) => Promise<void>;
  refreshFloorPrices: () => Promise<void>;
  setSelectedChain: (chain: string) => void;
  setSearchQuery: (query: string) => void;

  // Getters
  getTotalValueUsd: () => Decimal;
  getNftsByChain: (chain: string) => NFT[];
  getCollections: () => NFTCollection[];
  getFilteredNfts: () => NFT[];
}

export const useNftStore = create<NftState>((set, get) => ({
  nfts: [],
  collections: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  selectedChain: 'all',
  searchQuery: '',

  loadNfts: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();

      // Load NFTs from onchain_assets where is_nft = true
      const dbNfts = await db
        .select({
          asset: onchainAssets,
          wallet: wallets,
        })
        .from(onchainAssets)
        .leftJoin(wallets, eq(onchainAssets.walletId, wallets.id))
        .where(eq(onchainAssets.isNft, true));

      const loadedNfts: NFT[] = dbNfts.map((row) => ({
        id: row.asset.id,
        walletId: row.asset.walletId || '',
        walletAddress: row.wallet?.address || '',
        contractAddress: row.asset.contractAddress || '',
        tokenId: row.asset.tokenId || '',
        tokenName: row.asset.tokenName,
        tokenSymbol: row.asset.tokenSymbol,
        chain: row.wallet?.chain || 'ethereum',
        imageUrl: undefined, // Would need separate metadata fetch
        collectionName: row.asset.tokenName || undefined, // Use token name as collection name
        floorPrice: undefined,
        lastSalePrice: undefined,
        updatedAt: row.asset.updatedAt ? new Date(row.asset.updatedAt as unknown as number) : new Date(),
      }));

      // Group into collections
      const collectionsMap = new Map<string, NFTCollection>();
      for (const nft of loadedNfts) {
        const key = `${nft.chain}-${nft.contractAddress}`;
        if (!collectionsMap.has(key)) {
          collectionsMap.set(key, {
            contractAddress: nft.contractAddress,
            name: nft.collectionName || nft.tokenSymbol || 'Unknown Collection',
            chain: nft.chain,
            items: [],
            totalFloorValue: new Decimal(0),
            itemCount: 0,
          });
        }
        const collection = collectionsMap.get(key)!;
        collection.items.push(nft);
        collection.itemCount++;
        if (nft.floorPrice) {
          collection.totalFloorValue = collection.totalFloorValue.plus(nft.floorPrice);
        }
      }

      set({
        nfts: loadedNfts,
        collections: Array.from(collectionsMap.values()),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load NFTs:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load NFTs',
        isLoading: false,
      });
    }
  },

  addNft: async (nft) => {
    const db = getDb();
    const id = generateId();

    await db.insert(onchainAssets).values({
      id,
      walletId: nft.walletId,
      contractAddress: nft.contractAddress,
      tokenSymbol: nft.tokenSymbol,
      tokenName: nft.tokenName,
      balance: 1, // NFTs have balance of 1
      decimals: 0,
      isNft: true,
      tokenId: nft.tokenId,
      updatedAt: new Date(),
    });

    const newNft: NFT = {
      ...nft,
      id,
      updatedAt: new Date(),
    };

    set((state) => ({
      nfts: [...state.nfts, newNft],
    }));

    // Reload to update collections
    await get().loadNfts();

    return id;
  },

  updateNft: async (id, updates) => {
    const db = getDb();
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.tokenName !== undefined) dbUpdates.tokenName = updates.tokenName;
    if (updates.tokenSymbol !== undefined) dbUpdates.tokenSymbol = updates.tokenSymbol;

    await db.update(onchainAssets).set(dbUpdates).where(eq(onchainAssets.id, id));

    set((state) => ({
      nfts: state.nfts.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n
      ),
    }));
  },

  removeNft: async (id) => {
    const db = getDb();
    await db.delete(onchainAssets).where(eq(onchainAssets.id, id));

    set((state) => ({
      nfts: state.nfts.filter((n) => n.id !== id),
    }));

    // Reload to update collections
    await get().loadNfts();
  },

  refreshFloorPrices: async () => {
    set({ isSyncing: true });

    try {
      // In a real implementation, this would fetch floor prices from APIs
      // like OpenSea, Magic Eden, BlueMove, etc.
      // For now, we just simulate a sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      set({ isSyncing: false });
    } catch (error) {
      console.error('Failed to refresh floor prices:', error);
      set({
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Failed to refresh floor prices',
      });
    }
  },

  setSelectedChain: (chain) => {
    set({ selectedChain: chain });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  getTotalValueUsd: () => {
    const { nfts } = get();
    return nfts.reduce((sum, n) => {
      if (n.floorPrice) {
        return sum.plus(n.floorPrice);
      }
      return sum;
    }, new Decimal(0));
  },

  getNftsByChain: (chain) => {
    const { nfts } = get();
    if (chain === 'all') return nfts;
    return nfts.filter((n) => n.chain.toLowerCase() === chain.toLowerCase());
  },

  getCollections: () => {
    return get().collections;
  },

  getFilteredNfts: () => {
    const { nfts, selectedChain, searchQuery } = get();

    let filtered = nfts;

    // Filter by chain
    if (selectedChain !== 'all') {
      filtered = filtered.filter((n) => n.chain.toLowerCase() === selectedChain.toLowerCase());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.tokenName?.toLowerCase().includes(query) ||
          n.tokenSymbol?.toLowerCase().includes(query) ||
          n.collectionName?.toLowerCase().includes(query) ||
          n.contractAddress.toLowerCase().includes(query) ||
          n.tokenId.toLowerCase().includes(query)
      );
    }

    return filtered;
  },
}));
