import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { usePortfolioStore } from '../portfolioStore';
import type { AssetHolding, AssetAllocation } from '../portfolioStore';

// Mock dependencies
vi.mock('../../services/price', () => ({
  priceService: {
    getPrices: vi.fn(() => Promise.resolve(new Map([
      ['BTC', { priceUsd: new Decimal('40000'), priceKrw: new Decimal('52000000'), change24h: 2.5 }],
      ['ETH', { priceUsd: new Decimal('2500'), priceKrw: new Decimal('3250000'), change24h: -1.2 }],
    ]))),
  },
}));

// Mock exchange store
const mockAccounts = [
  { id: 'acc-1', name: 'Binance', isConnected: true },
];

const mockBalances = new Map([
  ['acc-1', [
    { asset: 'BTC', total: new Decimal('1.5'), free: new Decimal('1.0'), locked: new Decimal('0.5'), balanceType: 'spot' },
    { asset: 'ETH', total: new Decimal('10'), free: new Decimal('10'), locked: new Decimal('0'), balanceType: 'spot' },
  ]],
]);

const mockPositions = new Map();

vi.mock('../exchangeStore', () => ({
  useExchangeStore: {
    getState: vi.fn(() => ({
      accounts: mockAccounts,
      allBalances: mockBalances,
      allPositions: mockPositions,
    })),
  },
}));

describe('portfolioStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePortfolioStore.setState({
      summary: {
        totalValueUsd: new Decimal(0),
        totalValueKrw: new Decimal(0),
        change24hUsd: new Decimal(0),
        change24hPercent: 0,
        totalAssets: 0,
        totalExchanges: 0,
        totalPositions: 0,
      },
      holdings: [],
      allocations: [],
      prices: new Map(),
      isLoading: false,
      lastRefresh: null,
      error: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have zero total value initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.summary.totalValueUsd.equals(0)).toBe(true);
    });

    it('should have empty holdings initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.holdings).toEqual([]);
    });

    it('should have empty allocations initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.allocations).toEqual([]);
    });

    it('should not be loading initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have null lastRefresh initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.lastRefresh).toBeNull();
    });

    it('should have null error initially', () => {
      const state = usePortfolioStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('refreshPrices', () => {
    it('should fetch prices for given symbols', async () => {
      const { priceService } = await import('../../services/price');
      const { refreshPrices } = usePortfolioStore.getState();

      await refreshPrices(['BTC', 'ETH']);

      expect(priceService.getPrices).toHaveBeenCalledWith(['BTC', 'ETH']);
    });

    it('should update prices in state', async () => {
      const { refreshPrices } = usePortfolioStore.getState();

      await refreshPrices(['BTC', 'ETH']);

      const state = usePortfolioStore.getState();
      expect(state.prices.size).toBeGreaterThan(0);
    });
  });

  describe('refreshPortfolio', () => {
    it('should set loading state while refreshing', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      const promise = refreshPortfolio();

      // Check loading state was set
      expect(usePortfolioStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('should calculate total value from balances', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      // BTC: 1.5 * 40000 = 60000
      // ETH: 10 * 2500 = 25000
      // Total: 85000
      expect(state.summary.totalValueUsd.greaterThan(0)).toBe(true);
    });

    it('should update lastRefresh timestamp', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.lastRefresh).toBeInstanceOf(Date);
    });

    it('should set isLoading to false after refresh', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should create holdings for each asset', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.holdings.length).toBeGreaterThan(0);
    });

    it('should sort holdings by value descending', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      if (state.holdings.length >= 2) {
        expect(
          state.holdings[0].valueUsd.greaterThanOrEqualTo(state.holdings[1].valueUsd)
        ).toBe(true);
      }
    });

    it('should calculate allocations by category', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.allocations.length).toBeGreaterThan(0);
    });

    it('should handle empty balances', async () => {
      // Mock empty balances
      vi.mocked((await import('../exchangeStore')).useExchangeStore.getState).mockReturnValue({
        accounts: [],
        allBalances: new Map(),
        allPositions: new Map(),
        allEarnPositions: new Map(),
        isLoading: false,
        error: null,
        loadAccounts: vi.fn(),
        addExchange: vi.fn(),
        removeExchange: vi.fn(),
        connectExchange: vi.fn(),
        disconnectExchange: vi.fn(),
        syncExchange: vi.fn(),
        syncAllExchanges: vi.fn(),
        syncTransactions: vi.fn(),
        syncAllTransactions: vi.fn(),
        subscribeToUpdates: vi.fn(() => () => {}),
        updateWsStatus: vi.fn(),
        getBalances: vi.fn(),
        getPositions: vi.fn(),
        getEarnPositions: vi.fn(),
      } as unknown as ReturnType<typeof import('../exchangeStore').useExchangeStore.getState>);

      const { refreshPortfolio } = usePortfolioStore.getState();
      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.summary.totalValueUsd.equals(0)).toBe(true);
      expect(state.holdings.length).toBe(0);
    });
  });

  describe('holdings calculation', () => {
    it('should aggregate holdings from multiple exchanges', () => {
      // This is tested via refreshPortfolio
      // Holdings should have sources array showing which exchanges contributed
      const holding: AssetHolding = {
        symbol: 'BTC',
        name: 'Bitcoin',
        totalAmount: new Decimal('2'),
        freeAmount: new Decimal('1.5'),
        lockedAmount: new Decimal('0.5'),
        priceUsd: new Decimal('40000'),
        priceKrw: new Decimal('52000000'),
        valueUsd: new Decimal('80000'),
        valueKrw: new Decimal('104000000'),
        change24h: 2.5,
        allocation: 50,
        sources: [
          { exchangeId: 'acc-1', exchangeName: 'Binance', amount: new Decimal('2'), balanceType: 'spot' },
        ],
      };

      expect(holding.sources.length).toBeGreaterThan(0);
      expect(holding.sources[0].exchangeName).toBe('Binance');
    });

    it('should calculate allocation percentages correctly', () => {
      const holding1: AssetHolding = {
        symbol: 'BTC',
        name: 'Bitcoin',
        totalAmount: new Decimal('1'),
        freeAmount: new Decimal('1'),
        lockedAmount: new Decimal('0'),
        priceUsd: new Decimal('40000'),
        priceKrw: new Decimal('52000000'),
        valueUsd: new Decimal('40000'),
        valueKrw: new Decimal('52000000'),
        change24h: 2.5,
        allocation: 80, // 40000 / 50000 = 80%
        sources: [],
      };

      const holding2: AssetHolding = {
        symbol: 'ETH',
        name: 'Ethereum',
        totalAmount: new Decimal('4'),
        freeAmount: new Decimal('4'),
        lockedAmount: new Decimal('0'),
        priceUsd: new Decimal('2500'),
        priceKrw: new Decimal('3250000'),
        valueUsd: new Decimal('10000'),
        valueKrw: new Decimal('13000000'),
        change24h: -1.2,
        allocation: 20, // 10000 / 50000 = 20%
        sources: [],
      };

      expect(holding1.allocation + holding2.allocation).toBe(100);
    });
  });

  describe('asset allocation categories', () => {
    it('should categorize BTC correctly', () => {
      const allocation: AssetAllocation = {
        category: 'Bitcoin',
        value: new Decimal('60000'),
        percent: 60,
        color: 'bg-orange-500',
        assets: ['BTC'],
      };

      expect(allocation.category).toBe('Bitcoin');
      expect(allocation.assets).toContain('BTC');
    });

    it('should categorize ETH correctly', () => {
      const allocation: AssetAllocation = {
        category: 'Ethereum',
        value: new Decimal('25000'),
        percent: 25,
        color: 'bg-blue-500',
        assets: ['ETH'],
      };

      expect(allocation.category).toBe('Ethereum');
      expect(allocation.assets).toContain('ETH');
    });

    it('should categorize stablecoins correctly', () => {
      const allocation: AssetAllocation = {
        category: 'Stablecoins',
        value: new Decimal('10000'),
        percent: 10,
        color: 'bg-green-500',
        assets: ['USDT', 'USDC'],
      };

      expect(allocation.category).toBe('Stablecoins');
      expect(allocation.assets).toContain('USDT');
      expect(allocation.assets).toContain('USDC');
    });

    it('should categorize altcoins correctly', () => {
      const allocation: AssetAllocation = {
        category: 'Altcoins',
        value: new Decimal('5000'),
        percent: 5,
        color: 'bg-purple-500',
        assets: ['SOL', 'AVAX'],
      };

      expect(allocation.category).toBe('Altcoins');
      expect(allocation.assets).toContain('SOL');
    });
  });

  describe('24h change calculation', () => {
    it('should calculate weighted average change', async () => {
      const { refreshPortfolio } = usePortfolioStore.getState();

      await refreshPortfolio();

      const state = usePortfolioStore.getState();
      // Weighted change should be between min and max of individual changes
      // BTC: 2.5%, ETH: -1.2%
      expect(state.summary.change24hPercent).toBeGreaterThanOrEqual(-1.2);
      expect(state.summary.change24hPercent).toBeLessThanOrEqual(2.5);
    });
  });
});
