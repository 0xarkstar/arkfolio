import Decimal from 'decimal.js';
import {
  IExchangeAdapter,
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
  SubscriptionCallback,
  RateLimitConfig,
} from './types';

interface RateLimitState {
  requests: number;
  windowStart: number;
}

export abstract class BaseExchangeAdapter implements IExchangeAdapter {
  abstract readonly exchangeId: string;
  abstract readonly exchangeInfo: ExchangeInfo;

  protected credentials: ExchangeCredentials | null = null;
  protected connected: boolean = false;
  protected rateLimitState: RateLimitState = { requests: 0, windowStart: Date.now() };
  protected rateLimitConfig: RateLimitConfig = { maxRequests: 1200, windowMs: 60000 };

  // Subscriptions
  protected balanceSubscribers: Set<SubscriptionCallback<Balance>> = new Set();
  protected positionSubscribers: Set<SubscriptionCallback<Position>> = new Set();

  // Abstract methods to be implemented by each exchange
  abstract connect(credentials: ExchangeCredentials): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract getSpotBalances(): Promise<Balance[]>;
  abstract getFuturesBalances(): Promise<Balance[]>;
  abstract getFuturesPositions(): Promise<Position[]>;
  abstract getEarnPositions(): Promise<EarnPosition[]>;
  abstract getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]>;
  abstract getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]>;
  abstract getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]>;
  abstract getFundingRates(symbols?: string[]): Promise<FundingRate[]>;

  // WebSocket methods - optional, default no-op
  protected abstract connectWebSocket(): Promise<void>;
  protected abstract disconnectWebSocket(): void;

  isConnected(): boolean {
    return this.connected;
  }

  // Rate limiting
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const { maxRequests, windowMs } = this.rateLimitConfig;

    // Reset window if expired
    if (now - this.rateLimitState.windowStart >= windowMs) {
      this.rateLimitState = { requests: 0, windowStart: now };
    }

    // Check if we're at the limit
    if (this.rateLimitState.requests >= maxRequests) {
      const waitTime = windowMs - (now - this.rateLimitState.windowStart);
      if (waitTime > 0) {
        await this.sleep(waitTime);
        this.rateLimitState = { requests: 0, windowStart: Date.now() };
      }
    }

    this.rateLimitState.requests++;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Subscription management
  subscribeBalanceUpdates(callback: SubscriptionCallback<Balance>): () => void {
    this.balanceSubscribers.add(callback);
    return () => {
      this.balanceSubscribers.delete(callback);
    };
  }

  subscribePositionUpdates(callback: SubscriptionCallback<Position>): () => void {
    this.positionSubscribers.add(callback);
    return () => {
      this.positionSubscribers.delete(callback);
    };
  }

  protected notifyBalanceUpdate(balance: Balance): void {
    this.balanceSubscribers.forEach(callback => {
      try {
        callback(balance);
      } catch (error) {
        console.error('Error in balance subscriber:', error);
      }
    });
  }

  protected notifyPositionUpdate(position: Position): void {
    this.positionSubscribers.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('Error in position subscriber:', error);
      }
    });
  }

  // Utility methods
  protected toDecimal(value: string | number | undefined | null): Decimal {
    if (value === undefined || value === null || value === '') {
      return new Decimal(0);
    }
    return new Decimal(value);
  }

  protected parseTimestamp(value: string | number): Date {
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    // Handle both seconds and milliseconds
    if (timestamp < 10000000000) {
      return new Date(timestamp * 1000);
    }
    return new Date(timestamp);
  }

  // Generate signature for signed requests
  protected abstract generateSignature(
    params: Record<string, string | number>,
    timestamp: number
  ): string;

  // Build query string from params
  protected buildQueryString(params: Record<string, string | number | undefined>): string {
    const filtered = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    return filtered.join('&');
  }
}
