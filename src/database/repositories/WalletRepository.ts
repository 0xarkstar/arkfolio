import { eq, and, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';
import {
  wallets,
  onchainAssets,
  type Wallet,
  type NewWallet,
  type OnchainAsset,
  type NewOnchainAsset,
} from '../schema';
import { BaseRepository } from './BaseRepository';
import { generateId } from '../init';
import { logger } from '../../utils/logger';

/**
 * Repository for wallet records
 */
class WalletRepositoryClass extends BaseRepository<typeof wallets, Wallet, NewWallet> {
  protected readonly table = wallets;
  protected readonly tableName = 'Wallet';

  /**
   * Find all wallets ordered by creation date
   */
  async findAllOrdered(): Promise<Wallet[]> {
    try {
      const db = this.getDb();
      return await db.select().from(wallets).orderBy(desc(wallets.createdAt));
    } catch (error) {
      logger.error('[WalletRepository] Failed to find all ordered:', error);
      throw error;
    }
  }

  /**
   * Find wallet by address and chain
   */
  async findByAddressAndChain(address: string, chain: string): Promise<Wallet | null> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.address, address.toLowerCase()), eq(wallets.chain, chain)))
        .limit(1);
      return results[0] || null;
    } catch (error) {
      logger.error('[WalletRepository] Failed to find by address and chain:', error);
      throw error;
    }
  }

  /**
   * Find wallets by chain
   */
  async findByChain(chain: string): Promise<Wallet[]> {
    try {
      const db = this.getDb();
      return await db.select().from(wallets).where(eq(wallets.chain, chain));
    } catch (error) {
      logger.error('[WalletRepository] Failed to find by chain:', error);
      throw error;
    }
  }

  /**
   * Update wallet timestamp
   */
  async touch(id: string): Promise<void> {
    try {
      const db = this.getDb();
      await db
        .update(wallets)
        .set({ updatedAt: new Date() })
        .where(eq(wallets.id, id));
    } catch (error) {
      logger.error('[WalletRepository] Failed to touch wallet:', error);
      throw error;
    }
  }

  /**
   * Create wallet with normalized address
   */
  async createWithNormalizedAddress(data: Omit<NewWallet, 'id'>): Promise<Wallet> {
    const id = generateId();
    const normalizedData = {
      ...data,
      id,
      address: data.address.toLowerCase(),
    };
    return this.create(normalizedData as NewWallet);
  }
}

/**
 * Repository for onchain asset records
 */
class OnchainAssetRepositoryClass extends BaseRepository<typeof onchainAssets, OnchainAsset, NewOnchainAsset> {
  protected readonly table = onchainAssets;
  protected readonly tableName = 'OnchainAsset';

  /**
   * Find assets by wallet ID
   */
  async findByWalletId(walletId: string): Promise<OnchainAsset[]> {
    try {
      const db = this.getDb();
      return await db.select().from(onchainAssets).where(eq(onchainAssets.walletId, walletId));
    } catch (error) {
      logger.error('[OnchainAssetRepository] Failed to find by wallet ID:', error);
      throw error;
    }
  }

  /**
   * Find NFTs by wallet ID
   */
  async findNftsByWalletId(walletId: string): Promise<OnchainAsset[]> {
    try {
      const db = this.getDb();
      return await db
        .select()
        .from(onchainAssets)
        .where(and(eq(onchainAssets.walletId, walletId), eq(onchainAssets.isNft, true)));
    } catch (error) {
      logger.error('[OnchainAssetRepository] Failed to find NFTs by wallet ID:', error);
      throw error;
    }
  }

  /**
   * Find all NFTs with wallet info
   */
  async findAllNftsWithWallet(): Promise<Array<{ asset: OnchainAsset; wallet: Wallet | null }>> {
    try {
      const db = this.getDb();
      return await db
        .select({ asset: onchainAssets, wallet: wallets })
        .from(onchainAssets)
        .leftJoin(wallets, eq(onchainAssets.walletId, wallets.id))
        .where(eq(onchainAssets.isNft, true));
    } catch (error) {
      logger.error('[OnchainAssetRepository] Failed to find all NFTs with wallet:', error);
      throw error;
    }
  }

  /**
   * Delete all assets for a wallet
   */
  async deleteByWalletId(walletId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(onchainAssets).where(eq(onchainAssets.walletId, walletId));
    } catch (error) {
      logger.error('[OnchainAssetRepository] Failed to delete by wallet ID:', error);
      throw error;
    }
  }

  /**
   * Sync assets for a wallet (delete old non-NFTs, insert new)
   */
  async syncForWallet(
    walletId: string,
    assets: Array<{
      contractAddress?: string;
      tokenSymbol?: string;
      tokenName?: string;
      balance: Decimal;
      decimals?: number;
      isNft?: boolean;
      tokenId?: string;
    }>
  ): Promise<void> {
    try {
      const db = this.getDb();
      // Delete existing non-NFT assets
      await db.delete(onchainAssets).where(
        and(eq(onchainAssets.walletId, walletId), eq(onchainAssets.isNft, false))
      );

      // Insert new assets
      for (const asset of assets) {
        await db.insert(onchainAssets).values({
          id: generateId(),
          walletId,
          contractAddress: asset.contractAddress,
          tokenSymbol: asset.tokenSymbol,
          tokenName: asset.tokenName,
          balance: asset.balance.toNumber(),
          decimals: asset.decimals,
          isNft: asset.isNft || false,
          tokenId: asset.tokenId,
          updatedAt: new Date(),
        });
      }
      logger.debug(`[OnchainAssetRepository] Synced ${assets.length} assets for wallet ${walletId}`);
    } catch (error) {
      logger.error('[OnchainAssetRepository] Failed to sync assets:', error);
      throw error;
    }
  }

  /**
   * Transform database asset to domain model with Decimal types
   */
  toDomainModel(dbAsset: OnchainAsset): {
    id: string;
    walletId: string;
    contractAddress: string | null;
    tokenSymbol: string | null;
    tokenName: string | null;
    balance: Decimal;
    decimals: number;
    isNft: boolean;
    tokenId: string | null;
    updatedAt: Date | null;
  } {
    return {
      id: dbAsset.id,
      walletId: dbAsset.walletId || '',
      contractAddress: dbAsset.contractAddress,
      tokenSymbol: dbAsset.tokenSymbol,
      tokenName: dbAsset.tokenName,
      balance: new Decimal(dbAsset.balance || 0),
      decimals: dbAsset.decimals || 18,
      isNft: dbAsset.isNft || false,
      tokenId: dbAsset.tokenId,
      updatedAt: dbAsset.updatedAt,
    };
  }
}

// Export singleton instances
export const WalletRepository = new WalletRepositoryClass();
export const OnchainAssetRepository = new OnchainAssetRepositoryClass();
