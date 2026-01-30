import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
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
 * Uses block explorer APIs (Etherscan-like) for token balances and transactions
 */
export class EVMProvider {
  private chain: Chain;
  private config: ChainConfig;
  private client: AxiosInstance;
  private apiKey?: string;
  private lastRequestTime = 0;
  private minRequestInterval = 250; // 4 requests per second for free tier

  constructor(chain: Chain, apiKey?: string) {
    this.chain = chain;
    this.config = CHAIN_CONFIGS[chain];
    this.apiKey = apiKey;

    if (!this.config.isEVM) {
      throw new Error(`Chain ${chain} is not an EVM chain`);
    }

    this.client = axios.create({
      baseURL: this.config.blockExplorer.apiUrl,
      timeout: 30000,
    });
  }

  /**
   * Get native token balance (ETH, MATIC, etc.)
   */
  async getNativeBalance(address: string): Promise<NativeBalance> {
    await this.rateLimitWait();

    const response = await this.client.get('', {
      params: {
        module: 'account',
        action: 'balance',
        address,
        tag: 'latest',
        apikey: this.apiKey,
      },
    });

    if (response.data.status !== '1' && response.data.message !== 'OK') {
      // Handle "No transactions found" as valid empty response
      if (response.data.message === 'No transactions found') {
        return {
          chain: this.chain,
          walletAddress: address,
          symbol: this.config.nativeCurrency.symbol,
          balance: new Decimal(0),
          balanceRaw: '0',
        };
      }
      throw new Error(`Failed to fetch native balance: ${response.data.message}`);
    }

    const balanceWei = response.data.result;
    const balance = new Decimal(balanceWei).dividedBy(
      new Decimal(10).pow(this.config.nativeCurrency.decimals)
    );

    return {
      chain: this.chain,
      walletAddress: address,
      symbol: this.config.nativeCurrency.symbol,
      balance,
      balanceRaw: balanceWei,
    };
  }

  /**
   * Get ERC-20 token balance for a specific token
   */
  async getTokenBalance(address: string, tokenAddress: string): Promise<TokenBalance | null> {
    await this.rateLimitWait();

    // First get token info
    const tokenInfo = await this.getTokenInfo(tokenAddress);
    if (!tokenInfo) return null;

    const response = await this.client.get('', {
      params: {
        module: 'account',
        action: 'tokenbalance',
        contractaddress: tokenAddress,
        address,
        tag: 'latest',
        apikey: this.apiKey,
      },
    });

    if (response.data.status !== '1') {
      return null;
    }

    const balanceRaw = response.data.result;
    const balance = new Decimal(balanceRaw).dividedBy(
      new Decimal(10).pow(tokenInfo.decimals)
    );

    if (balance.equals(0)) return null;

    return {
      chain: this.chain,
      walletAddress: address,
      token: tokenInfo,
      balance,
      balanceRaw,
    };
  }

  /**
   * Get all ERC-20 token balances for an address
   * Uses token transfer history to discover tokens
   */
  async getAllTokenBalances(address: string): Promise<TokenBalance[]> {
    await this.rateLimitWait();

    // Get token transfer history to discover tokens
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

    if (response.data.status !== '1') {
      // No token transactions found
      return [];
    }

    const txs: EtherscanTokenTx[] = response.data.result;

    // Get unique token addresses
    const tokenAddresses = new Set<string>();
    txs.forEach((tx) => {
      tokenAddresses.add(tx.contractAddress.toLowerCase());
    });

    // Fetch balance for each token
    const balances: TokenBalance[] = [];

    for (const tokenAddress of tokenAddresses) {
      try {
        const balance = await this.getTokenBalance(address, tokenAddress);
        if (balance && balance.balance.greaterThan(0)) {
          balances.push(balance);
        }
      } catch (error) {
        console.warn(`Failed to fetch balance for token ${tokenAddress}:`, error);
      }
    }

    return balances;
  }

  /**
   * Get common token balances (faster than getAllTokenBalances)
   */
  async getCommonTokenBalances(address: string): Promise<TokenBalance[]> {
    const commonTokens = COMMON_TOKENS[this.chain] || {};
    const balances: TokenBalance[] = [];

    for (const [, tokenAddress] of Object.entries(commonTokens)) {
      try {
        const balance = await this.getTokenBalance(address, tokenAddress);
        if (balance && balance.balance.greaterThan(0)) {
          balances.push(balance);
        }
      } catch {
        // Skip tokens that fail
      }
    }

    return balances;
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    // Try to get from common tokens first
    for (const [symbol, addr] of Object.entries(COMMON_TOKENS[this.chain] || {})) {
      if (addr.toLowerCase() === tokenAddress.toLowerCase()) {
        return {
          address: tokenAddress,
          symbol,
          name: symbol,
          decimals: 18, // Most tokens use 18 decimals
        };
      }
    }

    // Fetch from contract (simplified - would need actual RPC call for full implementation)
    // For now, return basic info from token transfer data
    return {
      address: tokenAddress,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    address: string,
    limit: number = 100
  ): Promise<OnchainTransaction[]> {
    await this.rateLimitWait();

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

    // If there are token transfers and no function name, it's likely a transfer
    if (tokenTransfers.length > 0 && !funcName) return 'transfer';

    // If it's a contract interaction
    if (tx.to && funcName) return 'contract_interaction';

    return 'unknown';
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
