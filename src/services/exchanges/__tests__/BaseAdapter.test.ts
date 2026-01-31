import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { BaseExchangeAdapter } from '../BaseAdapter';
import type {
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
} from '../types';

// Create a concrete test implementation of the abstract class
class TestExchangeAdapter extends BaseExchangeAdapter {
  readonly exchangeId = 'test-exchange';
  readonly exchangeInfo: ExchangeInfo = {
    id: 'test-exchange',
    name: 'Test Exchange',
    type: 'cex',
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: false,
    },
  };

  async connect(credentials: ExchangeCredentials): Promise<void> {
    this.credentials = credentials;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    return this.connected;
  }

  async getSpotBalances(): Promise<Balance[]> {
    await this.checkRateLimit();
    return [
      {
        asset: 'BTC',
        free: new Decimal(1.5),
        locked: new Decimal(0.5),
        total: new Decimal(2),
        balanceType: 'spot',
        valueUsd: new Decimal(80000),
      },
    ];
  }

  async getFuturesBalances(): Promise<Balance[]> {
    return [];
  }

  async getFuturesPositions(): Promise<Position[]> {
    return [];
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    return [];
  }

  async getTradeHistory(_params?: TradeHistoryParams): Promise<Trade[]> {
    return [];
  }

  async getDepositHistory(_params?: TransferHistoryParams): Promise<Transfer[]> {
    return [];
  }

  async getWithdrawHistory(_params?: TransferHistoryParams): Promise<Transfer[]> {
    return [];
  }

  async getFundingRates(_symbols?: string[]): Promise<FundingRate[]> {
    return [];
  }

  protected async connectWebSocket(): Promise<void> {
    // No-op for tests
  }

  protected disconnectWebSocket(): void {
    // No-op for tests
  }

  protected generateSignature(
    _params: Record<string, string | number>,
    _timestamp: number
  ): string {
    return 'test-signature';
  }

  // Expose protected methods for testing
  public testToDecimal(value: string | number | undefined | null): Decimal {
    return this.toDecimal(value);
  }

  public testParseTimestamp(value: string | number): Date {
    return this.parseTimestamp(value);
  }

  public testBuildQueryString(params: Record<string, string | number | undefined>): string {
    return this.buildQueryString(params);
  }

  public async testCheckRateLimit(): Promise<void> {
    return this.checkRateLimit();
  }

  public testNotifyBalanceUpdate(balance: Balance): void {
    this.notifyBalanceUpdate(balance);
  }

  public testNotifyPositionUpdate(position: Position): void {
    this.notifyPositionUpdate(position);
  }
}

describe('BaseExchangeAdapter', () => {
  let adapter: TestExchangeAdapter;

  beforeEach(() => {
    adapter = new TestExchangeAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connection', () => {
    it('should start disconnected', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it('should connect with credentials', async () => {
      await adapter.connect({ apiKey: 'test-key', apiSecret: 'test-secret' });
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect properly', async () => {
      await adapter.connect({ apiKey: 'test-key', apiSecret: 'test-secret' });
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should test connection when connected', async () => {
      await adapter.connect({ apiKey: 'test-key', apiSecret: 'test-secret' });
      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should test connection when disconnected', async () => {
      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('toDecimal', () => {
    it('should convert string to Decimal', () => {
      const result = adapter.testToDecimal('123.456');
      expect(result.equals(new Decimal('123.456'))).toBe(true);
    });

    it('should convert number to Decimal', () => {
      const result = adapter.testToDecimal(123.456);
      expect(result.equals(new Decimal(123.456))).toBe(true);
    });

    it('should return 0 for undefined', () => {
      const result = adapter.testToDecimal(undefined);
      expect(result.equals(new Decimal(0))).toBe(true);
    });

    it('should return 0 for null', () => {
      const result = adapter.testToDecimal(null);
      expect(result.equals(new Decimal(0))).toBe(true);
    });

    it('should return 0 for empty string', () => {
      const result = adapter.testToDecimal('');
      expect(result.equals(new Decimal(0))).toBe(true);
    });

    it('should handle very large numbers', () => {
      const result = adapter.testToDecimal('999999999999999999.123456789');
      expect(result.toString()).toBe('999999999999999999.123456789');
    });

    it('should handle very small numbers', () => {
      const result = adapter.testToDecimal('0.000000001');
      expect(result.equals(new Decimal('0.000000001'))).toBe(true);
    });
  });

  describe('parseTimestamp', () => {
    it('should parse milliseconds timestamp', () => {
      const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
      const result = adapter.testParseTimestamp(timestamp);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should parse seconds timestamp', () => {
      const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
      const result = adapter.testParseTimestamp(timestamp);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should parse string timestamp (milliseconds)', () => {
      const timestamp = '1704067200000';
      const result = adapter.testParseTimestamp(timestamp);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should parse string timestamp (seconds)', () => {
      const timestamp = '1704067200';
      const result = adapter.testParseTimestamp(timestamp);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const result = adapter.testBuildQueryString({
        symbol: 'BTCUSDT',
        limit: 100,
      });
      expect(result).toBe('symbol=BTCUSDT&limit=100');
    });

    it('should filter out undefined values', () => {
      const result = adapter.testBuildQueryString({
        symbol: 'BTCUSDT',
        limit: undefined,
        offset: 10,
      });
      expect(result).toBe('symbol=BTCUSDT&offset=10');
    });

    it('should encode special characters', () => {
      const result = adapter.testBuildQueryString({
        query: 'test value',
      });
      expect(result).toBe('query=test%20value');
    });

    it('should handle empty params', () => {
      const result = adapter.testBuildQueryString({});
      expect(result).toBe('');
    });
  });

  describe('subscription management', () => {
    it('should subscribe to balance updates', () => {
      const callback = vi.fn();
      const unsubscribe = adapter.subscribeBalanceUpdates(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should notify balance subscribers', () => {
      const callback = vi.fn();
      adapter.subscribeBalanceUpdates(callback);

      const balance: Balance = {
        asset: 'BTC',
        free: new Decimal(1),
        locked: new Decimal(0),
        total: new Decimal(1),
        balanceType: 'spot',
        valueUsd: new Decimal(40000),
      };

      adapter.testNotifyBalanceUpdate(balance);

      expect(callback).toHaveBeenCalledWith(balance);
    });

    it('should unsubscribe from balance updates', () => {
      const callback = vi.fn();
      const unsubscribe = adapter.subscribeBalanceUpdates(callback);
      unsubscribe();

      const balance: Balance = {
        asset: 'BTC',
        free: new Decimal(1),
        locked: new Decimal(0),
        total: new Decimal(1),
        balanceType: 'spot',
        valueUsd: new Decimal(40000),
      };

      adapter.testNotifyBalanceUpdate(balance);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should subscribe to position updates', () => {
      const callback = vi.fn();
      const unsubscribe = adapter.subscribePositionUpdates(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle errors in subscribers gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();

      adapter.subscribeBalanceUpdates(errorCallback);
      adapter.subscribeBalanceUpdates(normalCallback);

      const balance: Balance = {
        asset: 'BTC',
        free: new Decimal(1),
        locked: new Decimal(0),
        total: new Decimal(1),
        balanceType: 'spot',
        valueUsd: new Decimal(40000),
      };

      // Should not throw
      expect(() => adapter.testNotifyBalanceUpdate(balance)).not.toThrow();
      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('exchange info', () => {
    it('should have correct exchange id', () => {
      expect(adapter.exchangeId).toBe('test-exchange');
    });

    it('should have valid exchange info', () => {
      expect(adapter.exchangeInfo.id).toBe('test-exchange');
      expect(adapter.exchangeInfo.name).toBe('Test Exchange');
      expect(adapter.exchangeInfo.type).toBe('cex');
      expect(adapter.exchangeInfo.supportedFeatures.spot).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.futures).toBe(true);
    });
  });

  describe('getSpotBalances', () => {
    it('should return balances', async () => {
      const balances = await adapter.getSpotBalances();

      expect(balances.length).toBe(1);
      expect(balances[0].asset).toBe('BTC');
      expect(balances[0].total.equals(new Decimal(2))).toBe(true);
    });
  });
});
