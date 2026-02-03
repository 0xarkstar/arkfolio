import Decimal from 'decimal.js';
import axios from 'axios';
import { zapperService } from '../ZapperService';
import { httpWithRetry, isElectronNetAvailable } from '../../utils/httpUtils';
import { logger } from '../../../utils/logger';
import { NETWORK_TO_CHAIN_ID } from './constants';

// GraphQL query for transaction history
export const TRANSACTION_HISTORY_QUERY = `
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

// GraphQL query for transaction details
export const TRANSACTION_DETAILS_QUERY = `
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
export interface TransactionHistoryResponse {
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

export interface TransactionEdge {
  node: TimelineEventV2;
}

export interface TimelineEventV2 {
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

export interface TransactionDetailsResponse {
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

export interface TokenDisplayItem {
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

// localStorage cache constants
const TX_DETAILS_CACHE_PREFIX = 'arkfolio_tx_details_';
const TX_DETAILS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Zapper GraphQL API client
 */
export class ZapperGraphQLClient {
  private apiBaseUrl = 'https://public.zapper.xyz/graphql';

  /**
   * Make a GraphQL request to Zapper
   */
  async makeGraphQLRequest<T>(
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
   * Get cached transaction details from localStorage
   */
  getCachedTxDetails(hash: string, network: string): { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> } | null {
    const cacheKey = `${TX_DETAILS_CACHE_PREFIX}${network}_${hash}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        let parsed: { timestamp?: number; data?: { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> } };
        try {
          parsed = JSON.parse(cached);
        } catch {
          localStorage.removeItem(cacheKey);
          return null;
        }
        if (parsed.timestamp && parsed.data && Date.now() - parsed.timestamp < TX_DETAILS_CACHE_TTL) {
          return parsed.data;
        }
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
  saveTxDetailsCache(hash: string, network: string, data: { description: string; tokens: Array<{ symbol: string; amount: string; priceUsd: number }> }): void {
    const cacheKey = `${TX_DETAILS_CACHE_PREFIX}${network}_${hash}`;
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
   * Fetch transaction history from Zapper
   */
  async fetchTransactionHistory(
    walletAddress: string,
    options: {
      maxPages?: number;
      cachedTransactions: Map<string, TimelineEventV2[]>;
      cacheTimestamps: Map<string, number>;
      cacheTtlMs: number;
      skipCache?: boolean;
    }
  ): Promise<TimelineEventV2[]> {
    if (!zapperService.isConfigured()) {
      throw new Error('Zapper API not configured. Please set your API key in Settings.');
    }

    const cacheKey = walletAddress.toLowerCase();
    const cacheTimestamp = options.cacheTimestamps.get(cacheKey) || 0;
    const isExpired = Date.now() - cacheTimestamp > options.cacheTtlMs;

    if (!options.skipCache && !isExpired && options.cachedTransactions.has(cacheKey)) {
      logger.debug('Using cached transaction history');
      return options.cachedTransactions.get(cacheKey)!;
    }

    const apiKey = zapperService.getApiKey();
    if (!apiKey) {
      throw new Error('Zapper API key not found');
    }

    const allTransactions: TimelineEventV2[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = options.maxPages || 100;

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
          if ('transaction' in node) {
            allTransactions.push(node as TimelineEventV2);
          }
        }

        const pageInfo = response.data?.transactionHistoryV2?.pageInfo;
        cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
        pageCount++;

        logger.debug(`Fetched page ${pageCount}, total transactions: ${allTransactions.length}`);

        if (cursor) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } while (cursor && pageCount < maxPages);

      options.cachedTransactions.set(cacheKey, allTransactions);
      options.cacheTimestamps.set(cacheKey, Date.now());

      logger.debug(`Total transactions fetched: ${allTransactions.length}`);

      if (allTransactions.length > 0) {
        const firstTx = allTransactions[0];
        const lastTx = allTransactions[allTransactions.length - 1];
        if (firstTx?.transaction?.timestamp && lastTx?.transaction?.timestamp) {
          const newest = new Date(firstTx.transaction.timestamp * 1000);
          const oldest = new Date(lastTx.transaction.timestamp * 1000);
          logger.debug(`Date range: ${oldest.toLocaleDateString()} ~ ${newest.toLocaleDateString()}`);
        }
      }

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
   * Fetch detailed transaction information including token amounts
   */
  async fetchTransactionDetails(
    hash: string,
    network: string,
    apiKey: string
  ): Promise<{ description: string; tokens: Array<{ symbol: string; amount: Decimal; priceUsd: number }> } | null> {
    const chainId = NETWORK_TO_CHAIN_ID[network];
    if (!chainId) {
      logger.debug(`Unknown network for chain ID: ${network}`);
      return null;
    }

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
   * Clear localStorage tx details cache
   */
  clearTxDetailsCache(): number {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TX_DETAILS_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  /**
   * Get count of cached tx details in localStorage
   */
  getTxDetailsCacheCount(): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TX_DETAILS_CACHE_PREFIX)) {
        count++;
      }
    }
    return count;
  }
}

export const zapperGraphQL = new ZapperGraphQLClient();
