import { SupportedExchange } from '../types';

// CCXT exchange configuration
export interface CCXTExchangeConfig {
  id: SupportedExchange;
  ccxtId: string;
  name: string;
  type: 'cex' | 'dex' | 'perp';
  requiresPassphrase: boolean;
  supportedFeatures: {
    spot: boolean;
    futures: boolean;
    margin: boolean;
    earn: boolean;
    deposit: boolean;
    withdraw: boolean;
    websocket: boolean;
  };
  rateLimitConfig?: {
    maxRequests: number;
    windowMs: number;
  };
}

// Exchange configuration registry
export const EXCHANGE_CONFIGS: Record<string, CCXTExchangeConfig> = {
  [SupportedExchange.BINANCE]: {
    id: SupportedExchange.BINANCE,
    ccxtId: 'binance',
    name: 'Binance',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: true,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 1200, windowMs: 60000 },
  },
  [SupportedExchange.OKX]: {
    id: SupportedExchange.OKX,
    ccxtId: 'okx',
    name: 'OKX',
    type: 'cex',
    requiresPassphrase: true,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: true,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 60, windowMs: 2000 },
  },
  [SupportedExchange.UPBIT]: {
    id: SupportedExchange.UPBIT,
    ccxtId: 'upbit',
    name: 'Upbit',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 900, windowMs: 60000 },
  },
  [SupportedExchange.BITHUMB]: {
    id: SupportedExchange.BITHUMB,
    ccxtId: 'bithumb',
    name: 'Bithumb',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 150, windowMs: 1000 },
  },
  [SupportedExchange.BYBIT]: {
    id: SupportedExchange.BYBIT,
    ccxtId: 'bybit',
    name: 'Bybit',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 120, windowMs: 1000 },
  },
  [SupportedExchange.KRAKEN]: {
    id: SupportedExchange.KRAKEN,
    ccxtId: 'kraken',
    name: 'Kraken',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: true,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 15, windowMs: 1000 },
  },
  [SupportedExchange.COINBASE]: {
    id: SupportedExchange.COINBASE,
    ccxtId: 'coinbase',
    name: 'Coinbase',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 10, windowMs: 1000 },
  },
  [SupportedExchange.GATE]: {
    id: SupportedExchange.GATE,
    ccxtId: 'gate',
    name: 'Gate.io',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 300, windowMs: 1000 },
  },
  [SupportedExchange.HYPERLIQUID]: {
    id: SupportedExchange.HYPERLIQUID,
    ccxtId: 'hyperliquid',
    name: 'Hyperliquid',
    type: 'perp',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: false,
      futures: true,
      margin: false,
      earn: false,
      deposit: false,
      withdraw: false,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 1200, windowMs: 60000 },
  },
  [SupportedExchange.DYDX]: {
    id: SupportedExchange.DYDX,
    ccxtId: 'dydx',
    name: 'dYdX',
    type: 'perp',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: false,
      futures: true,
      margin: false,
      earn: false,
      deposit: false,
      withdraw: false,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 100, windowMs: 10000 },
  },
  [SupportedExchange.HTX]: {
    id: SupportedExchange.HTX,
    ccxtId: 'htx',
    name: 'HTX',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 100, windowMs: 1000 },
  },
  [SupportedExchange.BITGET]: {
    id: SupportedExchange.BITGET,
    ccxtId: 'bitget',
    name: 'Bitget',
    type: 'cex',
    requiresPassphrase: true,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 20, windowMs: 1000 },
  },
  [SupportedExchange.BINGX]: {
    id: SupportedExchange.BINGX,
    ccxtId: 'bingx',
    name: 'BingX',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 100, windowMs: 1000 },
  },
  [SupportedExchange.LBANK]: {
    id: SupportedExchange.LBANK,
    ccxtId: 'lbank',
    name: 'LBANK',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 50, windowMs: 1000 },
  },
  [SupportedExchange.WOO]: {
    id: SupportedExchange.WOO,
    ccxtId: 'woo',
    name: 'Woo X',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 10, windowMs: 1000 },
  },
  [SupportedExchange.COINONE]: {
    id: SupportedExchange.COINONE,
    ccxtId: 'coinone',
    name: 'Coinone',
    type: 'cex',
    requiresPassphrase: false,
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
    rateLimitConfig: { maxRequests: 90, windowMs: 60000 },
  },
};

// List of CCXT-supported exchanges
export const CCXT_SUPPORTED_EXCHANGES = Object.keys(EXCHANGE_CONFIGS);

/**
 * Check if an exchange is supported by CCXTAdapter
 */
export function isCCXTSupported(exchangeId: string): boolean {
  return exchangeId in EXCHANGE_CONFIGS;
}

/**
 * Get exchange configuration for a supported exchange
 */
export function getExchangeConfig(exchangeId: string): CCXTExchangeConfig | undefined {
  return EXCHANGE_CONFIGS[exchangeId];
}
