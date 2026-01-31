import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { BinanceAdapter } from '../binance/BinanceAdapter';
import { SupportedExchange } from '../types';

// Mock axios with AxiosError
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        request: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
      })),
    },
  };
});

// Mock crypto-js
vi.mock('crypto-js', () => ({
  default: {
    HmacSHA256: vi.fn(() => ({
      toString: () => 'mockedsignature123',
    })),
  },
}));

describe('BinanceAdapter', () => {
  let adapter: BinanceAdapter;
  let mockSpotClient: any;
  let mockFuturesClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock clients
    mockSpotClient = {
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };

    mockFuturesClient = {
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
    };

    // Mock axios.create to return our mock clients
    let callCount = 0;
    (axios.create as any).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockSpotClient : mockFuturesClient;
    });

    adapter = new BinanceAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exchangeInfo', () => {
    it('should have correct exchange info', () => {
      expect(adapter.exchangeId).toBe(SupportedExchange.BINANCE);
      expect(adapter.exchangeInfo.name).toBe('Binance');
      expect(adapter.exchangeInfo.type).toBe('cex');
      expect(adapter.exchangeInfo.supportedFeatures.spot).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.futures).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.websocket).toBe(true);
    });
  });

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      mockSpotClient.request.mockResolvedValue({
        data: { balances: [] },
      });

      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      // Mock WebSocket
      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      expect(adapter.isConnected()).toBe(true);
    });

    it('should throw error for invalid credentials', async () => {
      mockSpotClient.request.mockRejectedValue(new Error('Invalid API key'));

      await expect(
        adapter.connect({
          apiKey: 'invalidKey',
          apiSecret: 'invalidSecret',
        })
      ).rejects.toThrow('Invalid API credentials');

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      // First connect
      mockSpotClient.request.mockResolvedValue({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('getSpotBalances', () => {
    beforeEach(async () => {
      // Setup connection
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should return spot balances', async () => {
      mockSpotClient.request.mockResolvedValue({
        data: {
          balances: [
            { asset: 'BTC', free: '1.5', locked: '0.5' },
            { asset: 'ETH', free: '10.0', locked: '0' },
            { asset: 'USDT', free: '0', locked: '0' }, // Should be filtered out
          ],
        },
      });

      const balances = await adapter.getSpotBalances();

      expect(balances).toHaveLength(2);
      expect(balances[0].asset).toBe('BTC');
      expect(balances[0].free.toNumber()).toBe(1.5);
      expect(balances[0].locked.toNumber()).toBe(0.5);
      expect(balances[0].total.toNumber()).toBe(2);
      expect(balances[0].balanceType).toBe('spot');

      expect(balances[1].asset).toBe('ETH');
      expect(balances[1].total.toNumber()).toBe(10);
    });

    it('should handle empty balances', async () => {
      mockSpotClient.request.mockResolvedValue({
        data: { balances: [] },
      });

      const balances = await adapter.getSpotBalances();
      expect(balances).toHaveLength(0);
    });
  });

  describe('getFuturesBalances', () => {
    beforeEach(async () => {
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should return futures balances', async () => {
      mockFuturesClient.request.mockResolvedValue({
        data: [
          {
            asset: 'USDT',
            walletBalance: '10000',
            unrealizedProfit: '500',
            marginBalance: '10500',
            availableBalance: '8000',
          },
        ],
      });

      const balances = await adapter.getFuturesBalances();

      expect(balances).toHaveLength(1);
      expect(balances[0].asset).toBe('USDT');
      expect(balances[0].total.toNumber()).toBe(10000);
      expect(balances[0].free.toNumber()).toBe(8000);
      expect(balances[0].balanceType).toBe('futures');
    });
  });

  describe('getFuturesPositions', () => {
    beforeEach(async () => {
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should return open futures positions', async () => {
      mockFuturesClient.request.mockResolvedValue({
        data: {
          positions: [
            {
              symbol: 'BTCUSDT',
              positionSide: 'BOTH',
              positionAmt: '0.5',
              entryPrice: '40000',
              markPrice: '42000',
              unRealizedProfit: '1000',
              liquidationPrice: '35000',
              leverage: '10',
              marginType: 'cross',
              isolatedMargin: '0',
              notional: '21000',
            },
            {
              symbol: 'ETHUSDT',
              positionSide: 'BOTH',
              positionAmt: '0', // Should be filtered out
              entryPrice: '3000',
              markPrice: '3100',
              unRealizedProfit: '0',
              liquidationPrice: '0',
              leverage: '5',
              marginType: 'cross',
              isolatedMargin: '0',
              notional: '0',
            },
          ],
        },
      });

      const positions = await adapter.getFuturesPositions();

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTCUSDT');
      expect(positions[0].side).toBe('long');
      expect(positions[0].size.toNumber()).toBe(0.5);
      expect(positions[0].entryPrice.toNumber()).toBe(40000);
      expect(positions[0].markPrice.toNumber()).toBe(42000);
      expect(positions[0].unrealizedPnl.toNumber()).toBe(1000);
      expect(positions[0].leverage).toBe(10);
    });

    it('should handle short positions', async () => {
      mockFuturesClient.request.mockResolvedValue({
        data: {
          positions: [
            {
              symbol: 'BTCUSDT',
              positionSide: 'SHORT',
              positionAmt: '-0.5', // Negative for short
              entryPrice: '42000',
              markPrice: '40000',
              unRealizedProfit: '1000',
              liquidationPrice: '50000',
              leverage: '10',
              marginType: 'isolated',
              isolatedMargin: '2100',
              notional: '-20000',
            },
          ],
        },
      });

      const positions = await adapter.getFuturesPositions();

      expect(positions).toHaveLength(1);
      expect(positions[0].side).toBe('short');
      expect(positions[0].size.toNumber()).toBe(0.5); // Absolute value
      expect(positions[0].marginType).toBe('isolated');
    });
  });

  describe('getTradeHistory', () => {
    beforeEach(async () => {
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should return trade history', async () => {
      const mockTrades = [
        {
          id: 123456,
          symbol: 'BTCUSDT',
          orderId: 789,
          price: '40000',
          qty: '0.1',
          quoteQty: '4000',
          commission: '0.0001',
          commissionAsset: 'BTC',
          time: 1704067200000,
          isBuyer: true,
          isMaker: false,
        },
      ];

      mockSpotClient.request.mockResolvedValue({ data: mockTrades });

      const trades = await adapter.getTradeHistory({ symbol: 'BTCUSDT' });

      expect(trades).toHaveLength(1);
      expect(trades[0].id).toBe('123456');
      expect(trades[0].symbol).toBe('BTCUSDT');
      expect(trades[0].side).toBe('buy');
      expect(trades[0].price.toNumber()).toBe(40000);
      expect(trades[0].amount.toNumber()).toBe(0.1);
      expect(trades[0].fee.toNumber()).toBe(0.0001);
      expect(trades[0].feeAsset).toBe('BTC');
    });

    it('should return sell trades correctly', async () => {
      const mockTrades = [
        {
          id: 123457,
          symbol: 'ETHUSDT',
          orderId: 790,
          price: '3000',
          qty: '1',
          quoteQty: '3000',
          commission: '3',
          commissionAsset: 'USDT',
          time: 1704067200000,
          isBuyer: false,
          isMaker: true,
        },
      ];

      mockSpotClient.request.mockResolvedValue({ data: mockTrades });

      const trades = await adapter.getTradeHistory({ symbol: 'ETHUSDT' });

      expect(trades[0].side).toBe('sell');
    });
  });

  describe('getFundingRates', () => {
    beforeEach(async () => {
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should return funding rates', async () => {
      mockFuturesClient.get.mockResolvedValue({
        data: [
          {
            symbol: 'BTCUSDT',
            fundingRate: '0.0001',
            fundingTime: 1704067200000,
          },
          {
            symbol: 'ETHUSDT',
            fundingRate: '-0.0002',
            fundingTime: 1704067200000,
          },
        ],
      });

      const rates = await adapter.getFundingRates();

      expect(rates).toHaveLength(2);
      expect(rates[0].symbol).toBe('BTCUSDT');
      expect(rates[0].rate.toNumber()).toBe(0.0001);
      expect(rates[1].symbol).toBe('ETHUSDT');
      expect(rates[1].rate.toNumber()).toBe(-0.0002);
    });
  });

  describe('signature generation', () => {
    it('should generate HMAC SHA256 signature', async () => {
      mockSpotClient.request.mockResolvedValue({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      // The HmacSHA256 mock should have been called during connection
      expect(CryptoJS.HmacSHA256).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockSpotClient.request.mockResolvedValueOnce({
        data: { balances: [] },
      });
      mockSpotClient.post.mockResolvedValue({
        data: { listenKey: 'testListenKey' },
      });

      const mockWs = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });
    });

    it('should handle API errors gracefully', async () => {
      mockSpotClient.request.mockRejectedValue({
        response: {
          status: 429,
          data: { code: -1015, msg: 'Too many requests' },
        },
      });

      // The adapter should throw or handle the error
      await expect(adapter.getSpotBalances()).rejects.toBeDefined();
    });

    it('should handle network errors', async () => {
      mockSpotClient.request.mockRejectedValue(new Error('Network Error'));

      await expect(adapter.getSpotBalances()).rejects.toThrow();
    });
  });
});
