/**
 * Type declarations for pd-aio-sdk
 * PD AIO SDK - Perpetual DEX All-In-One SDK
 */

declare module 'pd-aio-sdk' {
  export type SupportedExchange =
    | 'hyperliquid'
    | 'lighter'
    | 'grvt'
    | 'paradex'
    | 'edgex'
    | 'backpack'
    | 'nado'
    | 'variational'
    | 'extended'
    | 'dydx'
    | 'jupiter'
    | 'drift'
    | 'gmx';

  export interface Balance {
    currency: string;
    free: number;
    used: number;
    total: number;
    usdValue?: number;
  }

  export interface Position {
    id?: string;
    symbol: string;
    side: 'long' | 'short';
    contracts: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    leverage: number;
    liquidationPrice?: number;
    marginMode?: 'cross' | 'isolated';
    initialMargin?: number;
    margin?: number;
    notional: number;
  }

  export interface Trade {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    cost: number;
    fee?: {
      cost: number;
      currency: string;
    };
    timestamp: number;
    orderId?: string;
  }

  export interface Transaction {
    id: string;
    currency: string;
    amount: number;
    txid?: string;
    address?: string;
    network?: string;
    status?: string;
    fee?: {
      cost: number;
    };
    timestamp: number;
  }

  export interface FundingRate {
    symbol: string;
    fundingRate: number;
    timestamp: number;
    fundingTimestamp?: number;
  }

  export interface FeatureMap {
    fetchMarkets?: boolean;
    fetchTicker?: boolean;
    fetchOrderBook?: boolean;
    fetchTrades?: boolean;
    fetchOHLCV?: boolean;
    fetchFundingRate?: boolean;
    fetchFundingRateHistory?: boolean;
    createOrder?: boolean;
    cancelOrder?: boolean;
    cancelAllOrders?: boolean;
    fetchOpenOrders?: boolean;
    fetchOrder?: boolean;
    fetchOrderHistory?: boolean;
    fetchMyTrades?: boolean;
    fetchDeposits?: boolean;
    fetchWithdrawals?: boolean;
    fetchPositions?: boolean;
    fetchBalance?: boolean;
    setLeverage?: boolean;
    setMarginMode?: boolean | 'emulated';
    watchOrderBook?: boolean;
    watchTrades?: boolean;
    watchTicker?: boolean;
    watchOHLCV?: boolean;
    watchPositions?: boolean;
    watchOrders?: boolean;
    watchBalance?: boolean;
    watchFundingRate?: boolean;
    watchMyTrades?: boolean;
  }

  export interface IExchangeAdapter {
    readonly id: string;
    readonly name: string;
    readonly has: Partial<FeatureMap>;
    readonly isReady: boolean;

    initialize(): Promise<void>;
    disconnect(): Promise<void>;
    isDisconnected(): boolean;
    clearCache(): void;

    fetchBalance(): Promise<Balance[]>;
    fetchPositions(symbols?: string[]): Promise<Position[]>;
    fetchFundingRate(symbol: string): Promise<FundingRate>;
    fetchFundingRateHistory(symbol: string, since?: number, limit?: number): Promise<FundingRate[]>;
    fetchMyTrades(symbol?: string, since?: number, limit?: number): Promise<Trade[]>;
    fetchDeposits(currency?: string, since?: number, limit?: number): Promise<Transaction[]>;
    fetchWithdrawals(currency?: string, since?: number, limit?: number): Promise<Transaction[]>;
  }

  export interface ExchangeConfig {
    apiUrl?: string;
    wsUrl?: string;
    testnet?: boolean;
    timeout?: number;
    debug?: boolean;
  }

  export interface HyperliquidConfig extends ExchangeConfig {
    privateKey?: string;
    walletAddress?: string;
    wallet?: unknown;
  }

  export interface DydxConfig extends ExchangeConfig {
    address?: string;
    mnemonic?: string;
  }

  export interface JupiterAdapterConfig extends ExchangeConfig {
    walletAddress?: string;
    privateKey?: string;
  }

  export interface DriftConfig extends ExchangeConfig {
    walletAddress?: string;
    privateKey?: string;
  }

  export interface GmxConfig extends ExchangeConfig {
    walletAddress?: string;
    privateKey?: string;
    chain?: 'arbitrum' | 'avalanche';
  }

  export interface ParadexConfig extends ExchangeConfig {
    accountAddress?: string;
    privateKey?: string;
  }

  export interface EdgeXConfig extends ExchangeConfig {
    accountAddress?: string;
    privateKey?: string;
  }

  export interface GRVTAdapterConfig extends ExchangeConfig {
    apiKey?: string;
    privateKey?: string;
  }

  export interface BackpackConfig extends ExchangeConfig {
    walletAddress?: string;
    privateKey?: string;
  }

  export interface LighterConfig extends ExchangeConfig {
    privateKey?: string;
    walletAddress?: string;
  }

  export type ExchangeConfigMap = {
    hyperliquid: HyperliquidConfig;
    lighter: LighterConfig;
    grvt: GRVTAdapterConfig;
    paradex: ParadexConfig;
    edgex: EdgeXConfig;
    backpack: BackpackConfig;
    nado: ExchangeConfig;
    variational: ExchangeConfig;
    extended: ExchangeConfig;
    dydx: DydxConfig;
    jupiter: JupiterAdapterConfig;
    drift: DriftConfig;
    gmx: GmxConfig;
  };

  export function createExchange<T extends SupportedExchange>(
    exchange: T,
    config?: ExchangeConfigMap[T]
  ): IExchangeAdapter;

  export function getSupportedExchanges(): SupportedExchange[];

  export function isExchangeSupported(exchange: string): exchange is SupportedExchange;
}
