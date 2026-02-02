/**
 * PD-AIO-SDK Adapter for Perpetual DEX
 *
 * Wraps the pd-aio-sdk to provide unified interface for 13 perp DEX protocols
 */

// PD-AIO-SDK types (inline declarations for ESM module)
type PDAIOExchange = 'hyperliquid' | 'lighter' | 'grvt' | 'paradex' | 'edgex' | 'backpack' | 'nado' | 'variational' | 'extended' | 'dydx' | 'jupiter' | 'drift' | 'gmx';

interface IPDAIOAdapter {
  readonly id: string;
  readonly name: string;
  readonly has: Partial<Record<string, boolean>>;
  readonly isReady: boolean;
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  fetchBalance(): Promise<PDAIOBalance[]>;
  fetchPositions(symbols?: string[]): Promise<PDAIOPosition[]>;
  fetchMyTrades(symbol?: string, since?: number, limit?: number): Promise<PDAIOTrade[]>;
  fetchDeposits(currency?: string, since?: number, limit?: number): Promise<PDAIOTransaction[]>;
  fetchWithdrawals(currency?: string, since?: number, limit?: number): Promise<PDAIOTransaction[]>;
  fetchFundingRate(symbol: string): Promise<PDAIOFundingRate>;
}

interface PDAIOBalance {
  currency: string;
  free: number;
  used: number;
  total: number;
  usdValue?: number;
}

interface PDAIOPosition {
  id?: string;
  symbol: string;
  side: string;
  contracts: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
  marginMode?: string;
  initialMargin?: number;
  margin?: number;
  notional: number;
}

interface PDAIOTrade {
  id: string;
  symbol: string;
  side: string;
  price: number;
  amount: number;
  cost: number;
  fee?: { cost: number; currency: string };
  timestamp: number;
  orderId?: string;
}

interface PDAIOTransaction {
  id: string;
  currency: string;
  amount: number;
  txid?: string;
  address?: string;
  network?: string;
  status?: string;
  fee?: { cost: number };
  timestamp: number;
}

interface PDAIOFundingRate {
  symbol: string;
  fundingRate: number;
  timestamp: number;
  fundingTimestamp?: number;
}

import { BaseExchangeAdapter } from './BaseAdapter';
import {
  ExchangeCredentials,
  ExchangeInfo,
  Balance,
  Position,
  Trade,
  Transfer,
  FundingRate,
  EarnPosition,
  TradeHistoryParams,
  TransferHistoryParams,
  SupportedExchange,
} from './types';
import { logger } from '../../utils/logger';

// Exchange configuration with display info
interface PerpDEXConfig {
  id: SupportedExchange;
  pdaioId: PDAIOExchange;
  name: string;
  chain: 'evm' | 'cosmos' | 'solana' | 'starknet';
  description: string;
  markets: number;
  hasSpot: boolean;
}

export const PERP_DEX_CONFIGS: Record<string, PerpDEXConfig> = {
  [SupportedExchange.HYPERLIQUID]: {
    id: SupportedExchange.HYPERLIQUID,
    pdaioId: 'hyperliquid',
    name: 'Hyperliquid',
    chain: 'evm',
    description: '228 Perp Markets',
    markets: 228,
    hasSpot: false,
  },
  [SupportedExchange.DYDX]: {
    id: SupportedExchange.DYDX,
    pdaioId: 'dydx',
    name: 'dYdX v4',
    chain: 'cosmos',
    description: '220+ Perp Markets',
    markets: 220,
    hasSpot: false,
  },
  [SupportedExchange.JUPITER]: {
    id: SupportedExchange.JUPITER,
    pdaioId: 'jupiter',
    name: 'Jupiter Perps',
    chain: 'solana',
    description: 'Solana Perps',
    markets: 3,
    hasSpot: false,
  },
  [SupportedExchange.DRIFT]: {
    id: SupportedExchange.DRIFT,
    pdaioId: 'drift',
    name: 'Drift Protocol',
    chain: 'solana',
    description: 'Solana 30+ Perps',
    markets: 30,
    hasSpot: false,
  },
  [SupportedExchange.GMX]: {
    id: SupportedExchange.GMX,
    pdaioId: 'gmx',
    name: 'GMX v2',
    chain: 'evm',
    description: 'Arbitrum Perps',
    markets: 11,
    hasSpot: false,
  },
  [SupportedExchange.PARADEX]: {
    id: SupportedExchange.PARADEX,
    pdaioId: 'paradex',
    name: 'Paradex',
    chain: 'starknet',
    description: 'StarkNet 108 Perps',
    markets: 108,
    hasSpot: false,
  },
  [SupportedExchange.GRVT]: {
    id: SupportedExchange.GRVT,
    pdaioId: 'grvt',
    name: 'GRVT',
    chain: 'evm',
    description: '80 Perp Markets',
    markets: 80,
    hasSpot: false,
  },
  [SupportedExchange.EDGEX]: {
    id: SupportedExchange.EDGEX,
    pdaioId: 'edgex',
    name: 'EdgeX',
    chain: 'starknet',
    description: '292 Perp Markets',
    markets: 292,
    hasSpot: false,
  },
  [SupportedExchange.BACKPACK]: {
    id: SupportedExchange.BACKPACK,
    pdaioId: 'backpack',
    name: 'Backpack',
    chain: 'solana',
    description: '75 Perp + 79 Spot',
    markets: 154,
    hasSpot: true,
  },
  [SupportedExchange.LIGHTER]: {
    id: SupportedExchange.LIGHTER,
    pdaioId: 'lighter',
    name: 'Lighter',
    chain: 'evm',
    description: '132 Perp Markets',
    markets: 132,
    hasSpot: false,
  },
};

// List of PD-AIO supported exchanges
export const PDAIO_SUPPORTED_EXCHANGES = Object.keys(PERP_DEX_CONFIGS);

export class PDAIOAdapter extends BaseExchangeAdapter {
  readonly exchangeId: string;
  readonly exchangeInfo: ExchangeInfo;

  private exchange: IPDAIOAdapter | null = null;
  private config: PerpDEXConfig;

  constructor(exchangeId: SupportedExchange) {
    super();

    const config = PERP_DEX_CONFIGS[exchangeId];
    if (!config) {
      throw new Error(`Exchange ${exchangeId} is not supported by PDAIOAdapter`);
    }

    this.config = config;
    this.exchangeId = exchangeId;
    this.exchangeInfo = {
      id: config.id,
      name: config.name,
      type: 'perp',
      supportedFeatures: {
        spot: config.hasSpot,
        futures: true,
        margin: false,
        earn: false,
        deposit: true,
        withdraw: true,
        websocket: true,
      },
    };
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
    this.credentials = credentials;

    try {
      // Check if we're in an Electron main process environment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isElectron = typeof window !== 'undefined' && (window as any).process?.type === 'renderer';

      if (isElectron) {
        // In Electron renderer, we need to use IPC to communicate with main process
        // For now, throw an error indicating this is not yet implemented
        throw new Error(
          `${this.config.name} connection requires Electron IPC bridge (coming soon). ` +
          'Please use the wallet address tracking feature instead.'
        );
      }

      // Dynamically import pd-aio-sdk (only works in Node.js/Electron main process)
      const { createExchange } = await import(/* @vite-ignore */ 'pd-aio-sdk');

      // Create exchange instance based on chain type
      const exchangeConfig = this.buildExchangeConfig(credentials);
      this.exchange = createExchange(this.config.pdaioId, exchangeConfig) as unknown as IPDAIOAdapter;

      // Initialize the exchange
      await this.exchange.initialize();

      // Test the connection
      const isValid = await this.testConnection();
      if (!isValid) {
        throw new Error('Failed to connect to exchange');
      }

      this.connected = true;
      logger.debug(`[PDAIOAdapter] Connected to ${this.config.name}`);
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to connect to ${this.config.name}:`, error);
      throw error;
    }
  }

  private buildExchangeConfig(credentials: ExchangeCredentials): Record<string, unknown> {
    const baseConfig: Record<string, unknown> = {
      testnet: false,
    };

    switch (this.config.chain) {
      case 'evm':
        // EVM chains use wallet/private key
        return {
          ...baseConfig,
          privateKey: credentials.apiSecret,
          walletAddress: credentials.apiKey,
        };

      case 'cosmos':
        // Cosmos (dYdX) uses mnemonic or address
        return {
          ...baseConfig,
          address: credentials.apiKey,
          mnemonic: credentials.apiSecret !== 'readonly' ? credentials.apiSecret : undefined,
        };

      case 'solana':
        // Solana uses wallet address and optional private key
        return {
          ...baseConfig,
          walletAddress: credentials.apiKey,
          privateKey: credentials.apiSecret !== 'readonly' ? credentials.apiSecret : undefined,
        };

      case 'starknet':
        // StarkNet uses account address and private key
        return {
          ...baseConfig,
          accountAddress: credentials.apiKey,
          privateKey: credentials.apiSecret,
        };

      default:
        return baseConfig;
    }
  }

  async disconnect(): Promise<void> {
    if (this.exchange) {
      await this.exchange.disconnect();
      this.exchange = null;
    }
    this.credentials = null;
    this.connected = false;
    logger.debug(`[PDAIOAdapter] Disconnected from ${this.config.name}`);
  }

  async testConnection(): Promise<boolean> {
    if (!this.exchange) return false;

    try {
      // Try to fetch balance as a connection test
      await this.exchange.fetchBalance();
      return true;
    } catch (error) {
      logger.error(`[PDAIOAdapter] ${this.config.name} connection test failed:`, error);
      return false;
    }
  }

  protected generateSignature(
    _params: Record<string, string | number>,
    _timestamp: number
  ): string {
    // PD-AIO-SDK handles signature generation internally
    return '';
  }

  protected async connectWebSocket(): Promise<void> {
    // PD-AIO-SDK handles WebSocket internally
    logger.debug(`[PDAIOAdapter] WebSocket managed by PD-AIO-SDK for ${this.config.name}`);
  }

  protected disconnectWebSocket(): void {
    // PD-AIO-SDK handles WebSocket cleanup in disconnect()
  }

  async getSpotBalances(): Promise<Balance[]> {
    if (!this.config.hasSpot || !this.exchange) {
      return [];
    }

    try {
      await this.checkRateLimit();
      const balances = await this.exchange.fetchBalance();
      return this.mapBalances(balances, 'spot');
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch spot balances:`, error);
      return [];
    }
  }

  async getFuturesBalances(): Promise<Balance[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();
      const balances = await this.exchange.fetchBalance();
      return this.mapBalances(balances, 'futures');
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch futures balances:`, error);
      return [];
    }
  }

  async getFuturesPositions(): Promise<Position[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();
      const positions = await this.exchange.fetchPositions();
      return this.mapPositions(positions);
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch positions:`, error);
      return [];
    }
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    // Perp DEX doesn't support earn products
    return [];
  }

  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();

      if (!this.exchange.has.fetchMyTrades) {
        return [];
      }

      const trades = await this.exchange.fetchMyTrades(
        params?.symbol,
        params?.since,
        params?.limit || 500
      );

      return this.mapTrades(trades);
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch trade history:`, error);
      return [];
    }
  }

  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();

      if (!this.exchange.has.fetchDeposits) {
        return [];
      }

      const deposits = await this.exchange.fetchDeposits(
        params?.asset,
        params?.since,
        params?.limit || 100
      );

      return this.mapTransfers(deposits, 'deposit');
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch deposits:`, error);
      return [];
    }
  }

  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();

      if (!this.exchange.has.fetchWithdrawals) {
        return [];
      }

      const withdrawals = await this.exchange.fetchWithdrawals(
        params?.asset,
        params?.since,
        params?.limit || 100
      );

      return this.mapTransfers(withdrawals, 'withdraw');
    } catch (error) {
      logger.error(`[PDAIOAdapter] Failed to fetch withdrawals:`, error);
      return [];
    }
  }

  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    if (!this.exchange) return [];

    try {
      await this.checkRateLimit();

      if (!this.exchange.has.fetchFundingRate) {
        return [];
      }

      const rates: FundingRate[] = [];

      if (symbols && symbols.length > 0) {
        for (const symbol of symbols) {
          try {
            const rate = await this.exchange.fetchFundingRate(symbol);
            if (rate) {
              rates.push(this.mapFundingRate(rate));
            }
          } catch {
            // Skip individual failures
          }
        }
      }

      return rates;
    } catch (error) {
      logger.warn(`[PDAIOAdapter] Failed to fetch funding rates:`, error);
      return [];
    }
  }

  // Type mapping helpers
  private mapBalances(pdaioBalances: PDAIOBalance[], type: 'spot' | 'futures'): Balance[] {
    return pdaioBalances.map(b => ({
      asset: b.currency,
      free: this.toDecimal(b.free),
      locked: this.toDecimal(b.used),
      total: this.toDecimal(b.total),
      balanceType: type,
      valueUsd: b.usdValue ? this.toDecimal(b.usdValue) : undefined,
    }));
  }

  private mapPositions(pdaioPositions: PDAIOPosition[]): Position[] {
    return pdaioPositions
      .filter(p => p.contracts !== 0)
      .map(p => ({
        id: p.id || `${p.symbol}-${p.side}`,
        symbol: p.symbol,
        side: p.side as 'long' | 'short',
        size: this.toDecimal(Math.abs(p.contracts)),
        entryPrice: this.toDecimal(p.entryPrice),
        markPrice: this.toDecimal(p.markPrice),
        unrealizedPnl: this.toDecimal(p.unrealizedPnl),
        leverage: p.leverage,
        liquidationPrice: p.liquidationPrice ? this.toDecimal(p.liquidationPrice) : undefined,
        marginType: (p.marginMode === 'isolated' ? 'isolated' : 'cross') as Position['marginType'],
        margin: this.toDecimal(p.initialMargin || p.margin || 0),
        notional: this.toDecimal(p.notional),
      }));
  }

  private mapTrades(pdaioTrades: PDAIOTrade[]): Trade[] {
    return pdaioTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as 'buy' | 'sell',
      price: this.toDecimal(t.price),
      amount: this.toDecimal(t.amount),
      cost: this.toDecimal(t.cost),
      fee: this.toDecimal(t.fee?.cost || 0),
      feeAsset: t.fee?.currency || '',
      timestamp: new Date(t.timestamp),
      orderId: t.orderId,
    }));
  }

  private mapTransfers(pdaioTransfers: PDAIOTransaction[], type: 'deposit' | 'withdraw'): Transfer[] {
    return pdaioTransfers.map(t => ({
      id: t.id,
      asset: t.currency,
      amount: this.toDecimal(t.amount),
      type,
      txHash: t.txid,
      address: t.address,
      network: t.network,
      status: this.mapTransferStatus(t.status),
      fee: t.fee ? this.toDecimal(t.fee.cost) : undefined,
      timestamp: new Date(t.timestamp),
    }));
  }

  private mapFundingRate(rate: PDAIOFundingRate): FundingRate {
    return {
      symbol: rate.symbol,
      rate: this.toDecimal(rate.fundingRate),
      timestamp: new Date(rate.timestamp),
      nextFundingTime: rate.fundingTimestamp ? new Date(rate.fundingTimestamp) : undefined,
    };
  }

  private mapTransferStatus(status?: string): Transfer['status'] {
    if (!status) return 'pending';

    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'ok' || normalizedStatus === 'success' || normalizedStatus === 'completed') {
      return 'completed';
    }
    if (normalizedStatus === 'failed' || normalizedStatus === 'rejected') {
      return 'failed';
    }
    if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
      return 'cancelled';
    }
    return 'pending';
  }
}

/**
 * Check if an exchange is supported by PDAIOAdapter
 */
export function isPDAIOSupported(exchangeId: string): boolean {
  return exchangeId in PERP_DEX_CONFIGS;
}

/**
 * Get perp DEX configuration
 */
export function getPerpDEXConfig(exchangeId: string): PerpDEXConfig | undefined {
  return PERP_DEX_CONFIGS[exchangeId];
}

/**
 * Get all supported perp DEX exchanges from PD-AIO-SDK
 */
export function getPDAIOExchanges(): PDAIOExchange[] {
  return ['hyperliquid', 'lighter', 'grvt', 'paradex', 'edgex', 'backpack', 'nado', 'variational', 'extended', 'dydx', 'jupiter', 'drift', 'gmx'];
}
