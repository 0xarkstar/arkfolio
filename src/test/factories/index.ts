/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data objects
 * with sensible defaults that can be overridden as needed.
 */
import Decimal from 'decimal.js';
import type {
  Balance,
  Position,
  EarnPosition,
  Trade,
  Transfer,
  FundingRate,
  ExchangeCredentials,
} from '../../services/exchanges/types';
import { SupportedExchange } from '../../services/exchanges/types';
import type { ExchangeAccount } from '../../stores/exchangeStore';
import type { DefiPosition } from '../../stores/defiStore';

// Counter for generating unique IDs
let idCounter = 0;

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  idCounter++;
  return `${prefix}-${idCounter}-${Date.now()}`;
}

/**
 * Reset the ID counter (call in beforeEach)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// Exchange Types Factories
// ============================================================================

/**
 * Create a Balance object with defaults
 */
export function createBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    asset: 'BTC',
    free: new Decimal('1.0'),
    locked: new Decimal('0'),
    total: new Decimal('1.0'),
    balanceType: 'spot',
    valueUsd: new Decimal('40000'),
    ...overrides,
  };
}

/**
 * Create a Position object with defaults
 */
export function createPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: generateTestId('pos'),
    symbol: 'BTCUSDT',
    side: 'long',
    size: new Decimal('0.1'),
    entryPrice: new Decimal('40000'),
    markPrice: new Decimal('41000'),
    unrealizedPnl: new Decimal('100'),
    leverage: 10,
    liquidationPrice: new Decimal('36000'),
    marginType: 'cross',
    margin: new Decimal('400'),
    notional: new Decimal('4100'),
    ...overrides,
  };
}

/**
 * Create an EarnPosition object with defaults
 */
export function createEarnPosition(overrides: Partial<EarnPosition> = {}): EarnPosition {
  return {
    id: generateTestId('earn'),
    asset: 'USDT',
    amount: new Decimal('1000'),
    apy: 5.0,
    productType: 'flexible',
    productName: 'Simple Earn Flexible',
    accruedInterest: new Decimal('4.17'),
    redeemable: true,
    ...overrides,
  };
}

/**
 * Create a Trade object with defaults
 */
export function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: generateTestId('trade'),
    symbol: 'BTCUSDT',
    side: 'buy',
    price: new Decimal('40000'),
    amount: new Decimal('0.1'),
    cost: new Decimal('4000'),
    fee: new Decimal('4'),
    feeAsset: 'USDT',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create a Transfer object with defaults
 */
export function createTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: generateTestId('transfer'),
    asset: 'USDT',
    amount: new Decimal('1000'),
    type: 'deposit',
    status: 'completed',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create a FundingRate object with defaults
 */
export function createFundingRate(overrides: Partial<FundingRate> = {}): FundingRate {
  return {
    symbol: 'BTCUSDT',
    rate: new Decimal('0.0001'),
    timestamp: new Date(),
    nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
    ...overrides,
  };
}

/**
 * Create ExchangeCredentials with defaults
 */
export function createCredentials(overrides: Partial<ExchangeCredentials> = {}): ExchangeCredentials {
  return {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    ...overrides,
  };
}

// ============================================================================
// Store Types Factories
// ============================================================================

/**
 * Create an ExchangeAccount object with defaults
 */
export function createExchangeAccount(overrides: Partial<ExchangeAccount> = {}): ExchangeAccount {
  return {
    id: generateTestId('account'),
    exchangeId: SupportedExchange.BINANCE,
    name: 'My Binance',
    type: 'cex',
    isConnected: true,
    wsStatus: 'disconnected',
    lastSync: new Date(),
    ...overrides,
  };
}

/**
 * Create a DefiPosition object with defaults
 */
export function createDefiPosition(overrides: Partial<DefiPosition> = {}): DefiPosition {
  return {
    id: generateTestId('defi'),
    walletId: 'wallet-1',
    protocol: 'Aave',
    positionType: 'lending',
    poolAddress: '0x1234567890abcdef1234567890abcdef12345678',
    assets: ['USDC'],
    amounts: [new Decimal('10000')],
    costBasisUsd: new Decimal('10000'),
    currentValueUsd: new Decimal('10050'),
    rewardsEarned: { AAVE: new Decimal('5') },
    apy: 3.5,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    entryDate: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Wallet Types Factories
// ============================================================================

interface WalletData {
  id: string;
  address: string;
  chain: string;
  name: string;
  isConnected: boolean;
  lastSync: Date | null;
}

/**
 * Create a Wallet object with defaults
 */
export function createWallet(overrides: Partial<WalletData> = {}): WalletData {
  return {
    id: generateTestId('wallet'),
    address: '0x' + 'a'.repeat(40),
    chain: 'ethereum',
    name: 'My Wallet',
    isConnected: true,
    lastSync: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Transaction Types Factories
// ============================================================================

interface TransactionData {
  id: string;
  exchangeId: string | null;
  type: string;
  asset: string;
  amount: number;
  priceUsd: number | null;
  priceKrw: number | null;
  fee: number | null;
  feeAsset: string | null;
  timestamp: Date;
}

/**
 * Create a Transaction object with defaults
 */
export function createTransaction(overrides: Partial<TransactionData> = {}): TransactionData {
  return {
    id: generateTestId('tx'),
    exchangeId: 'exchange-1',
    type: 'buy',
    asset: 'BTC',
    amount: 0.1,
    priceUsd: 40000,
    priceKrw: 52000000,
    fee: 4,
    feeAsset: 'USDT',
    timestamp: new Date(),
    ...overrides,
  };
}

// ============================================================================
// NFT Types Factories
// ============================================================================

interface NFTData {
  id: string;
  walletId: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  collection: string;
  chain: string;
  imageUrl: string | null;
  estimatedValueUsd: number | null;
}

/**
 * Create an NFT object with defaults
 */
export function createNFT(overrides: Partial<NFTData> = {}): NFTData {
  return {
    id: generateTestId('nft'),
    walletId: 'wallet-1',
    contractAddress: '0x' + 'b'.repeat(40),
    tokenId: '1234',
    name: 'Cool NFT #1234',
    collection: 'Cool Collection',
    chain: 'ethereum',
    imageUrl: 'https://example.com/nft.png',
    estimatedValueUsd: 500,
    ...overrides,
  };
}

// ============================================================================
// Alert Types Factories
// ============================================================================

interface AlertData {
  id: string;
  asset: string;
  type: 'price_above' | 'price_below' | 'percent_change';
  targetPrice: number | null;
  percentChange: number | null;
  isActive: boolean;
  triggeredAt: Date | null;
}

/**
 * Create an Alert object with defaults
 */
export function createAlert(overrides: Partial<AlertData> = {}): AlertData {
  return {
    id: generateTestId('alert'),
    asset: 'BTC',
    type: 'price_above',
    targetPrice: 50000,
    percentChange: null,
    isActive: true,
    triggeredAt: null,
    ...overrides,
  };
}

// ============================================================================
// Portfolio Snapshot Factory
// ============================================================================

interface SnapshotData {
  id: string;
  timestamp: Date;
  totalValueUsd: number;
  totalValueKrw: number;
  assetCount: number;
}

/**
 * Create a Portfolio Snapshot with defaults
 */
export function createSnapshot(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    id: generateTestId('snapshot'),
    timestamp: new Date(),
    totalValueUsd: 100000,
    totalValueKrw: 130000000,
    assetCount: 10,
    ...overrides,
  };
}

// ============================================================================
// Batch Factories (for creating multiple items)
// ============================================================================

/**
 * Create multiple balances for different assets
 */
export function createBalanceSet(): Balance[] {
  return [
    createBalance({ asset: 'BTC', total: new Decimal('2.0'), valueUsd: new Decimal('80000') }),
    createBalance({ asset: 'ETH', total: new Decimal('10.0'), valueUsd: new Decimal('25000') }),
    createBalance({ asset: 'USDT', total: new Decimal('5000'), valueUsd: new Decimal('5000') }),
    createBalance({ asset: 'SOL', total: new Decimal('100'), valueUsd: new Decimal('10000') }),
  ];
}

/**
 * Create multiple positions
 */
export function createPositionSet(): Position[] {
  return [
    createPosition({ symbol: 'BTCUSDT', side: 'long', size: new Decimal('0.5') }),
    createPosition({ symbol: 'ETHUSDT', side: 'short', size: new Decimal('2.0') }),
  ];
}

/**
 * Create a full exchange account setup with balances
 */
export function createFullExchangeSetup(): {
  account: ExchangeAccount;
  balances: Balance[];
  positions: Position[];
  earnPositions: EarnPosition[];
} {
  return {
    account: createExchangeAccount(),
    balances: createBalanceSet(),
    positions: createPositionSet(),
    earnPositions: [
      createEarnPosition({ asset: 'USDT', amount: new Decimal('10000') }),
      createEarnPosition({ asset: 'BTC', amount: new Decimal('0.5'), productType: 'staking' }),
    ],
  };
}
