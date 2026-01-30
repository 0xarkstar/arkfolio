import Decimal from 'decimal.js';

// Exchange types
export type ExchangeType = 'cex' | 'dex' | 'perp';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // For OKX and similar
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
  valueKrw?: Decimal;
}

// Position types
export type PositionSide = 'long' | 'short';
export type MarginType = 'cross' | 'isolated';

export interface Position {
  symbol: string;
  side: PositionSide;
  size: Decimal;
  entryPrice: Decimal;
  markPrice: Decimal;
  unrealizedPnl: Decimal;
  leverage: number;
  liquidationPrice?: Decimal;
  marginType: MarginType;
}

// Transaction types
export type TransactionType =
  | 'buy'
  | 'sell'
  | 'transfer_in'
  | 'transfer_out'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'reward'
  | 'airdrop'
  | 'fee';

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: Decimal;
  amount: Decimal;
  fee: Decimal;
  feeAsset: string;
  timestamp: Date;
}

export interface Transfer {
  id: string;
  asset: string;
  amount: Decimal;
  type: 'deposit' | 'withdraw';
  txHash?: string;
  address?: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
}

// Wallet types
export type ChainType =
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  | 'bsc'
  | 'solana';

export interface WalletInfo {
  address: string;
  chain: ChainType;
  label?: string;
}

// DeFi types
export type DefiPositionType =
  | 'lp'
  | 'lending'
  | 'borrowing'
  | 'staking'
  | 'vault'
  | 'pt'
  | 'yt';

export interface DefiPositionInfo {
  protocol: string;
  positionType: DefiPositionType;
  poolAddress: string;
  assets: string[];
  amounts: Decimal[];
  costBasisUsd: Decimal;
  currentValueUsd: Decimal;
  apy?: number;
  healthFactor?: number;
  maturityDate?: Date;
}

// Earn position
export interface EarnPosition {
  asset: string;
  amount: Decimal;
  apy: number;
  productType: 'flexible' | 'locked' | 'staking';
  lockPeriodDays?: number;
  accruedInterest: Decimal;
}

// Price types
export interface PriceData {
  asset: string;
  priceUsd: Decimal;
  priceKrw: Decimal;
  timestamp: Date;
}

// Tax types
export interface TaxSummary {
  year: number;
  totalGainsKrw: Decimal;
  totalLossesKrw: Decimal;
  netGainsKrw: Decimal;
  deductionKrw: Decimal;
  taxableGainsKrw: Decimal;
  estimatedTaxKrw: Decimal;
}

// Points/Airdrop types
export interface PointsBalance {
  protocol: string;
  walletAddress: string;
  balance: Decimal;
  estimatedValueUsd?: Decimal;
  lastSync: Date;
}

// Exchange adapter interface
export interface ExchangeAdapter {
  // Connection
  connect(credentials: EncryptedCredentials): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Balance
  getSpotBalances(): Promise<Balance[]>;
  getFuturesBalances(): Promise<Balance[]>;
  getEarnPositions(): Promise<EarnPosition[]>;

  // Positions
  getFuturesPositions(): Promise<Position[]>;

  // Transactions
  getTradeHistory(since?: number): Promise<Trade[]>;
  getDepositHistory(since?: number): Promise<Transfer[]>;
  getWithdrawHistory(since?: number): Promise<Transfer[]>;

  // Real-time subscriptions
  subscribeBalanceUpdates(callback: (balance: Balance) => void): () => void;
  subscribePositionUpdates(callback: (position: Position) => void): () => void;
}
