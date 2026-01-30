import axios from 'axios';
import { Chain } from './types';

export interface TokenMetadata {
  id: string;
  symbol: string;
  name: string;
  platforms: Record<string, string>; // chainId -> contractAddress
  logoUrl?: string;
}

interface CoinGeckoToken {
  id: string;
  symbol: string;
  name: string;
  platforms: Record<string, string>;
}

interface CachedTokenList {
  tokens: Map<string, TokenMetadata>;
  addressToId: Map<string, string>;
  cachedAt: number;
}

// Map Chain enum to CoinGecko platform keys
const CHAIN_TO_COINGECKO_PLATFORM: Record<Chain, string> = {
  [Chain.ETHEREUM]: 'ethereum',
  [Chain.ARBITRUM]: 'arbitrum-one',
  [Chain.OPTIMISM]: 'optimistic-ethereum',
  [Chain.BASE]: 'base',
  [Chain.POLYGON]: 'polygon-pos',
  [Chain.BSC]: 'binance-smart-chain',
  [Chain.AVALANCHE]: 'avalanche',
  [Chain.SOLANA]: 'solana',
};

/**
 * TokenRegistry - Service for filtering and validating tokens using CoinGecko's token list
 *
 * Features:
 * - Caches CoinGecko token list
 * - Validates if a token address is "known" (registered on CoinGecko)
 * - Provides token metadata (name, symbol, logo)
 * - Multi-chain support
 */
class TokenRegistry {
  private static instance: TokenRegistry;
  private cache: CachedTokenList | null = null;
  private cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours
  private loadPromise: Promise<void> | null = null;
  private apiBaseUrl = 'https://api.coingecko.com/api/v3';
  private lastRequestTime = 0;
  private minRequestInterval = 1500; // 1.5 seconds between requests

  private constructor() {}

  static getInstance(): TokenRegistry {
    if (!TokenRegistry.instance) {
      TokenRegistry.instance = new TokenRegistry();
    }
    return TokenRegistry.instance;
  }

  /**
   * Load the token list from CoinGecko
   */
  async loadTokenList(): Promise<void> {
    // If already loading, wait for the existing promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Check if cache is still valid
    if (this.cache && Date.now() - this.cache.cachedAt < this.cacheTtlMs) {
      return;
    }

    this.loadPromise = this.fetchTokenList();

    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Fetch token list from CoinGecko API
   */
  private async fetchTokenList(): Promise<void> {
    await this.rateLimitWait();

    try {
      // Fetch the full token list with platform info
      const response = await axios.get<CoinGeckoToken[]>(
        `${this.apiBaseUrl}/coins/list`,
        {
          params: {
            include_platform: true,
          },
          timeout: 30000,
        }
      );

      this.lastRequestTime = Date.now();

      const tokens = new Map<string, TokenMetadata>();
      const addressToId = new Map<string, string>();

      for (const token of response.data) {
        const metadata: TokenMetadata = {
          id: token.id,
          symbol: token.symbol.toUpperCase(),
          name: token.name,
          platforms: token.platforms || {},
        };

        tokens.set(token.id, metadata);

        // Index all contract addresses
        for (const [platform, address] of Object.entries(token.platforms)) {
          if (address) {
            const normalizedAddress = address.toLowerCase();
            addressToId.set(`${platform}:${normalizedAddress}`, token.id);
          }
        }
      }

      this.cache = {
        tokens,
        addressToId,
        cachedAt: Date.now(),
      };

      console.log(`TokenRegistry: Loaded ${tokens.size} tokens from CoinGecko`);
    } catch (error) {
      console.error('TokenRegistry: Failed to load token list:', error);
      // Keep existing cache if available
      if (!this.cache) {
        // Initialize with empty cache on first load failure
        this.cache = {
          tokens: new Map(),
          addressToId: new Map(),
          cachedAt: Date.now() - this.cacheTtlMs + 5 * 60 * 1000, // Retry in 5 minutes
        };
      }
    }
  }

  /**
   * Check if a token is registered on CoinGecko
   */
  async isRegisteredToken(address: string, chain: Chain): Promise<boolean> {
    await this.loadTokenList();

    if (!this.cache) return false;

    const platform = CHAIN_TO_COINGECKO_PLATFORM[chain];
    if (!platform) return false;

    const normalizedAddress = address.toLowerCase();
    return this.cache.addressToId.has(`${platform}:${normalizedAddress}`);
  }

  /**
   * Get token metadata by contract address
   */
  async getTokenMetadata(address: string, chain: Chain): Promise<TokenMetadata | null> {
    await this.loadTokenList();

    if (!this.cache) return null;

    const platform = CHAIN_TO_COINGECKO_PLATFORM[chain];
    if (!platform) return null;

    const normalizedAddress = address.toLowerCase();
    const tokenId = this.cache.addressToId.get(`${platform}:${normalizedAddress}`);

    if (!tokenId) return null;

    return this.cache.tokens.get(tokenId) || null;
  }

  /**
   * Get token metadata by CoinGecko ID
   */
  async getTokenById(id: string): Promise<TokenMetadata | null> {
    await this.loadTokenList();

    if (!this.cache) return null;

    return this.cache.tokens.get(id) || null;
  }

  /**
   * Get token metadata by symbol (may return multiple matches)
   */
  async getTokensBySymbol(symbol: string): Promise<TokenMetadata[]> {
    await this.loadTokenList();

    if (!this.cache) return [];

    const upperSymbol = symbol.toUpperCase();
    const matches: TokenMetadata[] = [];

    for (const metadata of this.cache.tokens.values()) {
      if (metadata.symbol === upperSymbol) {
        matches.push(metadata);
      }
    }

    return matches;
  }

  /**
   * Filter a list of token addresses to only include registered tokens
   */
  async filterRegisteredTokens(
    addresses: string[],
    chain: Chain
  ): Promise<{ registered: string[]; unregistered: string[] }> {
    await this.loadTokenList();

    const registered: string[] = [];
    const unregistered: string[] = [];

    for (const address of addresses) {
      const isRegistered = await this.isRegisteredToken(address, chain);
      if (isRegistered) {
        registered.push(address);
      } else {
        unregistered.push(address);
      }
    }

    return { registered, unregistered };
  }

  /**
   * Check if the registry is loaded
   */
  isLoaded(): boolean {
    return this.cache !== null && Date.now() - this.cache.cachedAt < this.cacheTtlMs;
  }

  /**
   * Get the number of tokens in the registry
   */
  getTokenCount(): number {
    return this.cache?.tokens.size || 0;
  }

  /**
   * Clear the cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Rate limit wait
   */
  private async rateLimitWait(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
  }
}

export const tokenRegistry = TokenRegistry.getInstance();
