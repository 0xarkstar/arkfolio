import Decimal from 'decimal.js';
import axios from 'axios';
import { httpWithRetry, HttpError, HttpErrorType } from '../utils/httpUtils';
import { logger } from '../../utils/logger';

export interface PriceData {
  symbol: string;
  priceUsd: Decimal;
  priceKrw: Decimal;
  change24h: number;
  lastUpdated: Date;
}

interface CoinGeckoPrice {
  usd: number;
  krw: number;
  usd_24h_change?: number;
}

interface CachedPrice extends PriceData {
  cachedAt: number;
}

// Map common crypto symbols to CoinGecko IDs
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  FIL: 'filecoin',
  LDO: 'lido-dao',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  ALGO: 'algorand',
  FTM: 'fantom',
  HBAR: 'hedera-hashgraph',
  EGLD: 'elrond-erd-2',
  FLOW: 'flow',
  XTZ: 'tezos',
  EOS: 'eos',
  THETA: 'theta-token',
  ZEC: 'zcash',
  KCS: 'kucoin-shares',
  KLAY: 'klay-token',
  STX: 'blockstack',
  SUI: 'sui',
  SEI: 'sei-network',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  WLD: 'worldcoin-wld',
  PENDLE: 'pendle',
  RUNE: 'thorchain',
  IMX: 'immutable-x',
  BLUR: 'blur',
  GMX: 'gmx',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  FLOKI: 'floki',
  // Stablecoins
  DAI: 'dai',
  BUSD: 'binance-usd',
  TUSD: 'true-usd',
  FRAX: 'frax',
  PYUSD: 'paypal-usd',
};

// Stablecoins that are pegged to USD
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX', 'PYUSD', 'UST', 'USDP']);

class PriceService {
  private static instance: PriceService;
  private cache: Map<string, CachedPrice> = new Map();
  private cacheTtlMs = 60000; // 1 minute cache
  private apiBaseUrl = 'https://api.coingecko.com/api/v3';
  private lastRequestTime = 0;
  private minRequestInterval = 1500; // 1.5 seconds between requests (CoinGecko free tier limit)

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  /**
   * Get price for a single symbol
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = this.cache.get(upperSymbol);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached;
    }

    // Handle stablecoins
    if (STABLECOINS.has(upperSymbol)) {
      const stablePrice: PriceData = {
        symbol: upperSymbol,
        priceUsd: new Decimal(1),
        priceKrw: new Decimal(1450), // Approximate KRW rate
        change24h: 0,
        lastUpdated: new Date(),
      };
      this.cachePrice(upperSymbol, stablePrice);
      return stablePrice;
    }

    const prices = await this.getPrices([symbol]);
    return prices.get(upperSymbol) || null;
  }

  /**
   * Get prices for multiple symbols (batch)
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();
    const symbolsToFetch: string[] = [];

    // Check cache and collect symbols that need fetching
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();

      // Handle stablecoins
      if (STABLECOINS.has(upperSymbol)) {
        result.set(upperSymbol, {
          symbol: upperSymbol,
          priceUsd: new Decimal(1),
          priceKrw: new Decimal(1450),
          change24h: 0,
          lastUpdated: new Date(),
        });
        continue;
      }

      const cached = this.cache.get(upperSymbol);
      if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        result.set(upperSymbol, cached);
      } else if (SYMBOL_TO_COINGECKO_ID[upperSymbol]) {
        symbolsToFetch.push(upperSymbol);
      }
    }

    // Fetch missing prices
    if (symbolsToFetch.length > 0) {
      const fetchedPrices = await this.fetchPricesFromApi(symbolsToFetch);
      fetchedPrices.forEach((price, symbol) => {
        result.set(symbol, price);
        this.cachePrice(symbol, price);
      });
    }

    return result;
  }

  /**
   * Get all cached prices
   */
  getCachedPrices(): Map<string, PriceData> {
    const result = new Map<string, PriceData>();
    const now = Date.now();

    this.cache.forEach((price, symbol) => {
      if (now - price.cachedAt < this.cacheTtlMs) {
        result.set(symbol, price);
      }
    });

    return result;
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchPricesFromApi(symbols: string[]): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();

    // Convert symbols to CoinGecko IDs
    const coinIds = symbols
      .map(s => SYMBOL_TO_COINGECKO_ID[s])
      .filter(Boolean);

    if (coinIds.length === 0) {
      return result;
    }

    // Respect rate limiting
    await this.rateLimitWait();

    try {
      const responseData = await httpWithRetry(
        async () => {
          const response = await axios.get<Record<string, CoinGeckoPrice>>(
            `${this.apiBaseUrl}/simple/price`,
            {
              params: {
                ids: coinIds.join(','),
                vs_currencies: 'usd,krw',
                include_24hr_change: 'true',
              },
              timeout: 10000,
            }
          );
          return response.data;
        },
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 60000, // CoinGecko can have long rate limits
        }
      );

      this.lastRequestTime = Date.now();

      // Map back from CoinGecko IDs to symbols
      const idToSymbol = new Map<string, string>();
      symbols.forEach(s => {
        const id = SYMBOL_TO_COINGECKO_ID[s];
        if (id) {
          idToSymbol.set(id, s);
        }
      });

      for (const [coinId, priceData] of Object.entries(responseData)) {
        const symbol = idToSymbol.get(coinId);
        if (symbol) {
          result.set(symbol, {
            symbol,
            priceUsd: new Decimal(priceData.usd || 0),
            priceKrw: new Decimal(priceData.krw || 0),
            change24h: priceData.usd_24h_change || 0,
            lastUpdated: new Date(),
          });
        }
      }
    } catch (error) {
      if (error instanceof HttpError && error.type === HttpErrorType.RATE_LIMIT) {
        logger.warn(`CoinGecko rate limit hit. Retry after ${error.retryAfter}s`);
      } else {
        logger.error('Failed to fetch prices from CoinGecko:', error);
      }
      // Return empty result on error, cached data may still be used
    }

    return result;
  }

  /**
   * Wait for rate limit
   */
  private async rateLimitWait(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
  }

  /**
   * Cache a price
   */
  private cachePrice(symbol: string, price: PriceData): void {
    this.cache.set(symbol, {
      ...price,
      cachedAt: Date.now(),
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set cache TTL
   */
  setCacheTtl(ttlMs: number): void {
    this.cacheTtlMs = ttlMs;
  }

  /**
   * Check if a symbol is a stablecoin
   */
  isStablecoin(symbol: string): boolean {
    return STABLECOINS.has(symbol.toUpperCase());
  }

  /**
   * Get USD/KRW exchange rate
   */
  async getUsdKrwRate(): Promise<Decimal> {
    // Use cached USDT KRW price as proxy for exchange rate
    const cached = this.cache.get('USDT');
    if (cached) {
      return cached.priceKrw;
    }
    // Default approximate rate
    return new Decimal(1450);
  }
}

export const priceService = PriceService.getInstance();
