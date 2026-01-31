import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { createPublicClient, http, erc20Abi, type Chain as ViemChain } from 'viem';
import { httpWithRetry, HttpError, HttpErrorType } from '../utils/httpUtils';
import { mainnet, arbitrum, optimism, base, polygon, bsc, avalanche } from 'viem/chains';
import {
  Chain,
  ChainConfig,
  TokenBalance,
  NativeBalance,
  TokenInfo,
  OnchainTransaction,
  TokenTransfer,
} from './types';
import { CHAIN_CONFIGS, COMMON_TOKENS } from './chains';
import { tokenRegistry } from './TokenRegistry';

// Map internal Chain enum to viem chains (EVM only)
const VIEM_CHAINS: Record<string, ViemChain> = {
  [Chain.ETHEREUM]: mainnet,
  [Chain.ARBITRUM]: arbitrum,
  [Chain.OPTIMISM]: optimism,
  [Chain.BASE]: base,
  [Chain.POLYGON]: polygon,
  [Chain.BSC]: bsc,
  [Chain.AVALANCHE]: avalanche,
};

interface EtherscanTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
}

interface EtherscanNormalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  functionName: string;
}

/**
 * EVM Provider for fetching on-chain data from EVM-compatible chains
 * Uses viem for balance queries (more reliable) and block explorer APIs for transaction history
 */
export class EVMProvider {
  private chain: Chain;
  private config: ChainConfig;
  private client: AxiosInstance;
  private viemClient: ReturnType<typeof createPublicClient>;
  private apiKey?: string;
  private lastRequestTime = 0;
  private minRequestInterval = 250;

  constructor(chain: Chain, apiKey?: string) {
    this.chain = chain;
    this.config = CHAIN_CONFIGS[chain];
    this.apiKey = apiKey;

    if (!this.config.isEVM) {
      throw new Error(`Chain ${chain} is not an EVM chain`);
    }

    // Create viem public client for RPC calls
    const viemChain = VIEM_CHAINS[chain] || mainnet;
    this.viemClient = createPublicClient({
      chain: viemChain,
      transport: http(this.config.rpcUrls[0]),
    });

    // Axios client for block explorer APIs (used for transaction history)
    this.client = axios.create({
      baseURL: this.config.blockExplorer.apiUrl,
      timeout: 30000,
    });
  }

  /**
   * Get native token balance (ETH, MATIC, etc.) using viem
   */
  async getNativeBalance(address: string): Promise<NativeBalance> {
    try {
      const balance = await this.viemClient.getBalance({
        address: address as `0x${string}`,
      });

      const balanceDecimal = new Decimal(balance.toString()).dividedBy(
        new Decimal(10).pow(this.config.nativeCurrency.decimals)
      );

      return {
        chain: this.chain,
        walletAddress: address,
        symbol: this.config.nativeCurrency.symbol,
        balance: balanceDecimal,
        balanceRaw: balance.toString(),
      };
    } catch (error) {
      console.error(`Failed to fetch native balance for ${this.chain}:`, error);
      return {
        chain: this.chain,
        walletAddress: address,
        symbol: this.config.nativeCurrency.symbol,
        balance: new Decimal(0),
        balanceRaw: '0',
      };
    }
  }

  /**
   * Get ERC-20 token balance for a specific token using viem
   */
  async getTokenBalance(address: string, tokenAddress: string): Promise<TokenBalance | null> {
    try {
      // Get token balance
      const balance = await this.viemClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      if (balance === 0n) return null;

      // Get token info
      const tokenInfo = await this.getTokenInfoFromContract(tokenAddress);
      if (!tokenInfo) return null;

      const balanceDecimal = new Decimal(balance.toString()).dividedBy(
        new Decimal(10).pow(tokenInfo.decimals)
      );

      return {
        chain: this.chain,
        walletAddress: address,
        token: tokenInfo,
        balance: balanceDecimal,
        balanceRaw: balance.toString(),
      };
    } catch (error) {
      // Token might not exist or be a proxy - skip silently
      return null;
    }
  }

  /**
   * Get token info from contract using viem
   */
  private async getTokenInfoFromContract(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      // Check common tokens first
      for (const [symbol, addr] of Object.entries(COMMON_TOKENS[this.chain] || {})) {
        if (addr.toLowerCase() === tokenAddress.toLowerCase()) {
          // Get decimals from contract
          let decimals = 18;
          try {
            const dec = await this.viemClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'decimals',
            });
            decimals = Number(dec);
          } catch {
            // Use default 18
          }
          return {
            address: tokenAddress,
            symbol,
            name: symbol,
            decimals,
          };
        }
      }

      // Fetch from contract
      const [symbol, name, decimals] = await Promise.all([
        this.viemClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol',
        }).catch(() => 'UNKNOWN'),
        this.viemClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name',
        }).catch(() => 'Unknown Token'),
        this.viemClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals',
        }).catch(() => 18),
      ]);

      return {
        address: tokenAddress,
        symbol: symbol as string,
        name: name as string,
        decimals: Number(decimals),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all ERC-20 token balances for an address
   * Uses block explorer API to discover tokens, then viem for balances
   */
  async getAllTokenBalances(
    address: string,
    options: { filterUnknown?: boolean } = {}
  ): Promise<TokenBalance[]> {
    await this.rateLimitWait();

    try {
      // Get token transfer history to discover tokens with retry logic
      const responseData = await httpWithRetry(
        async () => {
          const response = await this.client.get('', {
            params: {
              module: 'account',
              action: 'tokentx',
              address,
              page: 1,
              offset: 1000,
              sort: 'desc',
              apikey: this.apiKey,
            },
          });
          return response.data;
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
        }
      );

      if (responseData.status !== '1') {
        // No token transactions found - try common tokens
        return this.getCommonTokenBalances(address);
      }

      const txs: EtherscanTokenTx[] = responseData.result;

      // Get unique token addresses
      const tokenAddresses = new Set<string>();
      txs.forEach((tx) => {
        tokenAddresses.add(tx.contractAddress.toLowerCase());
      });

      // Filter by registered tokens if requested
      let addressesToFetch = Array.from(tokenAddresses);
      if (options.filterUnknown) {
        const { registered } = await tokenRegistry.filterRegisteredTokens(
          addressesToFetch,
          this.chain
        );
        addressesToFetch = registered;
      }

      // Fetch balance for each token using viem (parallel with limit)
      const balances: TokenBalance[] = [];
      const batchSize = 5;

      for (let i = 0; i < addressesToFetch.length; i += batchSize) {
        const batch = addressesToFetch.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((tokenAddress) => this.getTokenBalance(address, tokenAddress))
        );
        results.forEach((balance) => {
          if (balance && balance.balance.greaterThan(0)) {
            balances.push(balance);
          }
        });
      }

      return balances;
    } catch (error) {
      if (error instanceof HttpError && error.type === HttpErrorType.RATE_LIMIT) {
        console.warn(`${this.chain} explorer rate limit hit. Retry after ${error.retryAfter}s`);
      } else {
        console.warn(`Failed to get token list for ${this.chain}, falling back to common tokens:`, error);
      }
      // Fallback to common tokens only
      return this.getCommonTokenBalances(address);
    }
  }

  /**
   * Get common token balances (faster than getAllTokenBalances)
   */
  async getCommonTokenBalances(address: string): Promise<TokenBalance[]> {
    const commonTokens = COMMON_TOKENS[this.chain] || {};
    const balances: TokenBalance[] = [];

    // Fetch all common tokens in parallel
    const results = await Promise.all(
      Object.values(commonTokens).map((tokenAddress) =>
        this.getTokenBalance(address, tokenAddress)
      )
    );

    results.forEach((balance) => {
      if (balance && balance.balance.greaterThan(0)) {
        balances.push(balance);
      }
    });

    return balances;
  }

  /**
   * Get token information (deprecated - use getTokenInfoFromContract)
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    return this.getTokenInfoFromContract(tokenAddress);
  }

  /**
   * Get transaction history (still uses block explorer API)
   */
  async getTransactionHistory(
    address: string,
    limit: number = 100
  ): Promise<OnchainTransaction[]> {
    await this.rateLimitWait();

    try {
      // Get normal transactions
      const normalTxResponse = await this.client.get('', {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          page: 1,
          offset: limit,
          sort: 'desc',
          apikey: this.apiKey,
        },
      });

      // Get token transfers
      await this.rateLimitWait();
      const tokenTxResponse = await this.client.get('', {
        params: {
          module: 'account',
          action: 'tokentx',
          address,
          page: 1,
          offset: limit,
          sort: 'desc',
          apikey: this.apiKey,
        },
      });

      const normalTxs: EtherscanNormalTx[] =
        normalTxResponse.data.status === '1' ? normalTxResponse.data.result : [];
      const tokenTxs: EtherscanTokenTx[] =
        tokenTxResponse.data.status === '1' ? tokenTxResponse.data.result : [];

      // Group token transfers by transaction hash
      const tokenTransfersByHash = new Map<string, TokenTransfer[]>();
      tokenTxs.forEach((tx) => {
        const transfers = tokenTransfersByHash.get(tx.hash) || [];
        transfers.push({
          token: {
            address: tx.contractAddress,
            symbol: tx.tokenSymbol,
            name: tx.tokenName,
            decimals: parseInt(tx.tokenDecimal, 10),
          },
          from: tx.from,
          to: tx.to,
          amount: new Decimal(tx.value).dividedBy(
            new Decimal(10).pow(parseInt(tx.tokenDecimal, 10))
          ),
          amountRaw: tx.value,
        });
        tokenTransfersByHash.set(tx.hash, transfers);
      });

      // Convert to OnchainTransaction format
      const transactions: OnchainTransaction[] = normalTxs.map((tx) => {
        const tokenTransfers = tokenTransfersByHash.get(tx.hash) || [];

        return {
          chain: this.chain,
          hash: tx.hash,
          blockNumber: parseInt(tx.blockNumber, 10),
          timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
          from: tx.from,
          to: tx.to,
          value: new Decimal(tx.value).dividedBy(new Decimal(10).pow(18)),
          gasUsed: new Decimal(tx.gasUsed),
          gasPrice: new Decimal(tx.gasPrice),
          fee: new Decimal(tx.gasUsed)
            .times(new Decimal(tx.gasPrice))
            .dividedBy(new Decimal(10).pow(18)),
          status: tx.isError === '0' ? 'success' : 'failed',
          type: this.inferTransactionType(tx, tokenTransfers),
          tokenTransfers,
        };
      });

      return transactions;
    } catch (error) {
      console.error(`Failed to fetch transaction history for ${this.chain}:`, error);
      return [];
    }
  }

  /**
   * Infer transaction type from function name and transfers
   */
  private inferTransactionType(
    tx: EtherscanNormalTx,
    tokenTransfers: TokenTransfer[]
  ): OnchainTransaction['type'] {
    const funcName = tx.functionName?.toLowerCase() || '';

    if (funcName.includes('swap')) return 'swap';
    if (funcName.includes('approve')) return 'approve';
    if (funcName.includes('transfer')) return 'transfer';
    if (funcName.includes('mint')) return 'mint';
    if (funcName.includes('burn')) return 'burn';
    if (funcName.includes('stake') || funcName.includes('deposit')) return 'stake';
    if (funcName.includes('unstake') || funcName.includes('withdraw')) return 'unstake';
    if (funcName.includes('claim')) return 'claim';
    if (funcName.includes('bridge')) return 'bridge';

    if (tokenTransfers.length > 0 && !funcName) return 'transfer';
    if (tx.to && funcName) return 'contract_interaction';

    return 'unknown';
  }

  /**
   * Check if a token is registered on CoinGecko
   */
  async isTokenRegistered(tokenAddress: string): Promise<boolean> {
    return tokenRegistry.isRegisteredToken(tokenAddress, this.chain);
  }

  /**
   * Pre-load the token registry
   */
  async preloadTokenRegistry(): Promise<void> {
    await tokenRegistry.loadTokenList();
  }

  /**
   * Rate limit wait (for block explorer API calls only)
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
