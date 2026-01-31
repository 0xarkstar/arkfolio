import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { OKXAdapter } from '../OKXAdapter';
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
    enc: {
      Base64: {
        stringify: () => 'base64signature',
      },
    },
  },
}));

describe('OKXAdapter', () => {
  let adapter: OKXAdapter;
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

    adapter = new OKXAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exchangeInfo', () => {
    it('should have correct exchange info', () => {
      expect(adapter.exchangeId).toBe(SupportedExchange.OKX);
      expect(adapter.exchangeInfo.name).toBe('OKX');
      expect(adapter.exchangeInfo.type).toBe('cex');
      expect(adapter.exchangeInfo.supportedFeatures.spot).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.futures).toBe(true);
      expect(adapter.exchangeInfo.supportedFeatures.earn).toBe(true);
    });
  });

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      mockClient.request.mockResolvedValue({
        data: {
          code: '0',
          data: [{ totalEq: '10000', details: [] }],
        },
      });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      expect(adapter.isConnected()).toBe(true);
    });

    it('should throw error for invalid credentials', async () => {
      mockClient.request.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        adapter.connect({
          apiKey: 'invalidKey',
          apiSecret: 'invalidSecret',
          passphrase: 'invalidPassphrase',
        })
      ).rejects.toThrow('Invalid API credentials');

      expect(adapter.isConnected()).toBe(false);
    });

    it('should require passphrase', async () => {
      await expect(
        adapter.connect({
          apiKey: 'testApiKey',
          apiSecret: 'testApiSecret',
        })
      ).rejects.toThrow('passphrase');
    });
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      mockClient.request.mockResolvedValue({
        data: {
          code: '0',
          data: [{ totalEq: '10000', details: [] }],
        },
      });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('getSpotBalances', () => {
    it('should return spot balances', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect - uses /api/v5/account/balance
        .mockResolvedValueOnce({
          data: {
            code: '0',
            data: [
              { ccy: 'BTC', bal: '1.5', frozenBal: '0.5', availBal: '1.0', eqUsd: '60000' },
              { ccy: 'ETH', bal: '10.0', frozenBal: '0', availBal: '10.0', eqUsd: '30000' },
            ],
          },
        }); // getSpotBalances - uses /api/v5/asset/balances

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      const balances = await adapter.getSpotBalances();

      expect(balances).toHaveLength(2);
      expect(balances[0].asset).toBe('BTC');
      expect(balances[0].free.toNumber()).toBe(1.0);
      expect(balances[0].locked.toNumber()).toBe(0.5);
      expect(balances[0].total.toNumber()).toBe(1.5);
      expect(balances[0].balanceType).toBe('spot');
    });

    it('should handle empty balances', async () => {
      mockClient.request.mockResolvedValue({
        data: { code: '0', data: [] },
      });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      const balances = await adapter.getSpotBalances();
      expect(balances).toHaveLength(0);
    });
  });

  describe('getFuturesPositions', () => {
    it('should return futures positions', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect
        .mockResolvedValueOnce({
          data: {
            code: '0',
            data: [
              {
                instId: 'BTC-USDT-SWAP',
                posSide: 'long',
                pos: '0.5',
                avgPx: '40000',
                markPx: '42000',
                upl: '1000',
                lever: '10',
                liqPx: '35000',
                mgnMode: 'cross',
                margin: '2000',
                notionalUsd: '21000',
              },
            ],
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      const positions = await adapter.getFuturesPositions();

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTC-USDT-SWAP');
      expect(positions[0].side).toBe('long');
      expect(positions[0].size.toNumber()).toBe(0.5);
      expect(positions[0].entryPrice.toNumber()).toBe(40000);
      expect(positions[0].markPrice.toNumber()).toBe(42000);
      expect(positions[0].leverage).toBe(10);
    });

    it('should handle short positions', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect
        .mockResolvedValueOnce({
          data: {
            code: '0',
            data: [
              {
                instId: 'ETH-USDT-SWAP',
                posSide: 'short',
                pos: '-2.0',
                avgPx: '3000',
                markPx: '2900',
                upl: '200',
                lever: '5',
                liqPx: '3500',
                mgnMode: 'isolated',
                margin: '1200',
                notionalUsd: '5800',
              },
            ],
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      const positions = await adapter.getFuturesPositions();

      expect(positions).toHaveLength(1);
      expect(positions[0].side).toBe('short');
      expect(positions[0].marginType).toBe('isolated');
    });
  });

  describe('getTradeHistory', () => {
    it('should return trade history', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect
        .mockResolvedValueOnce({
          data: {
            code: '0',
            data: [
              {
                instId: 'BTC-USDT',
                tradeId: '123456',
                ordId: '789',
                side: 'buy',
                fillPx: '40000',
                fillSz: '0.1',
                fee: '-0.0001',
                feeCcy: 'BTC',
                ts: '1704067200000',
              },
            ],
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      const trades = await adapter.getTradeHistory({ symbol: 'BTC-USDT' });

      expect(trades).toHaveLength(1);
      expect(trades[0].id).toBe('123456');
      expect(trades[0].symbol).toBe('BTC-USDT');
      expect(trades[0].side).toBe('buy');
      expect(trades[0].price.toNumber()).toBe(40000);
      expect(trades[0].amount.toNumber()).toBe(0.1);
    });
  });

  describe('signature generation', () => {
    it('should generate correct signature format', async () => {
      mockClient.request.mockResolvedValue({
        data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
      });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      expect(CryptoJS.HmacSHA256).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw on API errors', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect
        .mockResolvedValueOnce({
          data: {
            code: '50000',
            msg: 'Parameter error',
            data: [],
          },
        });

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      await expect(adapter.getSpotBalances()).rejects.toThrow('OKX API error');
    });

    it('should handle network errors', async () => {
      mockClient.request
        .mockResolvedValueOnce({
          data: { code: '0', data: [{ totalEq: '10000', details: [] }] },
        }) // connect
        .mockRejectedValueOnce(new Error('Network Error'));

      await adapter.connect({
        apiKey: 'testApiKey',
        apiSecret: 'testApiSecret',
        passphrase: 'testPassphrase',
      });

      await expect(adapter.getSpotBalances()).rejects.toThrow();
    });
  });
});
