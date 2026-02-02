// CCXT types - imported dynamically to avoid bundling issues
type Exchange = import('ccxt').Exchange;
type Balances = import('ccxt').Balances;
type CCXTPosition = import('ccxt').Position;
type CCXTTrade = import('ccxt').Trade;
type Transaction = import('ccxt').Transaction;

// Dynamic CCXT loader
let ccxtModule: typeof import('ccxt') | null = null;
async function getCCXT(): Promise<typeof import('ccxt')> {
  if (!ccxtModule) {
    ccxtModule = await import('ccxt');
  }
  return ccxtModule;
}

import { BaseExchangeAdapter } from './BaseAdapter';
import {
  ExchangeCredentials,
  ExchangeInfo,
  Balance,
  Position,
  EarnPosition,
  Trade,
  Transfer,
  FundingRate,
  TradeHistoryParams,
  TransferHistoryParams,
  SupportedExchange,
  BalanceType,
} from './types';
import { logger } from '../../utils/logger';
import { HttpError, HttpErrorType } from '../utils/httpUtils';

// CCXT exchange configuration
interface CCXTExchangeConfig {
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
const EXCHANGE_CONFIGS: Record<string, CCXTExchangeConfig> = {
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
  // Travel Rule 연동 거래소
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
  // 한국 VASP 거래소
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

export class CCXTAdapter extends BaseExchangeAdapter {
  readonly exchangeId: string;
  readonly exchangeInfo: ExchangeInfo;

  private exchange: Exchange | null = null;
  private config: CCXTExchangeConfig;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(exchangeId: SupportedExchange) {
    super();

    const config = EXCHANGE_CONFIGS[exchangeId];
    if (!config) {
      throw new Error(`Exchange ${exchangeId} is not supported by CCXTAdapter`);
    }

    this.config = config;
    this.exchangeId = exchangeId;
    this.exchangeInfo = {
      id: config.id,
      name: config.name,
      type: config.type,
      supportedFeatures: config.supportedFeatures,
    };

    // Apply rate limit config
    if (config.rateLimitConfig) {
      this.rateLimitConfig = config.rateLimitConfig;
    }

    // Exchange will be created lazily in connect() to avoid bundling CCXT at startup
  }

  private getExchange(): Exchange {
    if (!this.exchange) {
      throw new Error('Exchange not connected. Call connect() first.');
    }
    return this.exchange;
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
    this.credentials = credentials;

    // Dynamically import CCXT only when connecting
    const ccxt = await getCCXT();

    // Create CCXT exchange instance
    const ExchangeClass = ccxt[this.config.ccxtId as keyof typeof ccxt] as new (config: Record<string, unknown>) => Exchange;
    if (!ExchangeClass) {
      throw new Error(`CCXT does not support exchange: ${this.config.ccxtId}`);
    }

    this.exchange = new ExchangeClass({
      enableRateLimit: true,
    });

    // Configure exchange credentials
    this.exchange.apiKey = credentials.apiKey;
    this.exchange.secret = credentials.apiSecret;

    if (credentials.passphrase && this.config.requiresPassphrase) {
      this.exchange.password = credentials.passphrase;
    }

    // For DEX/Perp exchanges that use wallet address
    if (this.config.type === 'dex' || this.config.type === 'perp') {
      // Hyperliquid and dYdX use wallet address as the identifier
      // The apiKey contains the wallet address for these exchanges
      if (this.config.ccxtId === 'hyperliquid') {
        this.exchange.walletAddress = credentials.apiKey;
      }
    }

    // Test the connection
    const isValid = await this.testConnection();
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    this.connected = true;
    logger.debug(`[CCXTAdapter] Connected to ${this.config.name}`);

    // Connect WebSocket for real-time updates (if supported)
    if (this.config.supportedFeatures.websocket) {
      await this.connectWebSocket();
    }
  }

  async disconnect(): Promise<void> {
    this.disconnectWebSocket();
    this.credentials = null;
    this.connected = false;
    logger.debug(`[CCXTAdapter] Disconnected from ${this.config.name}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.checkRateLimit();

      // For DEX exchanges, just try to fetch balance
      if (this.config.type === 'dex' || this.config.type === 'perp') {
        await this.getExchange().fetchBalance();
        return true;
      }

      // For CEX, use the standard check account endpoint
      if (this.getExchange().has['fetchBalance']) {
        await this.getExchange().fetchBalance();
        return true;
      }

      return false;
    } catch (error) {
      const httpError = HttpError.fromError(error, HttpErrorType.AUTH);
      logger.error(`[CCXTAdapter] ${this.config.name} connection test failed:`, httpError.getUserFriendlyMessage());
      return false;
    }
  }

  protected generateSignature(
    _params: Record<string, string | number>,
    _timestamp: number
  ): string {
    // CCXT handles signature generation internally
    return '';
  }

  async getSpotBalances(): Promise<Balance[]> {
    if (!this.config.supportedFeatures.spot) {
      return [];
    }

    try {
      await this.checkRateLimit();
      const balance = await this.getExchange().fetchBalance({ type: 'spot' });
      return this.mapBalances(balance, 'spot');
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch spot balances:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getFuturesBalances(): Promise<Balance[]> {
    if (!this.config.supportedFeatures.futures) {
      return [];
    }

    try {
      await this.checkRateLimit();

      // Different exchanges use different account types for futures
      let balance: Balances;
      if (this.getExchange().has['fetchBalance']) {
        // Try to fetch futures/swap balance
        try {
          balance = await this.getExchange().fetchBalance({ type: 'swap' });
        } catch {
          // Fallback to futures type
          try {
            balance = await this.getExchange().fetchBalance({ type: 'future' });
          } catch {
            // Some exchanges use linear/inverse
            balance = await this.getExchange().fetchBalance({ type: 'linear' });
          }
        }
      } else {
        return [];
      }

      return this.mapBalances(balance, 'futures');
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn(`[CCXTAdapter] Failed to fetch futures balances:`, httpError.getUserFriendlyMessage());
      return [];
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    if (!this.config.supportedFeatures.futures) {
      return [];
    }

    try {
      await this.checkRateLimit();

      if (!this.getExchange().has['fetchPositions']) {
        return [];
      }

      const positions = await this.getExchange().fetchPositions();
      return this.mapPositions(positions);
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch positions:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    // CCXT doesn't have a unified earn/staking API
    // This would need exchange-specific implementation
    if (!this.config.supportedFeatures.earn) {
      return [];
    }

    // For now, return empty array - would need custom implementation per exchange
    logger.debug(`[CCXTAdapter] Earn positions not yet implemented for ${this.config.name}`);
    return [];
  }

  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    try {
      await this.checkRateLimit();

      if (!this.getExchange().has['fetchMyTrades']) {
        return [];
      }

      const trades = await this.getExchange().fetchMyTrades(
        params?.symbol,
        params?.since,
        params?.limit || 500
      );

      return this.mapTrades(trades);
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch trade history:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.config.supportedFeatures.deposit) {
      return [];
    }

    try {
      await this.checkRateLimit();

      if (!this.getExchange().has['fetchDeposits']) {
        return [];
      }

      const deposits = await this.getExchange().fetchDeposits(
        params?.asset,
        params?.since,
        params?.limit || 100
      );

      return this.mapTransfers(deposits, 'deposit');
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch deposits:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.config.supportedFeatures.withdraw) {
      return [];
    }

    try {
      await this.checkRateLimit();

      if (!this.getExchange().has['fetchWithdrawals']) {
        return [];
      }

      const withdrawals = await this.getExchange().fetchWithdrawals(
        params?.asset,
        params?.since,
        params?.limit || 100
      );

      return this.mapTransfers(withdrawals, 'withdraw');
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch withdrawals:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    if (!this.config.supportedFeatures.futures) {
      return [];
    }

    try {
      await this.checkRateLimit();

      if (!this.getExchange().has['fetchFundingRates'] && !this.getExchange().has['fetchFundingRate']) {
        return [];
      }

      const rates: FundingRate[] = [];

      if (this.getExchange().has['fetchFundingRates']) {
        const fundingRates = await this.getExchange().fetchFundingRates(symbols);
        for (const [symbol, rate] of Object.entries(fundingRates)) {
          if (rate) {
            rates.push({
              symbol,
              rate: this.toDecimal(rate.fundingRate),
              timestamp: rate.timestamp ? new Date(rate.timestamp) : new Date(),
              nextFundingTime: rate.fundingTimestamp ? new Date(rate.fundingTimestamp) : undefined,
            });
          }
        }
      } else if (symbols && symbols.length > 0 && this.getExchange().has['fetchFundingRate']) {
        for (const symbol of symbols) {
          try {
            const rate = await this.getExchange().fetchFundingRate(symbol);
            if (rate) {
              rates.push({
                symbol,
                rate: this.toDecimal(rate.fundingRate),
                timestamp: rate.timestamp ? new Date(rate.timestamp) : new Date(),
                nextFundingTime: rate.fundingTimestamp ? new Date(rate.fundingTimestamp) : undefined,
              });
            }
          } catch {
            // Skip individual failures
          }
        }
      }

      return rates;
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn(`[CCXTAdapter] Failed to fetch funding rates:`, httpError.getUserFriendlyMessage());
      return [];
    }
  }

  // WebSocket methods
  protected async connectWebSocket(): Promise<void> {
    // CCXT Pro WebSocket support would go here
    // For now, we use polling-based updates in the base implementation
    // Full WebSocket support requires CCXT Pro subscription
    logger.debug(`[CCXTAdapter] WebSocket connection not implemented (requires CCXT Pro)`);
  }

  protected disconnectWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
  }

  // Type mapping helpers
  private mapBalances(ccxtBalance: Balances, type: BalanceType): Balance[] {
    const result: Balance[] = [];

    // Get the 'total' object which contains all assets
    // CCXT Balances has special structure with total/free/used objects
    const total = ccxtBalance.total || {};
    const free = ccxtBalance.free || {};
    const used = ccxtBalance.used || {};

    // Cast to generic records for indexing
    const freeRecord = free as unknown as Record<string, number | undefined>;
    const usedRecord = used as unknown as Record<string, number | undefined>;

    for (const [asset, totalAmount] of Object.entries(total)) {
      // Skip info/timestamp fields and zero balances
      if (asset === 'info' || asset === 'timestamp' || asset === 'datetime') continue;

      const totalValue = typeof totalAmount === 'number' ? totalAmount : parseFloat(String(totalAmount) || '0');
      if (totalValue <= 0) continue;

      const freeValue = freeRecord[asset];
      const usedValue = usedRecord[asset];

      const freeAmount = typeof freeValue === 'number' ? freeValue : parseFloat(String(freeValue) || '0');
      const usedAmount = typeof usedValue === 'number' ? usedValue : parseFloat(String(usedValue) || '0');

      result.push({
        asset,
        free: this.toDecimal(freeAmount),
        locked: this.toDecimal(usedAmount),
        total: this.toDecimal(totalValue),
        balanceType: type,
      });
    }

    return result;
  }

  private mapPositions(ccxtPositions: CCXTPosition[]): Position[] {
    return ccxtPositions
      .filter(p => {
        const contracts = p.contracts ?? 0;
        return contracts !== 0 && contracts !== undefined;
      })
      .map(p => {
        const contracts = this.toDecimal(p.contracts ?? 0);
        const isLong = p.side === 'long' || contracts.greaterThan(0);

        return {
          id: p.id || `${p.symbol}-${p.side || 'both'}`,
          symbol: p.symbol || '',
          side: isLong ? 'long' : 'short',
          size: contracts.abs(),
          entryPrice: this.toDecimal(p.entryPrice ?? 0),
          markPrice: this.toDecimal(p.markPrice ?? 0),
          unrealizedPnl: this.toDecimal(p.unrealizedPnl ?? 0),
          leverage: p.leverage ?? 1,
          liquidationPrice: p.liquidationPrice ? this.toDecimal(p.liquidationPrice) : undefined,
          marginType: (p.marginMode === 'isolated' ? 'isolated' : 'cross') as Position['marginType'],
          margin: this.toDecimal(p.collateral ?? p.initialMargin ?? 0),
          notional: this.toDecimal(p.notional ?? 0).abs(),
        } as Position;
      });
  }

  private mapTrades(ccxtTrades: CCXTTrade[]): Trade[] {
    return ccxtTrades.map(t => ({
      id: t.id || String(t.timestamp),
      symbol: t.symbol || '',
      side: t.side as 'buy' | 'sell',
      price: this.toDecimal(t.price ?? 0),
      amount: this.toDecimal(t.amount ?? 0),
      cost: this.toDecimal(t.cost ?? 0),
      fee: this.toDecimal(t.fee?.cost ?? 0),
      feeAsset: t.fee?.currency || '',
      timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
      orderId: t.order,
    }));
  }

  private mapTransfers(ccxtTransfers: Transaction[], type: 'deposit' | 'withdraw'): Transfer[] {
    return ccxtTransfers.map(t => ({
      id: t.id || String(t.timestamp),
      asset: t.currency || '',
      amount: this.toDecimal(t.amount ?? 0),
      type,
      txHash: t.txid,
      address: t.address,
      network: t.network,
      status: this.mapTransferStatus(t.status),
      fee: t.fee ? this.toDecimal(t.fee.cost ?? 0) : undefined,
      timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
    }));
  }

  private mapTransferStatus(status?: string): Transfer['status'] {
    if (!status) return 'pending';

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'ok' || normalizedStatus === 'success' || normalizedStatus === 'completed') {
      return 'completed';
    }
    if (normalizedStatus === 'failed' || normalizedStatus === 'rejected') {
      return 'failed';
    }
    if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
      return 'cancelled';
    }
    return 'pending';
  }
}

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
