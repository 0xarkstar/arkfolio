import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';

// Mock axios before importing PriceService
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

// We need to reset the singleton between tests
describe('PriceService', () => {
  let priceService: typeof import('../PriceService').priceService;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const module = await import('../PriceService');
    priceService = module.priceService;
    priceService.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isStablecoin', () => {
    it('should return true for USDT', () => {
      expect(priceService.isStablecoin('USDT')).toBe(true);
    });

    it('should return true for USDC', () => {
      expect(priceService.isStablecoin('USDC')).toBe(true);
    });

    it('should return true for DAI', () => {
      expect(priceService.isStablecoin('DAI')).toBe(true);
    });

    it('should return false for BTC', () => {
      expect(priceService.isStablecoin('BTC')).toBe(false);
    });

    it('should return false for ETH', () => {
      expect(priceService.isStablecoin('ETH')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(priceService.isStablecoin('usdt')).toBe(true);
      expect(priceService.isStablecoin('Usdc')).toBe(true);
    });
  });

  describe('getPrice for stablecoins', () => {
    it('should return $1 USD for USDT', async () => {
      const price = await priceService.getPrice('USDT');
      expect(price).not.toBeNull();
      expect(price!.priceUsd.equals(new Decimal(1))).toBe(true);
    });

    it('should return $1 USD for USDC', async () => {
      const price = await priceService.getPrice('USDC');
      expect(price).not.toBeNull();
      expect(price!.priceUsd.equals(new Decimal(1))).toBe(true);
    });

    it('should return approximate KRW for stablecoins', async () => {
      const price = await priceService.getPrice('USDT');
      expect(price).not.toBeNull();
      expect(price!.priceKrw.greaterThan(0)).toBe(true);
    });

    it('should return 0% change for stablecoins', async () => {
      const price = await priceService.getPrice('USDT');
      expect(price).not.toBeNull();
      expect(price!.change24h).toBe(0);
    });
  });

  describe('getPrices for multiple stablecoins', () => {
    it('should return prices for multiple stablecoins', async () => {
      const prices = await priceService.getPrices(['USDT', 'USDC', 'DAI']);

      expect(prices.size).toBe(3);
      expect(prices.has('USDT')).toBe(true);
      expect(prices.has('USDC')).toBe(true);
      expect(prices.has('DAI')).toBe(true);
    });

    it('should all have $1 USD price', async () => {
      const prices = await priceService.getPrices(['USDT', 'USDC', 'DAI']);

      prices.forEach((price) => {
        expect(price.priceUsd.equals(new Decimal(1))).toBe(true);
      });
    });
  });

  describe('cache functionality', () => {
    it('should cache stablecoin prices', async () => {
      await priceService.getPrice('USDT');
      const cached = priceService.getCachedPrices();

      expect(cached.has('USDT')).toBe(true);
    });

    it('should return cached prices', async () => {
      await priceService.getPrice('USDT');
      const cached = priceService.getCachedPrices();
      const price = cached.get('USDT');

      expect(price).not.toBeUndefined();
      expect(price!.symbol).toBe('USDT');
    });

    it('should clear cache', async () => {
      await priceService.getPrice('USDT');
      priceService.clearCache();
      const cached = priceService.getCachedPrices();

      expect(cached.size).toBe(0);
    });
  });

  describe('getUsdKrwRate', () => {
    it('should return a positive value', async () => {
      const rate = await priceService.getUsdKrwRate();
      expect(rate.greaterThan(0)).toBe(true);
    });

    it('should return approximately 1450 as default', async () => {
      const rate = await priceService.getUsdKrwRate();
      expect(rate.equals(new Decimal(1450))).toBe(true);
    });
  });

  describe('setCacheTtl', () => {
    it('should allow setting custom TTL', () => {
      // This just tests that the method doesn't throw
      expect(() => priceService.setCacheTtl(30000)).not.toThrow();
    });
  });
});
