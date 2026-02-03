/**
 * Exchange Adapter Mock for testing
 *
 * Provides mock implementations of exchange adapters
 * for testing stores and services that depend on exchange data.
 */
import { vi } from 'vitest';
import Decimal from 'decimal.js';
import type {
  Balance,
  Position,
  EarnPosition,
  Trade,
  Transfer,
  FundingRate,
  ExchangeCredentials,
  ExchangeInfo,
} from '../../services/exchanges/types';

// Mock exchange data storage
let mockBalances: Balance[] = [];
let mockPositions: Position[] = [];
let mockEarnPositions: EarnPosition[] = [];
let mockTrades: Trade[] = [];
let mockDeposits: Transfer[] = [];
let mockWithdrawals: Transfer[] = [];
let mockFundingRates: FundingRate[] = [];
let isConnected = false;

/**
 * Mock exchange adapter that implements the BaseExchangeAdapter interface
 */
export const mockExchangeAdapter = {
  exchangeId: 'mock-exchange',
  exchangeInfo: {
    id: 'mock-exchange',
    name: 'Mock Exchange',
    type: 'cex' as const,
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: false,
      earn: true,
      deposit: true,
      withdraw: true,
      websocket: false,
    },
  } as ExchangeInfo,

  connect: vi.fn(async (_credentials: ExchangeCredentials): Promise<void> => {
    isConnected = true;
  }),

  disconnect: vi.fn(async (): Promise<void> => {
    isConnected = false;
  }),

  testConnection: vi.fn(async (): Promise<boolean> => {
    return isConnected;
  }),

  isConnected: vi.fn((): boolean => {
    return isConnected;
  }),

  getSpotBalances: vi.fn(async (): Promise<Balance[]> => {
    return mockBalances.filter((b) => b.balanceType === 'spot');
  }),

  getFuturesBalances: vi.fn(async (): Promise<Balance[]> => {
    return mockBalances.filter((b) => b.balanceType === 'futures');
  }),

  getFuturesPositions: vi.fn(async (): Promise<Position[]> => {
    return mockPositions;
  }),

  getEarnPositions: vi.fn(async (): Promise<EarnPosition[]> => {
    return mockEarnPositions;
  }),

  getTradeHistory: vi.fn(async (): Promise<Trade[]> => {
    return mockTrades;
  }),

  getDepositHistory: vi.fn(async (): Promise<Transfer[]> => {
    return mockDeposits;
  }),

  getWithdrawHistory: vi.fn(async (): Promise<Transfer[]> => {
    return mockWithdrawals;
  }),

  getFundingRates: vi.fn(async (): Promise<FundingRate[]> => {
    return mockFundingRates;
  }),

  subscribeBalanceUpdates: vi.fn((_callback: (balance: Balance) => void): (() => void) => {
    return () => {};
  }),

  subscribePositionUpdates: vi.fn((_callback: (position: Position) => void): (() => void) => {
    return () => {};
  }),
};

/**
 * Mock exchange manager
 */
export const mockExchangeManager = {
  createAdapter: vi.fn(() => mockExchangeAdapter),
  getAdapter: vi.fn(() => mockExchangeAdapter),
  removeAdapter: vi.fn(),
  getSupportedExchanges: vi.fn(() => ['binance', 'okx', 'upbit', 'mock-exchange']),
};

/**
 * Reset all exchange mock states
 */
export function resetExchangeMock(): void {
  mockBalances = [];
  mockPositions = [];
  mockEarnPositions = [];
  mockTrades = [];
  mockDeposits = [];
  mockWithdrawals = [];
  mockFundingRates = [];
  isConnected = false;
  vi.clearAllMocks();
}

/**
 * Set mock balances
 */
export function setMockBalances(balances: Balance[]): void {
  mockBalances = balances;
}

/**
 * Set mock positions
 */
export function setMockPositions(positions: Position[]): void {
  mockPositions = positions;
}

/**
 * Set mock earn positions
 */
export function setMockEarnPositions(earnPositions: EarnPosition[]): void {
  mockEarnPositions = earnPositions;
}

/**
 * Set mock trades
 */
export function setMockTrades(trades: Trade[]): void {
  mockTrades = trades;
}

/**
 * Set mock deposits
 */
export function setMockDeposits(deposits: Transfer[]): void {
  mockDeposits = deposits;
}

/**
 * Set mock withdrawals
 */
export function setMockWithdrawals(withdrawals: Transfer[]): void {
  mockWithdrawals = withdrawals;
}

/**
 * Set mock funding rates
 */
export function setMockFundingRates(rates: FundingRate[]): void {
  mockFundingRates = rates;
}

/**
 * Set mock connection state
 */
export function setMockConnectionState(connected: boolean): void {
  isConnected = connected;
}

/**
 * Create default test balances
 */
export function createDefaultTestBalances(): Balance[] {
  return [
    {
      asset: 'BTC',
      free: new Decimal('1.5'),
      locked: new Decimal('0.5'),
      total: new Decimal('2.0'),
      balanceType: 'spot',
      valueUsd: new Decimal('80000'),
    },
    {
      asset: 'ETH',
      free: new Decimal('10.0'),
      locked: new Decimal('0'),
      total: new Decimal('10.0'),
      balanceType: 'spot',
      valueUsd: new Decimal('25000'),
    },
    {
      asset: 'USDT',
      free: new Decimal('5000'),
      locked: new Decimal('1000'),
      total: new Decimal('6000'),
      balanceType: 'spot',
      valueUsd: new Decimal('6000'),
    },
  ];
}

/**
 * Create default test positions
 */
export function createDefaultTestPositions(): Position[] {
  return [
    {
      id: 'pos-1',
      symbol: 'BTCUSDT',
      side: 'long',
      size: new Decimal('0.5'),
      entryPrice: new Decimal('40000'),
      markPrice: new Decimal('42000'),
      unrealizedPnl: new Decimal('1000'),
      leverage: 10,
      liquidationPrice: new Decimal('36000'),
      marginType: 'cross',
      margin: new Decimal('2000'),
      notional: new Decimal('21000'),
    },
  ];
}

/**
 * Create default test earn positions
 */
export function createDefaultTestEarnPositions(): EarnPosition[] {
  return [
    {
      id: 'earn-1',
      asset: 'USDT',
      amount: new Decimal('10000'),
      apy: 5.5,
      productType: 'flexible',
      productName: 'Simple Earn Flexible',
      accruedInterest: new Decimal('45.83'),
      redeemable: true,
    },
    {
      id: 'earn-2',
      asset: 'ETH',
      amount: new Decimal('5.0'),
      apy: 3.2,
      productType: 'staking',
      productName: 'ETH 2.0 Staking',
      accruedInterest: new Decimal('0.15'),
      redeemable: false,
    },
  ];
}

/**
 * Setup exchange mock with default data
 */
export function setupExchangeMockWithDefaults(): void {
  setMockBalances(createDefaultTestBalances());
  setMockPositions(createDefaultTestPositions());
  setMockEarnPositions(createDefaultTestEarnPositions());
  setMockConnectionState(true);
}
