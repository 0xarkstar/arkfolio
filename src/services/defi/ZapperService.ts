import axios, { AxiosInstance, AxiosError } from 'axios';
import Decimal from 'decimal.js';
import { DefiPosition } from '../../stores/defiStore';
import { httpWithRetry, HttpError, HttpErrorType } from '../utils/httpUtils';

export interface ZapperApiConfig {
  apiKey: string;
}

// GraphQL response types for portfolioV2
interface PortfolioV2Response {
  data: {
    portfolioV2: {
      appBalances: {
        totalBalanceUSD: number;
        byApp: {
          totalCount: number;
          edges: AppEdge[];
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface AppEdge {
  node: AppNode;
}

interface AppNode {
  balanceUSD: number;
  app: {
    displayName: string;
    imgUrl: string;
    slug: string;
  };
  network: {
    name: string;
    slug: string;
    chainId: number;
  };
  positionBalances: {
    edges: PositionEdge[];
  };
}

interface PositionEdge {
  node: PositionNode;
}

// AbstractDisplayItem types from Zapper schema
interface DisplayItemValue {
  valueString?: string;
  valueNumber?: number;
  valuePct?: number;
  valueDollar?: number;
}

interface StatsItem {
  label?: string;
  value?: DisplayItemValue;
}

interface PositionNode {
  type: string;
  address: string;
  network: string;
  symbol?: string;  // Only available on AppTokenPositionBalance
  decimals?: number;
  balance?: number;
  balanceUSD: number;
  price?: number;
  appId?: string;
  groupId?: string;
  groupLabel?: string;
  displayProps?: {
    label?: string;
    statsItems?: StatsItem[];
  };
}

interface CachedPositions {
  positions: DefiPosition[];
  cachedAt: number;
}

// Map Zapper networks to our chain names
const ZAPPER_NETWORK_MAP: Record<string, string> = {
  // portfolioV2 format (display names)
  'Ethereum Mainnet': 'Ethereum',
  'Ethereum': 'Ethereum',
  'Arbitrum One': 'Arbitrum',
  'Arbitrum': 'Arbitrum',
  'OP Mainnet': 'Optimism',
  'Optimism': 'Optimism',
  'Base': 'Base',
  'Base Mainnet': 'Base',
  'Polygon': 'Polygon',
  'Polygon Mainnet': 'Polygon',
  'BNB Chain': 'BSC',
  'BSC': 'BSC',
  'Avalanche C-Chain': 'Avalanche',
  'Avalanche': 'Avalanche',
  'Solana': 'Solana',
  // Legacy/slug format
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

// Map product labels to our position types
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

// GraphQL queries - using portfolioV2 (portfolio is deprecated)
// Updated to match current Zapper schema (Jan 2025)
// Simplified query without token details (TokenWithMetaType has different fields)
// Fragment for AbstractDisplayItem union type (correct Zapper schema)
const DISPLAY_ITEM_FRAGMENT = `
  fragment DisplayItemFields on AbstractDisplayItem {
    ... on DisplayItemString {
      valueString
    }
    ... on DisplayItemNumber {
      valueNumber
    }
    ... on DisplayItemPercentage {
      valuePct
    }
    ... on DisplayItemDollar {
      valueDollar
    }
  }
`;

const PORTFOLIO_QUERY = `
  ${DISPLAY_ITEM_FRAGMENT}
  query AppBalances($addresses: [Address!]!, $first: Int = 50) {
    portfolioV2(addresses: $addresses) {
      appBalances {
        totalBalanceUSD
        byApp(first: $first) {
          totalCount
          edges {
            node {
              balanceUSD
              app {
                displayName
                imgUrl
                slug
              }
              network {
                name
                slug
                chainId
              }
              positionBalances(first: 50) {
                edges {
                  node {
                    ... on AppTokenPositionBalance {
                      type
                      address
                      network
                      symbol
                      decimals
                      balance
                      balanceUSD
                      price
                      appId
                      groupId
                      groupLabel
                      displayProps {
                        label
                        statsItems {
                          label
                          value {
                            ...DisplayItemFields
                          }
                        }
                      }
                    }
                    ... on ContractPositionBalance {
                      type
                      address
                      network
                      balanceUSD
                      appId
                      groupId
                      groupLabel
                      displayProps {
                        label
                        statsItems {
                          label
                          value {
                            ...DisplayItemFields
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Test query using a zero address - will return empty data for valid keys
const TEST_QUERY = `
  query TestConnection {
    portfolioV2(addresses: ["0x0000000000000000000000000000000000000000"]) {
      appBalances {
        totalBalanceUSD
      }
    }
  }
`;

/**
 * Check if Electron's net API is available
 */
function isElectronNetAvailable(): boolean {
  const available = typeof window !== 'undefined' &&
    !!window.electronAPI?.net &&
    typeof window.electronAPI.net.request === 'function';

  console.log('Electron net API check:', { available });

  return available;
}

/**
 * ZapperService - Service for auto-detecting DeFi positions using Zapper GraphQL API
 *
 * Features:
 * - Fetches DeFi positions for wallet addresses via GraphQL
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

  private apiBaseUrl = 'https://public.zapper.xyz/graphql';

  private constructor() {}

  /**
   * Make a GraphQL request using Electron's net API (bypasses CORS) or axios as fallback
   */
  private async makeGraphQLRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Zapper API key not configured');
    }

    const body = JSON.stringify({ query, variables });

    // Use Electron's net API if available (bypasses CORS)
    if (isElectronNetAvailable() && window.electronAPI?.net) {
      console.log('Using Electron net API for Zapper request');
      const response = await window.electronAPI.net.request({
        url: this.apiBaseUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapper-api-key': this.apiKey,
        },
        body,
        timeout: 30000,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.data as T;
    }

    // Fallback to axios (may have CORS issues in browser)
    console.log('Using axios for Zapper request');
    console.log('API Key configured:', this.apiKey ? `${this.apiKey.slice(0, 4)}****` : 'NOT SET');
    if (!this.client) {
      throw new Error('Zapper API client not initialized');
    }

    return httpWithRetry(
      async () => {
        const response = await this.client!.post<T>('', { query, variables });
        return response.data;
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
      }
    ).catch((error: unknown) => {
      // Convert to structured error with classification
      if (error instanceof HttpError) {
        console.error(`Zapper API ${error.type} error:`, error.message);
        if (error.type === HttpErrorType.AUTH) {
          throw new Error('Zapper API authentication failed. Please check your API key.');
        }
        if (error.type === HttpErrorType.RATE_LIMIT) {
          throw new Error(`Zapper API rate limit exceeded. Please wait ${error.retryAfter || 60}s.`);
        }
        throw error;
      }

      // Log detailed error info for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError;
        console.error('Zapper API error details:');
        console.error('  Status:', axiosError.response?.status);
        console.error('  Data:', JSON.stringify(axiosError.response?.data, null, 2));
      }
      throw error;
    });
  }

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
        'Content-Type': 'application/json',
        'x-zapper-api-key': config.apiKey,
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
   * Get API key (for internal use by other services)
   */
  getApiKey(): string | null {
    return this.apiKey;
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
    if (wallets.length === 0) return [];

    // Zapper supports batch queries - fetch all addresses at once
    const addresses = wallets.map(w => w.address);
    const addressToWalletId = new Map(wallets.map(w => [w.address.toLowerCase(), w.id]));

    try {
      const positions = await this.fetchPositionsBatch(addresses, addressToWalletId);
      return positions;
    } catch (error) {
      console.error('Failed to fetch positions for wallets:', error);
      return [];
    }
  }

  /**
   * Fetch positions from Zapper GraphQL API
   */
  private async fetchPositions(
    walletAddress: string,
    walletId?: string
  ): Promise<DefiPosition[]> {
    const addressToWalletId = new Map([[walletAddress.toLowerCase(), walletId || walletAddress]]);
    return this.fetchPositionsBatch([walletAddress], addressToWalletId);
  }

  /**
   * Fetch positions for multiple addresses in a single GraphQL query
   */
  private async fetchPositionsBatch(
    addresses: string[],
    addressToWalletId: Map<string, string>
  ): Promise<DefiPosition[]> {
    const response = await this.makeGraphQLRequest<PortfolioV2Response>(
      PORTFOLIO_QUERY,
      {
        addresses: addresses.map(a => a.toLowerCase()),
        first: 50,
      }
    );

    // Check for GraphQL errors
    if (response?.errors?.length) {
      console.error('Zapper GraphQL errors:', response.errors);
      throw new Error(response.errors[0].message);
    }

    if (!response?.data?.portfolioV2?.appBalances?.byApp?.edges) {
      return [];
    }

    const positions: DefiPosition[] = [];
    let positionIndex = 0;

    for (const appEdge of response.data.portfolioV2.appBalances.byApp.edges) {
      const appNode = appEdge.node;
      const protocolName = appNode.app.displayName;
      const networkName = appNode.network.name;

      for (const positionEdge of appNode.positionBalances.edges) {
        const positionNode = positionEdge.node;

        // Extract assets and amounts
        const assets: string[] = [];
        const amounts: Decimal[] = [];
        const totalValue = new Decimal(positionNode.balanceUSD || 0);

        // Use symbol if available (AppTokenPositionBalance has it)
        if (positionNode.symbol) {
          assets.push(positionNode.symbol);
          amounts.push(new Decimal(positionNode.balance || 0));
        } else {
          // ContractPositionBalance doesn't have symbol, use groupLabel or protocol name
          assets.push(positionNode.groupLabel || protocolName);
          amounts.push(new Decimal(1)); // Placeholder amount
        }

        // Skip positions with zero value
        if (totalValue.lessThanOrEqualTo(0)) continue;

        // Determine position type from groupLabel
        const positionType = positionNode.groupLabel
          ? mapProductLabelToType(positionNode.groupLabel)
          : 'vault';

        // Determine wallet ID (use first address as fallback)
        const walletId = addressToWalletId.get(addresses[0].toLowerCase()) || addresses[0];

        // Extract APY and health factor from displayProps.statsItems
        let apy: number | null = null;
        let healthFactor: number | null = null;

        if (positionNode.displayProps?.statsItems) {
          for (const item of positionNode.displayProps.statsItems) {
            const label = (item.label || '').toLowerCase();
            const value = item.value;

            // Extract APY/APR (check valuePct first, then valueNumber, then valueString)
            // Note: valuePct from Zapper is already in percentage form (e.g., 3.58 = 3.58%)
            if (label === 'apy' || label === 'apr' || label.includes('yield')) {
              if (value?.valuePct !== undefined) {
                apy = value.valuePct; // Already in percentage form
              } else if (value?.valueNumber !== undefined) {
                apy = value.valueNumber;
              } else if (value?.valueString !== undefined) {
                const parsed = parseFloat(value.valueString.replace('%', ''));
                if (!isNaN(parsed)) apy = parsed;
              }
            }

            // Extract Health Factor
            if (label.includes('health') || label.includes('c-ratio') || label.includes('collateral')) {
              if (value?.valueNumber !== undefined) {
                healthFactor = value.valueNumber;
              } else if (value?.valueString !== undefined) {
                const parsed = parseFloat(value.valueString);
                if (!isNaN(parsed)) healthFactor = parsed;
              }
            }
          }
        }

        const position: DefiPosition = {
          id: `zapper-${appNode.app.slug}-${positionIndex++}`,
          walletId,
          protocol: protocolName,
          positionType,
          poolAddress: positionNode.address || null,
          assets,
          amounts,
          costBasisUsd: totalValue, // Will be calculated from transaction history
          currentValueUsd: totalValue,
          rewardsEarned: {},
          apy,
          maturityDate: null,
          healthFactor,
          chain: ZAPPER_NETWORK_MAP[networkName] || networkName,
          entryDate: null, // Will be calculated from transaction history
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
      // Test with portfolioV2 query using a zero address
      const response = await this.makeGraphQLRequest<{ data?: unknown; errors?: Array<{ message?: string; extensions?: { code?: string } }> }>(
        TEST_QUERY
      );

      console.log('Zapper API test response:', response);

      // Check for authentication errors in response
      if (response?.errors) {
        const authError = response.errors.find((e) =>
          e.message?.toLowerCase().includes('unauthorized') ||
          e.message?.toLowerCase().includes('api key') ||
          e.message?.toLowerCase().includes('authentication') ||
          e.extensions?.code === 'UNAUTHORIZED'
        );
        if (authError) {
          console.error('Zapper API auth error:', authError.message);
          return false;
        }
        // Other errors are OK as long as they're not auth errors
        console.warn('Zapper API returned non-auth errors, key may be valid:', response.errors);
      }

      // If we got data (even null) without auth errors, the key is valid
      if (response?.data !== undefined) {
        return true;
      }

      // No data and no clear auth error - assume valid
      return true;
    } catch (error: unknown) {
      console.error('Zapper API connection test failed:', error);

      // Check if error message indicates auth failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('401') ||
        errorMessage.toLowerCase().includes('403')
      ) {
        console.error('Zapper API authentication failed');
        return false;
      }

      // For other errors (network, timeout, etc.), we can't determine key validity
      console.warn('Zapper API test had issues, but key might be valid');
      return false;
    }
  }
}

export const zapperService = ZapperService.getInstance();
