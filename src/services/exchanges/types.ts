import Decimal from 'decimal.js';

// Exchange credentials
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // For OKX
}

export interface EncryptedCredentials {
  apiKeyRef: string;
  apiSecretRef: string;
  passphraseRef?: string;
}

// Balance types
export type BalanceType = 'spot' | 'futures' | 'margin' | 'earn' | 'funding';

export interface Balance {
  asset: string;
  free: Decimal;
  locked: Decimal;
  total: Decimal;
  balanceType: BalanceType;
  valueUsd?: Decimal;
}

// Position types
export type PositionSide = 'long' | 'short';
export type MarginType = 'cross' | 'isolated';

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  leverage: number;
  liquidationPrice?: Decimal;
  marginType: MarginType;
  margin: Decimal;
  notional: Decimal;
}

// Trade types
export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: Decimal;
  amount: Decimal;
  cost: Decimal;
  fee: Decimal;
  feeAsset: string;
  timestamp: Date;
  orderId?: string;
}

// Transfer types
export interface Transfer {
  id: string;
  asset: string;
  amount: Decimal;
  type: 'deposit' | 'withdraw';
  txHash?: string;
  address?: string;
  network?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  fee?: Decimal;
  timestamp: Date;
}

// Earn position types
export interface EarnPosition {
  id: string;
  asset: string;
  amount: Decimal;
  apy: number;
  productType: 'flexible' | 'locked' | 'staking' | 'dual';
  productName?: string;
  lockPeriodDays?: number;
  accruedInterest: Decimal;
  startDate?: Date;
  endDate?: Date;
  redeemable: boolean;
}

// Funding rate
export interface FundingRate {
  symbol: string;
  rate: Decimal;
  timestamp: Date;
  nextFundingTime?: Date;
}

// Exchange info
export interface ExchangeInfo {
  id: string;
  name: string;
  type: 'cex' | 'dex' | 'perp';
  supportedFeatures: ExchangeFeatures;
}

export interface ExchangeFeatures {
  spot: boolean;
  futures: boolean;
  margin: boolean;
  earn: boolean;
  deposit: boolean;
  withdraw: boolean;
  websocket: boolean;
}

// WebSocket subscription types
export type SubscriptionType =
  | 'balance'
  | 'position'
  | 'order'
  | 'trade'
  | 'ticker';

export interface SubscriptionCallback<T> {
  (data: T): void;
}

// Rate limiter config
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Exchange adapter interface
export interface IExchangeAdapter {
  // Info
  readonly exchangeId: string;
  readonly exchangeInfo: ExchangeInfo;

  // Connection
  connect(credentials: ExchangeCredentials): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;

  // Spot balances
  getSpotBalances(): Promise<Balance[]>;

  // Futures
  getFuturesBalances(): Promise<Balance[]>;
  getFuturesPositions(): Promise<Position[]>;
  getFundingRates(symbols?: string[]): Promise<FundingRate[]>;

  // Earn
  getEarnPositions(): Promise<EarnPosition[]>;

  // Transaction history
  getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]>;
  getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]>;
  getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]>;

  // Real-time subscriptions
  subscribeBalanceUpdates(callback: SubscriptionCallback<Balance>): () => void;
  subscribePositionUpdates(callback: SubscriptionCallback<Position>): () => void;
}

export interface TradeHistoryParams {
  symbol?: string;
  since?: number; // timestamp
  limit?: number;
}

export interface TransferHistoryParams {
  asset?: string;
  since?: number;
  limit?: number;
}

// Exchange factory
export type ExchangeFactory = (credentials: ExchangeCredentials) => IExchangeAdapter;

// Supported exchanges enum
export enum SupportedExchange {
  BINANCE = 'binance',
  UPBIT = 'upbit',
  BITHUMB = 'bithumb',
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
  DYDX = 'dydx',
}

// Exchange status
export interface ExchangeStatus {
  exchangeId: string;
  isConnected: boolean;
  lastSync?: Date;
  error?: string;
}
