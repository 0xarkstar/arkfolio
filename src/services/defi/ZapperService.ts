import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { DefiPosition } from '../../stores/defiStore';

export interface ZapperApiConfig {
  apiKey: string;
}

interface ZapperAppBalance {
  appId: string;
  appName: string;
  network: string;
  balanceUSD: number;
  products: ZapperProduct[];
}

interface ZapperProduct {
  label: string;
  assets: ZapperAsset[];
  meta?: {
    apy?: number;
    healthFactor?: number;
  }[];
}

interface ZapperAsset {
  type: string;
  network: string;
  address: string;
  symbol: string;
  decimals: number;
  price: number;
  balance: number;
  balanceUSD: number;
  tokens?: ZapperToken[];
}

interface ZapperToken {
  symbol: string;
  balance: number;
  balanceUSD: number;
}

interface CachedPositions {
  positions: DefiPosition[];
  cachedAt: number;
}

// Map Zapper networks to our chain names
const ZAPPER_NETWORK_MAP: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  'binance-smart-chain': 'BSC',
  avalanche: 'Avalanche',
};

// Map Zapper app labels to our position types
function mapProductLabelToType(label: string): DefiPosition['positionType'] {
  const labelLower = label.toLowerCase();

  if (labelLower.includes('supply') || labelLower.includes('lending') || labelLower.includes('deposit')) {
    return 'lending';
  }
  if (labelLower.includes('borrow')) {
    return 'borrowing';
  }
  if (labelLower.includes('pool') || labelLower.includes('lp') || labelLower.includes('liquidity')) {
    return 'lp';
  }
  if (labelLower.includes('stake') || labelLower.includes('staking')) {
    return 'staking';
  }
  if (labelLower.includes('vault') || labelLower.includes('yield')) {
    return 'vault';
  }
  if (labelLower.includes('restake') || labelLower.includes('restaking')) {
    return 'restaking';
  }
  if (labelLower.includes('pt') || labelLower.includes('principal')) {
    return 'pt';
  }
  if (labelLower.includes('yt') || labelLower.includes('yield token')) {
    return 'yt';
  }

  return 'vault'; // Default
}

/**
 * ZapperService - Service for auto-detecting DeFi positions using Zapper API
 *
 * Features:
 * - Fetches DeFi positions for wallet addresses
 * - Normalizes position data to match app schema
 * - Local caching layer to minimize API calls
 * - Supports multiple protocols and chains
 */
class ZapperService {
  private static instance: ZapperService;
  private client: AxiosInstance | null = null;
  private apiKey: string | null = null;
  private cache: Map<string, CachedPositions> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private apiBaseUrl = 'https://api.zapper.xyz/v2';

  private constructor() {}

  static getInstance(): ZapperService {
    if (!ZapperService.instance) {
      ZapperService.instance = new ZapperService();
    }
    return ZapperService.instance;
  }

  /**
   * Configure the service with an API key
   */
  configure(config: ZapperApiConfig): void {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        Authorization: `Basic ${btoa(config.apiKey + ':')}`,
      },
    });
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.client !== null;
  }

  /**
   * Get API key (masked for display)
   */
  getApiKeyMasked(): string | null {
    if (!this.apiKey) return null;
    if (this.apiKey.length <= 8) return '****';
    return this.apiKey.slice(0, 4) + '****' + this.apiKey.slice(-4);
  }

  /**
   * Clear the API key configuration
   */
  clearConfig(): void {
    this.apiKey = null;
    this.client = null;
    this.cache.clear();
  }

  /**
   * Get DeFi positions for a wallet address
   */
  async getPositions(
    walletAddress: string,
    options: { skipCache?: boolean; walletId?: string } = {}
  ): Promise<DefiPosition[]> {
    if (!this.isConfigured()) {
      throw new Error('Zapper API not configured. Please set your API key in Settings.');
    }

    const cacheKey = walletAddress.toLowerCase();

    // Check cache
    if (!options.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        return cached.positions;
      }
    }

    try {
      const positions = await this.fetchPositions(walletAddress, options.walletId);

      // Update cache
      this.cache.set(cacheKey, {
        positions,
        cachedAt: Date.now(),
      });

      return positions;
    } catch (error) {
      console.error('Failed to fetch Zapper positions:', error);
      throw error;
    }
  }

  /**
   * Get positions for multiple wallets
   */
  async getPositionsForWallets(
    wallets: Array<{ address: string; id: string }>
  ): Promise<DefiPosition[]> {
    const allPositions: DefiPosition[] = [];

    // Process wallets sequentially to avoid rate limiting
    for (const wallet of wallets) {
      try {
        const positions = await this.getPositions(wallet.address, {
          walletId: wallet.id,
        });
        allPositions.push(...positions);
      } catch (error) {
        console.warn(`Failed to fetch positions for ${wallet.address}:`, error);
      }
    }

    return allPositions;
  }

  /**
   * Fetch positions from Zapper API
   */
  private async fetchPositions(
    walletAddress: string,
    walletId?: string
  ): Promise<DefiPosition[]> {
    if (!this.client) {
      throw new Error('Zapper API client not initialized');
    }

    const response = await this.client.get<ZapperAppBalance[]>('/apps/balances', {
      params: {
        'addresses[]': walletAddress.toLowerCase(),
      },
    });

    const positions: DefiPosition[] = [];
    let positionIndex = 0;

    for (const appBalance of response.data) {
      for (const product of appBalance.products) {
        // Extract assets and amounts
        const assets: string[] = [];
        const amounts: Decimal[] = [];
        let totalValue = new Decimal(0);

        for (const asset of product.assets) {
          if (asset.tokens && asset.tokens.length > 0) {
            // LP or multi-token position
            for (const token of asset.tokens) {
              assets.push(token.symbol);
              amounts.push(new Decimal(token.balance));
            }
          } else {
            assets.push(asset.symbol);
            amounts.push(new Decimal(asset.balance));
          }
          totalValue = totalValue.plus(asset.balanceUSD);
        }

        // Skip positions with zero value
        if (totalValue.lessThanOrEqualTo(0)) continue;

        // Extract metadata
        const meta = product.meta?.[0];
        const apy = meta?.apy || null;
        const healthFactor = meta?.healthFactor || null;

        const position: DefiPosition = {
          id: `zapper-${walletAddress}-${positionIndex++}`,
          walletId: walletId || walletAddress,
          protocol: appBalance.appName,
          positionType: mapProductLabelToType(product.label),
          poolAddress: null,
          assets,
          amounts,
          costBasisUsd: totalValue, // Zapper doesn't provide cost basis
          currentValueUsd: totalValue,
          rewardsEarned: {},
          apy,
          maturityDate: null,
          healthFactor,
          chain: ZAPPER_NETWORK_MAP[appBalance.network] || appBalance.network,
          updatedAt: new Date(),
        };

        positions.push(position);
      }
    }

    return positions;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific wallet
   */
  clearCacheForWallet(walletAddress: string): void {
    this.cache.delete(walletAddress.toLowerCase());
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Try to fetch a simple endpoint to verify the API key
      await this.client!.get('/apps', {
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error('Zapper API connection test failed:', error);
      return false;
    }
  }
}

export const zapperService = ZapperService.getInstance();
