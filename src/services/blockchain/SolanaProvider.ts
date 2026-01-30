import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { Chain, TokenBalance, NativeBalance, TokenInfo } from './types';

interface SolscanTokenAccount {
  tokenAddress: string;
  tokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  };
  tokenAccount: string;
  tokenName: string;
  tokenIcon: string;
  tokenSymbol: string;
  priceUsdt: number;
}

interface SolscanAccountInfo {
  lamports: number;
  ownerProgram: string;
  type: string;
  rentEpoch: number;
  account: string;
}

// Common Solana token addresses
const COMMON_SPL_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  So11111111111111111111111111111111111111112: { symbol: 'WSOL', name: 'Wrapped SOL', decimals: 9 },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9 },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: { symbol: 'RENDER', name: 'Render Token', decimals: 8 },
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: { symbol: 'PYTH', name: 'Pyth Network', decimals: 6 },
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: { symbol: 'JTO', name: 'Jito', decimals: 9 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 8 },
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
};

/**
 * Solana Provider for fetching balances from Solana blockchain
 * Uses Solscan public API for token balances
 */
export class SolanaProvider {
  private client: AxiosInstance;
  private lastRequestTime = 0;
  private minRequestInterval = 500; // 2 requests per second

  private readonly SOLSCAN_API = 'https://public-api.solscan.io';
  private readonly LAMPORTS_PER_SOL = 1_000_000_000;

  constructor() {
    this.client = axios.create({
      baseURL: this.SOLSCAN_API,
      timeout: 30000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  /**
   * Validate Solana address
   */
  isValidAddress(address: string): boolean {
    // Solana addresses are base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  /**
   * Get SOL balance
   */
  async getNativeBalance(address: string): Promise<NativeBalance> {
    await this.rateLimitWait();

    try {
      const response = await this.client.get<SolscanAccountInfo>(`/account/${address}`);
      const lamports = response.data.lamports || 0;
      const balance = new Decimal(lamports).dividedBy(this.LAMPORTS_PER_SOL);

      return {
        chain: Chain.SOLANA,
        walletAddress: address,
        symbol: 'SOL',
        balance,
        balanceRaw: String(lamports),
      };
    } catch (error) {
      // Return zero balance if account not found
      return {
        chain: Chain.SOLANA,
        walletAddress: address,
        symbol: 'SOL',
        balance: new Decimal(0),
        balanceRaw: '0',
      };
    }
  }

  /**
   * Get all SPL token balances
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    await this.rateLimitWait();

    try {
      const response = await this.client.get<SolscanTokenAccount[]>(`/account/tokens`, {
        params: { account: address },
      });

      const balances: TokenBalance[] = [];

      for (const token of response.data) {
        if (!token.tokenAmount || token.tokenAmount.uiAmount <= 0) continue;

        const knownToken = COMMON_SPL_TOKENS[token.tokenAddress];

        balances.push({
          chain: Chain.SOLANA,
          walletAddress: address,
          token: {
            address: token.tokenAddress,
            symbol: knownToken?.symbol || token.tokenSymbol || 'UNKNOWN',
            name: knownToken?.name || token.tokenName || 'Unknown Token',
            decimals: token.tokenAmount.decimals,
            logoUrl: token.tokenIcon,
          },
          balance: new Decimal(token.tokenAmount.uiAmountString || token.tokenAmount.uiAmount),
          balanceRaw: token.tokenAmount.amount,
          valueUsd: token.priceUsdt
            ? new Decimal(token.tokenAmount.uiAmount).times(token.priceUsdt)
            : undefined,
        });
      }

      return balances;
    } catch (error) {
      console.error('Failed to fetch Solana token balances:', error);
      return [];
    }
  }

  /**
   * Get token info by mint address
   */
  async getTokenInfo(mintAddress: string): Promise<TokenInfo | null> {
    const known = COMMON_SPL_TOKENS[mintAddress];
    if (known) {
      return {
        address: mintAddress,
        symbol: known.symbol,
        name: known.name,
        decimals: known.decimals,
      };
    }

    await this.rateLimitWait();

    try {
      const response = await this.client.get(`/token/meta`, {
        params: { token: mintAddress },
      });

      return {
        address: mintAddress,
        symbol: response.data.symbol || 'UNKNOWN',
        name: response.data.name || 'Unknown Token',
        decimals: response.data.decimals || 9,
        logoUrl: response.data.icon,
      };
    } catch {
      return null;
    }
  }

  /**
   * Rate limit wait
   */
  private async rateLimitWait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }
}
