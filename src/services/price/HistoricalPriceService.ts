import axios from 'axios';

interface PriceCache {
  [key: string]: {
    price: number;
    timestamp: number;
  };
}

// Common token address to CoinGecko ID mapping (for native tokens and major tokens)
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  // Native tokens (use symbol)
  ETH: 'ethereum',
  WETH: 'weth',
  MATIC: 'matic-network',
  WMATIC: 'wmatic',
  BNB: 'binancecoin',
  WBNB: 'wbnb',
  AVAX: 'avalanche-2',
  WAVAX: 'wrapped-avax',
  // Stablecoins
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  FRAX: 'frax',
  // Major tokens
  WBTC: 'wrapped-bitcoin',
  stETH: 'staked-ether',
  wstETH: 'wrapped-steth',
  rETH: 'rocket-pool-eth',
  cbETH: 'coinbase-wrapped-staked-eth',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  ARB: 'arbitrum',
  OP: 'optimism',
  GMX: 'gmx',
  PENDLE: 'pendle',
};

/**
 * Service for fetching historical token prices from CoinGecko
 */
class HistoricalPriceService {
  private static instance: HistoricalPriceService;
  private cache: PriceCache = {};
  private cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours for historical prices
  private rateLimitMs = 1500; // CoinGecko free tier: ~30 calls/min
  private lastRequestTime = 0;

  private constructor() {}

  static getInstance(): HistoricalPriceService {
    if (!HistoricalPriceService.instance) {
      HistoricalPriceService.instance = new HistoricalPriceService();
    }
    return HistoricalPriceService.instance;
  }

  /**
   * Get historical price for a token at a specific date
   */
  async getHistoricalPrice(
    tokenSymbol: string,
    date: Date,
    chain: string = 'Ethereum'
  ): Promise<number | null> {
    const cacheKey = `${tokenSymbol}-${chain}-${date.toISOString().split('T')[0]}`;

    // Check cache
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.price;
    }

    try {
      await this.rateLimitWait();

      // Try to get CoinGecko ID from symbol
      const coingeckoId = this.getCoingeckoId(tokenSymbol);

      if (!coingeckoId) {
        console.warn(`No CoinGecko ID found for ${tokenSymbol}`);
        return null;
      }

      // Format date for CoinGecko API (dd-mm-yyyy)
      const dateStr = this.formatDateForCoingecko(date);

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coingeckoId}/history`,
        {
          params: {
            date: dateStr,
            localization: false,
          },
          timeout: 10000,
        }
      );

      const price = response.data?.market_data?.current_price?.usd;

      if (price !== undefined) {
        this.cache[cacheKey] = {
          price,
          timestamp: Date.now(),
        };
        return price;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch historical price for ${tokenSymbol}:`, error);
      return null;
    }
  }

  /**
   * Get historical prices for multiple tokens at a specific date
   */
  async getHistoricalPrices(
    tokens: Array<{ symbol: string; chain: string }>,
    date: Date
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const token of tokens) {
      const price = await this.getHistoricalPrice(token.symbol, date, token.chain);
      if (price !== null) {
        prices.set(token.symbol, price);
      }
    }

    return prices;
  }

  /**
   * Get price range for a token (for charts or averaging)
   */
  async getPriceRange(
    tokenSymbol: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{ timestamp: number; price: number }> | null> {
    try {
      await this.rateLimitWait();

      const coingeckoId = this.getCoingeckoId(tokenSymbol);
      if (!coingeckoId) return null;

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range`,
        {
          params: {
            vs_currency: 'usd',
            from: Math.floor(fromDate.getTime() / 1000),
            to: Math.floor(toDate.getTime() / 1000),
          },
          timeout: 10000,
        }
      );

      return response.data?.prices?.map((p: [number, number]) => ({
        timestamp: p[0],
        price: p[1],
      }));
    } catch (error) {
      console.error(`Failed to fetch price range for ${tokenSymbol}:`, error);
      return null;
    }
  }

  /**
   * Get CoinGecko ID from token symbol
   */
  private getCoingeckoId(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();
    return TOKEN_TO_COINGECKO_ID[upperSymbol] || null;
  }

  /**
   * Format date for CoinGecko API (dd-mm-yyyy)
   */
  private formatDateForCoingecko(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Rate limit wait for CoinGecko API
   */
  private async rateLimitWait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitMs - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Add a custom token mapping
   */
  addTokenMapping(symbol: string, coingeckoId: string): void {
    TOKEN_TO_COINGECKO_ID[symbol.toUpperCase()] = coingeckoId;
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.cache = {};
  }
}

export const historicalPriceService = HistoricalPriceService.getInstance();
