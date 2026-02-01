import Decimal from 'decimal.js';
import axios from 'axios';
import { DefiPosition } from '../../stores/defiStore';
import { zapperService } from './ZapperService';
import { httpWithRetry } from '../utils/httpUtils';
import { logger } from '../../utils/logger';

// GraphQL query for transaction history - minimal query to avoid server errors
const TRANSACTION_HISTORY_QUERY = `
  query TransactionHistory($subjects: [Address!]!, $first: Int, $after: String) {
    transactionHistoryV2(
      subjects: $subjects
      perspective: Signer
      first: $first
      after: $after
    ) {
      edges {
        node {
          ... on TimelineEventV2 {
            transaction {
              hash
              timestamp
              network
            }
            app {
              slug
              displayName
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// GraphQL query for transaction details - gets actual token amounts
const TRANSACTION_DETAILS_QUERY = `
  query TransactionDetails($hash: String!, $chainId: Int!) {
    transactionDetailsV2(hash: $hash, chainId: $chainId) {
      interpretation {
        processedDescription
        descriptionDisplayItems {
          ... on TokenDisplayItem {
            type
            tokenAddress
            amountRaw
            tokenV2 {
              symbol
              decimals
              priceData {
                price(currency: USD)
              }
            }
          }
        }
      }
    }
  }
`;

// Response types
interface TransactionHistoryResponse {
  data: {
    transactionHistoryV2: {
      edges: TransactionEdge[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface TransactionEdge {
  node: TimelineEventV2;
}

interface TimelineEventV2 {
  __typename?: 'TimelineEventV2';
  transaction: {
    hash: string;
    timestamp: number;
    network: string;
  };
  app?: {
    slug: string;
    displayName: string;
  };
}

interface TransactionDetailsResponse {
  data: {
    transactionDetailsV2: {
      interpretation: {
        processedDescription: string;
        descriptionDisplayItems: TokenDisplayItem[];
      };
    }[];
  };
  errors?: Array<{ message: string }>;
}

interface TokenDisplayItem {
  type: string;
  tokenAddress?: string;
  amountRaw?: string;
  tokenV2?: {
    symbol: string;
    decimals: number;
    priceData?: {
      price: number;
    };
  };
}

// Keywords that indicate entry transactions for DeFi positions
const ENTRY_KEYWORDS = [
  'deposit',
  'supply',
  'stake',
  'staked',
  'mint',
  'minted',
  'add liquidity',
  'added liquidity',
  'provide',
  'provided',
  'lock',
  'locked',
  'enter',
  'entered',
  'bond',
  'bonded',
  'wrap',
  'wrapped',
  'lend',
  'lending',
];

// Keywords for protocols
const PROTOCOL_KEYWORDS: Record<string, string[]> = {
  aave: ['aave'],
  compound: ['compound', 'comp'],
  uniswap: ['uniswap', 'uni'],
  curve: ['curve', 'crv'],
  convex: ['convex', 'cvx'],
  lido: ['lido', 'steth'],
  yearn: ['yearn', 'yfi', 'yvault'],
  pendle: ['pendle', 'pt-', 'yt-'],
  eigenlayer: ['eigenlayer', 'restake'],
  morpho: ['morpho'],
  makerdao: ['maker', 'dai', 'dsr'],
  gmx: ['gmx'],
  balancer: ['balancer', 'bal'],
  sushiswap: ['sushi'],
  pancakeswap: ['pancake', 'cake'],
  rocketpool: ['rocket pool', 'reth'],
  frax: ['frax'],
};

// Map Zapper network names to our chain names
const NETWORK_MAP: Record<string, string> = {
  ETHEREUM_MAINNET: 'Ethereum',
  ARBITRUM_MAINNET: 'Arbitrum',
  OPTIMISM_MAINNET: 'Optimism',
  BASE_MAINNET: 'Base',
  POLYGON_MAINNET: 'Polygon',
  BINANCE_SMART_CHAIN_MAINNET: 'BSC',
  AVALANCHE_MAINNET: 'Avalanche',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  'binance-smart-chain': 'BSC',
  avalanche: 'Avalanche',
};

// Map network names to chain IDs for transactionDetailsV2
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ETHEREUM_MAINNET: 1,
  ethereum: 1,
  ARBITRUM_MAINNET: 42161,
  arbitrum: 42161,
  OPTIMISM_MAINNET: 10,
  optimism: 10,
  BASE_MAINNET: 8453,
  base: 8453,
  POLYGON_MAINNET: 137,
  polygon: 137,
  BINANCE_SMART_CHAIN_MAINNET: 56,
  'binance-smart-chain': 56,
  AVALANCHE_MAINNET: 43114,
  avalanche: 43114,
};

interface CostBasisEntry {
  date: Date;
  tokenSymbol: string;
  amount: Decimal;
  priceAtTime: number;
  totalCostUsd: Decimal;
  txHash: string;
  description: string;
}

interface PositionCostBasis {
  positionId: string;
  entries: CostBasisEntry[];
  totalCostBasisUsd: Decimal;
  firstEntryDate: Date | null;
}

/**
 * Check if Electron's net API is available
 */
function isElectronNetAvailable(): boolean {
  return typeof window !== 'undefined' &&
    !!window.electronAPI?.net &&
    typeof window.electronAPI.net.request === 'function';
}

/**
 * Service for calculating cost basis of DeFi positions using Zapper Transaction API
 *
 * Uses Zapper's transactionHistoryV2 query to get human-readable transaction history
 * with interpreted descriptions like "Deposited 1,000 USDC to Aave"
 */
class CostBasisService {
  private static instance: CostBasisService;
  private apiBaseUrl = 'https://public.zapper.xyz/graphql';
  private cachedTransactions: Map<string, TimelineEventV2[]> = new Map();
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  // localStorage cache keys
  private readonly TX_DETAILS_CACHE_PREFIX = 'arkfolio_tx_details_';
  private readonly TX_DETAILS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (tx details don't change)

  private constructor() {}

  static getInstance(): CostBasisService {
    if (!CostBasisService.instance) {
      CostBasisService.instance = new CostBasisService();
    }
    return CostBasisService.instance;
  }

  /**
   * Make a GraphQL request to Zapper
   */
  private async makeGraphQLRequest<T>(
    query: string,
    variables: Record<string, unknown>,
    apiKey: string
  ): Promise<T> {
    const body = JSON.stringify({ query, variables });

    // Use Electron's net API if available (bypasses CORS)
    if (isElectronNetAvailable() && window.electronAPI?.net) {
      const response = await window.electronAPI.net.request({
        url: this.apiBaseUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapper-api-key': apiKey,
        },
        body,
        timeout: 60000,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data as T;
    }

    // Fallback to axios with retry logic
    return httpWithRetry(
      async () => {
        const response = await axios.post<T>(this.apiBaseUrl, { query, variables }, {
          headers: {
            'Content-Type': 'application/json',
            'x-zapper-api-key': apiKey,
          },
          timeout: 60000,
        });
        return response.data;
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
      }
    );
  }

  /**
   * Fetch transaction history from Zapper
   */
  async fetchTransactionHistory(
    walletAddress: string,
    options: { skipCache?: boolean; maxPages?: number; onFetchProgress?: (fetched: number, page: number) => void } = {}
  ): Promise<TimelineEventV2[]> {
    // Check if Zapper is configured
    if (!zapperService.isConfigured()) {
      throw new Error('Zapper API not configured. Please set your API key in Settings.');
    }

    const cacheKey = walletAddress.toLowerCase();
    const cacheTimestamp = this.cacheTimestamps.get(cacheKey) || 0;
    const isExpired = Date.now() - cacheTimestamp > this.cacheTtlMs;

    // Return cached if valid
    if (!options.skipCache && !isExpired && this.cachedTransactions.has(cacheKey)) {
      logger.debug('Using cached transaction history');
      return this.cachedTransactions.get(cacheKey)!;
    }

    const apiKey = zapperService.getApiKey();
    if (!apiKey) {
      throw new Error('Zapper API key not found');
    }

    const allTransactions: TimelineEventV2[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = options.maxPages || 100; // Default to 100 pages (2000 transactions at 20 per page)

    logger.debug(`Fetching transaction history for ${walletAddress}...`);

    try {
      do {
        const response: TransactionHistoryResponse = await this.makeGraphQLRequest<TransactionHistoryResponse>(
          TRANSACTION_HISTORY_QUERY,
          {
            subjects: [walletAddress.toLowerCase()],
            first: 20,
            after: cursor,
          },
          apiKey
        );

        if (response.errors?.length) {
          logger.error('Zapper transaction API errors:', response.errors);
          throw new Error(response.errors?.[0]?.message || 'Unknown API error');
        }

        const edges: TransactionEdge[] = response.data?.transactionHistoryV2?.edges || [];

        for (const edge of edges) {
          const node = edge.node;
          // Only process TimelineEventV2 nodes (have transaction field)
          if ('transaction' in node) {
            allTransactions.push(node as TimelineEventV2);
          }
        }

        const pageInfo: { hasNextPage: boolean; endCursor: string | null } | undefined = response.data?.transactionHistoryV2?.pageInfo;
        cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
        pageCount++;

        logger.debug(`Fetched page ${pageCount}, total transactions: ${allTransactions.length}`);

        // Add small delay to avoid rate limiting
        if (cursor) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } while (cursor && pageCount < maxPages);

      // Cache the results
      this.cachedTransactions.set(cacheKey, allTransactions);
      this.cacheTimestamps.set(cacheKey, Date.now());

      logger.debug(`Total transactions fetched: ${allTransactions.length}`);

      // Show date range of fetched transactions
      if (allTransactions.length > 0) {
        const firstTx = allTransactions[0];
        const lastTx = allTransactions[allTransactions.length - 1];
        if (firstTx?.transaction?.timestamp && lastTx?.transaction?.timestamp) {
          const newest = new Date(firstTx.transaction.timestamp * 1000);
          const oldest = new Date(lastTx.transaction.timestamp * 1000);
          logger.debug(`Date range: ${oldest.toLocaleDateString()} ~ ${newest.toLocaleDateString()}`);
        }
      }

      // Log sample of transactions for debugging
      if (logger.isDebugEnabled()) {
        logger.debug('=== Sample Transactions (first 10) ===');
        allTransactions.slice(0, 10).forEach((tx, i) => {
          const date = new Date(tx.transaction.timestamp * 1000).toLocaleDateString();
          const appName = tx.app ? `${tx.app.displayName} (${tx.app.slug})` : 'Unknown App';
          logger.debug(`${i + 1}. [${date}] [${tx.transaction.network}] ${appName}`);
        });
        logger.debug('======================================');
      }

      return allTransactions;
    } catch (error) {
      logger.error('Failed to fetch transaction history:', error);
      throw error;
    }
  }

  /**
   * Check if a transaction description indicates an entry into a position
   */
  private isEntryTransaction(description: string): boolean {
    const descLower = description.toLowerCase();
    return ENTRY_KEYWORDS.some(keyword => descLower.includes(keyword));
  }

  /**
   * Check if an app matches a protocol name
   */
  private isAppMatch(app: { slug: string; displayName: string }, protocol: string): boolean {
    const protocolLower = protocol.toLowerCase();
    const appSlugLower = app.slug.toLowerCase();
    const appNameLower = app.displayName.toLowerCase();

    // Direct match
    if (protocolLower.includes(appSlugLower) || appSlugLower.includes(protocolLower) ||
        protocolLower.includes(appNameLower) || appNameLower.includes(protocolLower)) {
      return true;
    }

    // Check protocol keywords
    for (const [key, keywords] of Object.entries(PROTOCOL_KEYWORDS)) {
      if (protocolLower.includes(key)) {
        return keywords.some(kw => appSlugLower.includes(kw) || appNameLower.includes(kw));
      }
    }

    return false;
  }

  /**
   * Parse amount from transaction description
   * Examples: "Deposited 1,000 USDC", "Staked 5.5 ETH", "Deposited 100 WSTETH"
   */
  private parseAmountFromDescription(description: string): { amount: Decimal; symbol: string } | null {
    // Pattern to match amounts like "1,000 USDC", "5.5 ETH", "100 WSTETH"
    const amountPattern = /([\d,]+\.?\d*)\s+([A-Z0-9]{2,10})/gi;
    const matches = [...description.matchAll(amountPattern)];

    if (matches.length > 0) {
      // Take the first match (usually the deposited amount)
      const match = matches[0];
      const amountStr = match[1].replace(/,/g, '');
      const symbol = match[2].toUpperCase();

      try {
        const amount = new Decimal(amountStr);
        if (amount.greaterThan(0)) {
          return { amount, symbol };
        }
      } catch {
        // Invalid number format
      }
    }

    return null;
  }

  /**
   * Get cached transaction details from localStorage
   */
  private getCachedTxDetails(hash: string, network: string): { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> } | null {
    const cacheKey = `${this.TX_DETAILS_CACHE_PREFIX}${network}_${hash}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let parsed: { timestamp?: number; data?: { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> } };
        try {
          parsed = JSON.parse(cached);
        } catch {
          // Invalid JSON, remove corrupted entry
          localStorage.removeItem(cacheKey);
          return null;
        }
        // Check TTL
        if (parsed.timestamp && parsed.data && Date.now() - parsed.timestamp < this.TX_DETAILS_CACHE_TTL) {
          return parsed.data;
        }
        // Expired, remove it
        localStorage.removeItem(cacheKey);
      }
    } catch {
      // localStorage access error
    }
    return null;
  }

  /**
   * Save transaction details to localStorage cache
   */
  private saveTxDetailsCache(hash: string, network: string, data: { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> }): void {
    const cacheKey = `${this.TX_DETAILS_CACHE_PREFIX}${network}_${hash}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data,
      }));
    } catch {
      // localStorage full or unavailable - ignore
    }
  }

  /**
   * Fetch detailed transaction information including token amounts
   */
  private async fetchTransactionDetails(
    hash: string,
    network: string,
    apiKey: string
  ): Promise<{ description: string; tokens: Array<{ symbol: string; amount: Decimal; priceUsd: number }> } | null> {
    const chainId = NETWORK_TO_CHAIN_ID[network];
    if (!chainId) {
      logger.debug(`Unknown network for chain ID: ${network}`);
      return null;
    }

    // Check localStorage cache first
    const cached = this.getCachedTxDetails(hash, network);
    if (cached) {
      logger.debug(`  -> [CACHE HIT] ${hash.slice(0, 10)}...`);
      return {
        description: cached.description,
        tokens: cached.tokens.map(t => ({
          symbol: t.symbol,
          amount: new Decimal(t.amount),
          priceUsd: t.priceUsd,
        })),
      };
    }

    try {
      const response = await this.makeGraphQLRequest<TransactionDetailsResponse>(
        TRANSACTION_DETAILS_QUERY,
        { hash, chainId },
        apiKey
      );

      if (response.errors?.length) {
        logger.debug(`Error fetching tx details: ${response.errors?.[0]?.message || 'Unknown error'}`);
        return null;
      }

      const details = response.data?.transactionDetailsV2?.[0];
      if (!details?.interpretation) {
        return null;
      }

      const description = details.interpretation.processedDescription || '';
      const tokens: Array<{ symbol: string; amount: Decimal; priceUsd: number }> = [];

      for (const item of details.interpretation.descriptionDisplayItems || []) {
        if (item.type === 'TOKEN' && item.tokenV2 && item.amountRaw) {
          const decimals = item.tokenV2.decimals || 18;
          const amount = new Decimal(item.amountRaw).dividedBy(new Decimal(10).pow(decimals));
          const priceUsd = item.tokenV2.priceData?.price || 0;

          tokens.push({
            symbol: item.tokenV2.symbol,
            amount,
            priceUsd,
          });
        }
      }

      // Save to localStorage cache (convert Decimal to string for JSON)
      this.saveTxDetailsCache(hash, network, {
        description,
        tokens: tokens.map(t => ({
          symbol: t.symbol,
          amount: t.amount.toString(),
          priceUsd: t.priceUsd,
        })),
      });

      return { description, tokens };
    } catch (error) {
      logger.debug(`Failed to fetch tx details for ${hash}: ${error}`);
      return null;
    }
  }

  /**
   * Calculate cost basis for a DeFi position
   */
  async calculateCostBasis(
    position: DefiPosition,
    walletAddress: string
  ): Promise<PositionCostBasis | null> {
    try {
      const transactions = await this.fetchTransactionHistory(walletAddress);
      const apiKey = zapperService.getApiKey();
      if (!apiKey) {
        throw new Error('Zapper API key not found');
      }

      // Find matched transactions for this position
      const matchedTxs: TimelineEventV2[] = [];

      const cacheStats = this.getCacheStats();
      logger.debug(`=== Searching transactions for ${position.protocol} (${position.chain}) ===`);
      logger.debug(`[Cache] ${cacheStats.txDetailsCount} tx details cached in localStorage`);

      for (const tx of transactions) {
        if (!tx.app) continue;

        const txChain = NETWORK_MAP[tx.transaction.network] || tx.transaction.network;

        if (!this.isAppMatch(tx.app, position.protocol)) continue;
        if (txChain !== position.chain) continue;

        matchedTxs.push(tx);
      }

      if (matchedTxs.length === 0) {
        logger.debug(`No transactions found for ${position.protocol}`);
        return null;
      }

      logger.debug(`Found ${matchedTxs.length} matching transactions, fetching details...`);

      // Fetch details for each matched transaction (limit to first 10 to avoid too many API calls)
      const entries: CostBasisEntry[] = [];
      const txsToProcess = matchedTxs.slice(0, 10);

      for (const tx of txsToProcess) {
        const timestamp = new Date(tx.transaction.timestamp * 1000);
        logger.debug(`Fetching details for ${tx.transaction.hash.slice(0, 10)}... (${timestamp.toLocaleDateString()})`);

        const details = await this.fetchTransactionDetails(
          tx.transaction.hash,
          tx.transaction.network,
          apiKey
        );

        if (details && details.description) {
          // Check if this is an entry transaction (deposit, stake, etc.)
          if (!this.isEntryTransaction(details.description)) {
            logger.debug(`  -> Not an entry tx: "${details.description.slice(0, 50)}..."`);
            continue;
          }

          logger.debug(`  -> Entry: "${details.description.slice(0, 50)}..."`);
          logger.debug(`  -> Tokens found: ${details.tokens.length}`);

          // Calculate cost from tokens
          let totalCost = new Decimal(0);
          let mainSymbol = position.assets[0] || 'UNKNOWN';
          let mainAmount = new Decimal(0);
          let mainPrice = 0;

          if (details.tokens.length === 0) {
            // No tokens in API response - try to parse from description
            const parsed = this.parseAmountFromDescription(details.description);
            if (parsed) {
              logger.debug(`  -> Parsed from description: ${parsed.amount} ${parsed.symbol}`);
              mainSymbol = parsed.symbol;
              mainAmount = parsed.amount;
              // Estimate price - for now use current position value ratio
              if (position.amounts[0] && position.amounts[0].greaterThan(0)) {
                mainPrice = position.currentValueUsd.dividedBy(position.amounts[0]).toNumber();
              }
              totalCost = mainAmount.times(mainPrice);
              logger.debug(`  -> Estimated cost: $${totalCost.toFixed(2)} (price: $${mainPrice.toFixed(2)})`);
            }
          } else {
            for (const token of details.tokens) {
              const tokenCost = token.amount.times(token.priceUsd);
              totalCost = totalCost.plus(tokenCost);

              // Use the first significant token as main
              if (mainAmount.isZero() && token.amount.greaterThan(0)) {
                mainSymbol = token.symbol;
                mainAmount = token.amount;
                mainPrice = token.priceUsd;
              }

              logger.debug(`  -> Token: ${token.amount.toFixed(4)} ${token.symbol} @ $${token.priceUsd.toFixed(2)} = $${tokenCost.toFixed(2)}`);
            }
          }

          if (totalCost.greaterThan(0)) {
            entries.push({
              date: timestamp,
              tokenSymbol: mainSymbol,
              amount: mainAmount,
              priceAtTime: mainPrice,
              totalCostUsd: totalCost,
              txHash: tx.transaction.hash,
              description: details.description,
            });
            logger.debug(`  -> Added entry: $${totalCost.toFixed(2)}`);
          } else {
            logger.debug(`  -> Skipped: could not determine cost`);
          }
        }

        // Small delay between detail requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (entries.length === 0) {
        logger.debug(`No entry transactions with cost data found for ${position.protocol}`);
        return null;
      }

      // Sort by date (oldest first)
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());

      const firstEntryDate = entries[0].date;
      const totalCostBasisUsd = entries.reduce((sum, e) => sum.plus(e.totalCostUsd), new Decimal(0));

      logger.debug(`Cost basis for ${position.protocol}:`);
      logger.debug(`  Entries: ${entries.length}`);
      logger.debug(`  First entry: ${firstEntryDate.toLocaleDateString()}`);
      logger.debug(`  Total cost: $${totalCostBasisUsd.toFixed(2)}`);

      return {
        positionId: position.id,
        entries,
        totalCostBasisUsd,
        firstEntryDate,
      };
    } catch (error) {
      logger.error(`Failed to calculate cost basis for position ${position.id}:`, error);
      return null;
    }
  }

  /**
   * Calculate cost basis for multiple positions with real-time updates
   */
  async calculateCostBasisBatch(
    positions: DefiPosition[],
    walletAddress: string,
    onProgress?: (completed: number, total: number) => void,
    onPositionCalculated?: (positionId: string, costBasis: PositionCostBasis) => void
  ): Promise<Map<string, PositionCostBasis>> {
    const results = new Map<string, PositionCostBasis>();

    // Fetch transaction history once (it will be cached)
    logger.debug(`[CostBasisService] Fetching transaction history for ${walletAddress}...`);
    await this.fetchTransactionHistory(walletAddress);

    let completed = 0;
    for (const position of positions) {
      logger.debug(`[CostBasisService] Processing position: ${position.protocol} (${position.id})`);
      const costBasis = await this.calculateCostBasis(position, walletAddress);

      if (costBasis) {
        logger.debug(`[CostBasisService] Cost basis found: $${costBasis.totalCostBasisUsd.toFixed(2)}`);
        results.set(position.id, costBasis);
        // Notify immediately when a position is calculated
        if (onPositionCalculated) {
          logger.debug(`[CostBasisService] Calling onPositionCalculated callback...`);
          onPositionCalculated(position.id, costBasis);
        }
      } else {
        logger.debug(`[CostBasisService] No cost basis found for ${position.protocol}`);
      }

      completed++;
      onProgress?.(completed, positions.length);
    }

    logger.debug(`[CostBasisService] Batch complete. ${results.size} positions with cost basis.`);
    return results;
  }

  /**
   * Fetch transaction history with progress callback
   */
  async fetchTransactionHistoryWithProgress(
    walletAddress: string,
    onProgress?: (fetched: number, page: number) => void
  ): Promise<TimelineEventV2[]> {
    return this.fetchTransactionHistory(walletAddress, {
      skipCache: true,
      onFetchProgress: onProgress,
    });
  }

  /**
   * Calculate unrealized P&L for an open position
   */
  calculateUnrealizedPnL(
    costBasis: PositionCostBasis,
    currentValueUsd: Decimal
  ): {
    unrealizedPnL: Decimal;
    unrealizedPnLPercent: number;
  } {
    const unrealizedPnL = currentValueUsd.minus(costBasis.totalCostBasisUsd);
    const unrealizedPnLPercent = costBasis.totalCostBasisUsd.greaterThan(0)
      ? unrealizedPnL.dividedBy(costBasis.totalCostBasisUsd).times(100).toNumber()
      : 0;

    return { unrealizedPnL, unrealizedPnLPercent };
  }

  /**
   * Calculate realized P&L for a closed position
   */
  calculateRealizedPnL(
    costBasis: PositionCostBasis,
    exitValueUsd: Decimal
  ): {
    realizedPnL: Decimal;
    realizedPnLPercent: number;
  } {
    const realizedPnL = exitValueUsd.minus(costBasis.totalCostBasisUsd);
    const realizedPnLPercent = costBasis.totalCostBasisUsd.greaterThan(0)
      ? realizedPnL.dividedBy(costBasis.totalCostBasisUsd).times(100).toNumber()
      : 0;

    return { realizedPnL, realizedPnLPercent };
  }

  /**
   * Clear the transaction cache (memory only)
   */
  clearCache(): void {
    this.cachedTransactions.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Clear all caches including localStorage tx details
   */
  clearAllCaches(): void {
    this.clearCache();
    // Clear localStorage tx details cache
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.TX_DETAILS_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    logger.debug(`Cleared ${keysToRemove.length} cached transaction details`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { txDetailsCount: number; memoryTxCount: number } {
    let txDetailsCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.TX_DETAILS_CACHE_PREFIX)) {
        txDetailsCount++;
      }
    }
    return {
      txDetailsCount,
      memoryTxCount: this.cachedTransactions.size,
    };
  }
}

export const costBasisService = CostBasisService.getInstance();
