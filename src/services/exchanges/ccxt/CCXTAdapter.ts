// CCXT types - imported dynamically to avoid bundling issues
type Exchange = import('ccxt').Exchange;
type Balances = import('ccxt').Balances;

// Dynamic CCXT loader
let ccxtModule: typeof import('ccxt') | null = null;
async function getCCXT(): Promise<typeof import('ccxt')> {
  if (!ccxtModule) {
    ccxtModule = await import('ccxt');
  }
  return ccxtModule;
}

import { BaseExchangeAdapter } from '../BaseAdapter';
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
} from '../types';
import { logger } from '../../../utils/logger';
import { HttpError, HttpErrorType } from '../../utils/httpUtils';
import { EXCHANGE_CONFIGS, CCXTExchangeConfig } from './CCXTConfig';
import { toDecimal, mapBalances, mapPositions, mapTrades, mapTransfers } from './CCXTMappers';
import { getBinanceEarnPositions, getOkxEarnPositions, getKrakenEarnPositions } from './CCXTEarnProviders';

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

    if (config.rateLimitConfig) {
      this.rateLimitConfig = config.rateLimitConfig;
    }
  }

  private getExchange(): Exchange {
    if (!this.exchange) {
      throw new Error('Exchange not connected. Call connect() first.');
    }
    return this.exchange;
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
    this.credentials = credentials;

    const ccxt = await getCCXT();
    const ExchangeClass = ccxt[this.config.ccxtId as keyof typeof ccxt] as new (config: Record<string, unknown>) => Exchange;
    if (!ExchangeClass) {
      throw new Error(`CCXT does not support exchange: ${this.config.ccxtId}`);
    }

    this.exchange = new ExchangeClass({ enableRateLimit: true });
    this.exchange.apiKey = credentials.apiKey;
    this.exchange.secret = credentials.apiSecret;

    if (credentials.passphrase && this.config.requiresPassphrase) {
      this.exchange.password = credentials.passphrase;
    }

    if (this.config.type === 'dex' || this.config.type === 'perp') {
      if (this.config.ccxtId === 'hyperliquid') {
        this.exchange.walletAddress = credentials.apiKey;
      }
    }

    const isValid = await this.testConnection();
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    this.connected = true;
    logger.debug(`[CCXTAdapter] Connected to ${this.config.name}`);

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

      if (this.config.type === 'dex' || this.config.type === 'perp') {
        await this.getExchange().fetchBalance();
        return true;
      }

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
    return '';
  }

  // Re-export toDecimal for BaseAdapter compatibility
  protected toDecimal = toDecimal;

  async getSpotBalances(): Promise<Balance[]> {
    if (!this.config.supportedFeatures.spot) {
      return [];
    }

    try {
      await this.checkRateLimit();
      const balance = await this.getExchange().fetchBalance({ type: 'spot' });
      return mapBalances(balance, 'spot');
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

      let balance: Balances;
      if (this.getExchange().has['fetchBalance']) {
        try {
          balance = await this.getExchange().fetchBalance({ type: 'swap' });
        } catch {
          try {
            balance = await this.getExchange().fetchBalance({ type: 'future' });
          } catch {
            balance = await this.getExchange().fetchBalance({ type: 'linear' });
          }
        }
      } else {
        return [];
      }

      return mapBalances(balance, 'futures');
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
      return mapPositions(positions);
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error(`[CCXTAdapter] Failed to fetch positions:`, httpError.getUserFriendlyMessage());
      throw httpError;
    }
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    if (!this.config.supportedFeatures.earn) {
      return [];
    }

    try {
      await this.checkRateLimit();

      switch (this.config.id) {
        case SupportedExchange.BINANCE:
          return getBinanceEarnPositions(this.getExchange());
        case SupportedExchange.OKX:
          return getOkxEarnPositions(this.getExchange());
        case SupportedExchange.KRAKEN:
          return getKrakenEarnPositions(this.getExchange());
        default:
          logger.debug(`[CCXTAdapter] Earn positions not implemented for ${this.config.name}`);
          return [];
      }
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn(`[CCXTAdapter] Failed to fetch earn positions:`, httpError.getUserFriendlyMessage());
      return [];
    }
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

      return mapTrades(trades);
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

      return mapTransfers(deposits, 'deposit');
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

      return mapTransfers(withdrawals, 'withdraw');
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
              rate: toDecimal(rate.fundingRate),
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
                rate: toDecimal(rate.fundingRate),
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

  protected async connectWebSocket(): Promise<void> {
    logger.debug(`[CCXTAdapter] WebSocket connection not implemented (requires CCXT Pro)`);
  }

  protected disconnectWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
  }
}
