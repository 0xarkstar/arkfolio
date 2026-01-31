import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { UpbitAdapter } from '../UpbitAdapter';
import { SupportedExchange } from '../../types';

// Mock axios
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
    SHA512: vi.fn(() => ({
      toString: () => 'mockedhash123',
    })),
    enc: {
      Base64: {
        stringify: () => 'base64string',
      },
    },
  },
}));

describe('UpbitAdapter', () => {
  let adapter: UpbitAdapter;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
    };

    (axios.create as any).mockReturnValue(mockClient);

    // Mock WebSocket
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onclose: (() => void) | null = null;
      close = vi.fn();
      send = vi.fn();
    }
    global.WebSocket = MockWebSocket as any;

    adapter = new UpbitAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exchangeInfo', () => {
    it('should have correct exchange info', () => {
      expect(adapter.exchangeId).toBe(SupportedExchange.UPBIT);
      expect(adapter.exchangeInfo.name).toBe('Upbit');
      expect(adapter.exchangeInfo.type).toBe('cex');
      expect(adapter.exchangeInfo.supportedFeatures.spot).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.futures).toBe(false);
      expect(adapter.exchangeInfo.supportedFeatures.margin).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      mockClient.request.mockResolvedValue({
        data: [{ currency: 'BTC', balance: '1.0', locked: '0' }],
      });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      expect(adapter.isConnected()).toBe(true);
    });

    it('should throw error for invalid credentials', async () => {
      mockClient.request.mockRejectedValue(new Error('Invalid API key'));

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
      mockClient.request.mockResolvedValue({ data: [] });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('getSpotBalances', () => {
    it('should return spot balances', async () => {
      // First call for connection, subsequent for getSpotBalances
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockResolvedValueOnce({
          data: [
            {
              currency: 'BTC',
              balance: '1.5',
              locked: '0.5',
              avg_buy_price: '40000000',
              avg_buy_price_modified: false,
              unit_currency: 'KRW',
            },
            {
              currency: 'ETH',
              balance: '10.0',
              locked: '0',
              avg_buy_price: '3000000',
              avg_buy_price_modified: false,
              unit_currency: 'KRW',
            },
          ],
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const balances = await adapter.getSpotBalances();

      expect(balances).toHaveLength(2);
      expect(balances[0].asset).toBe('BTC');
      expect(balances[0].free.toNumber()).toBe(1.5);
      expect(balances[0].locked.toNumber()).toBe(0.5);
      expect(balances[0].total.toNumber()).toBe(2);
      expect(balances[0].balanceType).toBe('spot');
    });

    it('should handle empty balances', async () => {
      mockClient.request.mockResolvedValue({ data: [] });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const balances = await adapter.getSpotBalances();
      expect(balances).toHaveLength(0);
    });

    it('should include KRW balance when non-zero', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockResolvedValueOnce({
          data: [
            {
              currency: 'KRW',
              balance: '1000000',
              locked: '0',
              avg_buy_price: '0',
              avg_buy_price_modified: false,
              unit_currency: 'KRW',
            },
          ],
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const balances = await adapter.getSpotBalances();
      expect(balances).toHaveLength(1);
      expect(balances[0].asset).toBe('KRW');
      expect(balances[0].total.toNumber()).toBe(1000000);
    });
  });

  describe('getFuturesBalances', () => {
    it('should return empty array (Upbit does not support futures)', async () => {
      mockClient.request.mockResolvedValue({ data: [] });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const balances = await adapter.getFuturesBalances();
      expect(balances).toHaveLength(0);
    });
  });

  describe('getFuturesPositions', () => {
    it('should return empty array (Upbit does not support futures)', async () => {
      mockClient.request.mockResolvedValue({ data: [] });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const positions = await adapter.getFuturesPositions();
      expect(positions).toHaveLength(0);
    });
  });

  describe('getDepositHistory', () => {
    it('should return deposit history', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockResolvedValueOnce({
          data: [
            {
              uuid: 'dep-123',
              currency: 'BTC',
              txid: '0xabc123',
              state: 'ACCEPTED',
              created_at: '2024-01-01T00:00:00.000Z',
              done_at: '2024-01-01T00:10:00.000Z',
              amount: '0.5',
              fee: '0.0001',
            },
          ],
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const transfers = await adapter.getDepositHistory({});

      expect(transfers).toHaveLength(1);
      expect(transfers[0].id).toBe('dep-123');
      expect(transfers[0].asset).toBe('BTC');
      expect(transfers[0].type).toBe('deposit');
      expect(transfers[0].amount.toNumber()).toBe(0.5);
    });
  });

  describe('getWithdrawHistory', () => {
    it('should return withdraw history', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockResolvedValueOnce({
          data: [
            {
              uuid: 'wd-456',
              currency: 'ETH',
              txid: '0xdef456',
              state: 'DONE',
              created_at: '2024-01-02T00:00:00.000Z',
              done_at: '2024-01-02T00:30:00.000Z',
              amount: '2.0',
              fee: '0.01',
            },
          ],
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const transfers = await adapter.getWithdrawHistory({});

      expect(transfers).toHaveLength(1);
      expect(transfers[0].id).toBe('wd-456');
      expect(transfers[0].asset).toBe('ETH');
      expect(transfers[0].type).toBe('withdraw');
      expect(transfers[0].amount.toNumber()).toBe(2.0);
      expect(transfers[0].fee?.toNumber()).toBe(0.01);
    });
  });

  describe('KRW market handling', () => {
    it('should handle KRW-prefixed market symbols', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockResolvedValueOnce({
          data: [
            {
              currency: 'BTC',
              balance: '1.0',
              locked: '0',
              avg_buy_price: '50000000', // 50M KRW
              avg_buy_price_modified: false,
              unit_currency: 'KRW',
            },
          ],
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      const balances = await adapter.getSpotBalances();

      expect(balances).toHaveLength(1);
      expect(balances[0].asset).toBe('BTC');
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockRejectedValueOnce({
          response: {
            status: 429,
            data: { error: { message: 'Too Many Requests' } },
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      await expect(adapter.getSpotBalances()).rejects.toBeDefined();
    });

    it('should handle network errors', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockRejectedValueOnce(new Error('Network Error'));

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      await expect(adapter.getSpotBalances()).rejects.toThrow();
    });

    it('should handle API errors with error response', async () => {
      mockClient.request
        .mockResolvedValueOnce({ data: [] }) // connect
        .mockRejectedValueOnce({
          response: {
            status: 400,
            data: { error: { name: 'invalid_query_payload', message: 'Invalid parameter' } },
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
      });

      await expect(adapter.getSpotBalances()).rejects.toBeDefined();
    });
  });
});
