import Decimal from 'decimal.js';
import {
  Chain,
  TokenBalance,
  NativeBalance,
  WalletSummary,
  OnchainTransaction,
} from './types';
import { EVMProvider } from './EVMProvider';
import { SolanaProvider } from './SolanaProvider';
import { CHAIN_CONFIGS, getEVMChains } from './chains';
import { priceService } from '../price';

interface WalletServiceConfig {
  apiKeys?: Partial<Record<Chain, string>>;
  enabledChains?: Chain[];
}

/**
 * Wallet Service for fetching balances across multiple chains
 */
class WalletService {
  private static instance: WalletService;
  private providers: Map<Chain, EVMProvider> = new Map();
  private solanaProvider: SolanaProvider;
  private config: WalletServiceConfig;

  private constructor(config: WalletServiceConfig = {}) {
    this.config = config;
    this.solanaProvider = new SolanaProvider();
    this.initializeProviders();
  }

  static getInstance(config?: WalletServiceConfig): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService(config);
    }
    return WalletService.instance;
  }

  private initializeProviders(): void {
    const evmChains = getEVMChains();
    const enabledChains = this.config.enabledChains || [...evmChains.map((c) => c.id), Chain.SOLANA];

    for (const chainConfig of evmChains) {
      if (!enabledChains.includes(chainConfig.id)) continue;

      const apiKey = this.config.apiKeys?.[chainConfig.id];
      this.providers.set(chainConfig.id, new EVMProvider(chainConfig.id, apiKey));
    }
  }

  /**
   * Set API key for a specific chain
   */
  setApiKey(chain: Chain, apiKey: string): void {
    if (!this.config.apiKeys) {
      this.config.apiKeys = {};
    }
    this.config.apiKeys[chain] = apiKey;

    // Reinitialize provider with new API key
    const config = CHAIN_CONFIGS[chain];
    if (config?.isEVM) {
      this.providers.set(chain, new EVMProvider(chain, apiKey));
    }
  }

  /**
   * Check if address is valid EVM address
   */
  isValidEVMAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Check if address is valid Solana address
   */
  isValidSolanaAddress(address: string): boolean {
    return this.solanaProvider.isValidAddress(address);
  }

  /**
   * Check if address is valid for the given chain
   */
  isValidAddress(address: string, chain: Chain): boolean {
    if (chain === Chain.SOLANA) {
      return this.isValidSolanaAddress(address);
    }
    return this.isValidEVMAddress(address);
  }

  /**
   * Get native balance for a single chain
   */
  async getNativeBalance(chain: Chain, address: string): Promise<NativeBalance | null> {
    try {
      if (chain === Chain.SOLANA) {
        return await this.solanaProvider.getNativeBalance(address);
      }

      const provider = this.providers.get(chain);
      if (!provider) {
        console.warn(`No provider for chain ${chain}`);
        return null;
      }

      return await provider.getNativeBalance(address);
    } catch (error) {
      console.error(`Failed to fetch native balance for ${chain}:`, error);
      return null;
    }
  }

  /**
   * Get all token balances for a single chain
   */
  async getTokenBalances(
    chain: Chain,
    address: string,
    useCommonOnly: boolean = false
  ): Promise<TokenBalance[]> {
    try {
      if (chain === Chain.SOLANA) {
        return await this.solanaProvider.getTokenBalances(address);
      }

      const provider = this.providers.get(chain);
      if (!provider) {
        console.warn(`No provider for chain ${chain}`);
        return [];
      }

      if (useCommonOnly) {
        return await provider.getCommonTokenBalances(address);
      }
      return await provider.getAllTokenBalances(address);
    } catch (error) {
      console.error(`Failed to fetch token balances for ${chain}:`, error);
      return [];
    }
  }

  /**
   * Get transaction history for a single chain
   */
  async getTransactionHistory(
    chain: Chain,
    address: string,
    limit: number = 100
  ): Promise<OnchainTransaction[]> {
    const provider = this.providers.get(chain);
    if (!provider) {
      console.warn(`No provider for chain ${chain}`);
      return [];
    }

    try {
      return await provider.getTransactionHistory(address, limit);
    } catch (error) {
      console.error(`Failed to fetch transactions for ${chain}:`, error);
      return [];
    }
  }

  /**
   * Get wallet summary across all enabled chains
   */
  async getWalletSummary(
    address: string,
    options: {
      chains?: Chain[];
      includeNFTs?: boolean;
      useCommonTokensOnly?: boolean;
    } = {}
  ): Promise<WalletSummary> {
    const chains = options.chains || Array.from(this.providers.keys());
    const useCommonOnly = options.useCommonTokensOnly ?? true;

    const chainResults = await Promise.all(
      chains.map(async (chain) => {
        const [nativeBalance, tokenBalances] = await Promise.all([
          this.getNativeBalance(chain, address),
          this.getTokenBalances(chain, address, useCommonOnly),
        ]);

        return {
          chain,
          nativeBalance: nativeBalance || {
            chain,
            walletAddress: address,
            symbol: CHAIN_CONFIGS[chain].nativeCurrency.symbol,
            balance: new Decimal(0),
            balanceRaw: '0',
          },
          tokenBalances,
          nftCount: 0, // NFT support to be added later
        };
      })
    );

    // Fetch prices for all assets
    const allSymbols = new Set<string>();
    chainResults.forEach((result) => {
      allSymbols.add(result.nativeBalance.symbol);
      result.tokenBalances.forEach((tb) => {
        allSymbols.add(tb.token.symbol);
      });
    });

    const prices = await priceService.getPrices(Array.from(allSymbols));

    // Calculate USD values
    let totalValueUsd = new Decimal(0);

    for (const result of chainResults) {
      // Native balance USD value
      const nativePrice = prices.get(result.nativeBalance.symbol);
      if (nativePrice) {
        result.nativeBalance.valueUsd = result.nativeBalance.balance.times(nativePrice.priceUsd);
        totalValueUsd = totalValueUsd.plus(result.nativeBalance.valueUsd);
      }

      // Token balance USD values
      for (const tokenBalance of result.tokenBalances) {
        const tokenPrice = prices.get(tokenBalance.token.symbol);
        if (tokenPrice) {
          tokenBalance.valueUsd = tokenBalance.balance.times(tokenPrice.priceUsd);
          totalValueUsd = totalValueUsd.plus(tokenBalance.valueUsd);
        }
      }
    }

    return {
      address,
      totalValueUsd,
      chains: chainResults,
    };
  }

  /**
   * Get balances for multiple wallets
   */
  async getMultiWalletBalances(
    addresses: string[],
    options: {
      chains?: Chain[];
      useCommonTokensOnly?: boolean;
    } = {}
  ): Promise<Map<string, WalletSummary>> {
    const results = new Map<string, WalletSummary>();

    // Process in parallel with some concurrency limit
    const batchSize = 3;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((address) => this.getWalletSummary(address, options))
      );

      batchResults.forEach((summary) => {
        results.set(summary.address, summary);
      });
    }

    return results;
  }

  /**
   * Get list of supported chains
   */
  getSupportedChains(): Chain[] {
    return [...Array.from(this.providers.keys()), Chain.SOLANA];
  }
}

export const walletService = WalletService.getInstance();
