import axios, { AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { BaseExchangeAdapter } from '../BaseAdapter';
import {
  ExchangeCredentials,
  ExchangeInfo,
  Balance,
  Position,
  EarnPosition,
  Trade,
  Transfer,
  FundingRate,
  TradeHistoryParams,
  TransferHistoryParams,
  SupportedExchange,
} from '../types';

// Hyperliquid API response types
interface HyperliquidAssetPosition {
  position: {
    coin: string;
    szi: string; // size (positive = long, negative = short)
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    leverage: {
      type: 'cross' | 'isolated';
      value: number;
    };
    marginUsed: string;
  };
  type: 'oneWay';
}

interface HyperliquidClearinghouseState {
  assetPositions: HyperliquidAssetPosition[];
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
    withdrawable: string;
  };
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
}

interface HyperliquidUserFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A'; // B = buy, A = sell (ask)
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
}

interface HyperliquidFundingHistory {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

interface HyperliquidMeta {
  universe: Array<{
    name: string;
    szDecimals: number;
  }>;
}

interface HyperliquidAllMids {
  [coin: string]: string;
}

/**
 * Hyperliquid DEX Adapter
 *
 * Hyperliquid is a perpetual futures DEX. For read-only portfolio tracking,
 * we only need the wallet address (stored in apiKey field).
 * No private key/apiSecret is needed for viewing positions.
 */
export class HyperliquidAdapter extends BaseExchangeAdapter {
  readonly exchangeId = SupportedExchange.HYPERLIQUID;
  readonly exchangeInfo: ExchangeInfo = {
    id: SupportedExchange.HYPERLIQUID,
    name: 'Hyperliquid',
    type: 'perp',
    supportedFeatures: {
      spot: false, // Hyperliquid is perp-only (spot launching later)
      futures: true,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
  };

  private client: AxiosInstance;
  private walletAddress: string | null = null;
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private coinMeta: Map<string, number> = new Map(); // coin -> szDecimals

  private readonly BASE_URL = 'https://api.hyperliquid.xyz';
  private readonly WS_URL = 'wss://api.hyperliquid.xyz/ws';

  constructor() {
    super();
    this.rateLimitConfig = { maxRequests: 1200, windowMs: 60000 };

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connect using wallet address.
   * For Hyperliquid, apiKey = wallet address, apiSecret is optional (only for trading).
   */
  async connect(credentials: ExchangeCredentials): Promise<void> {
    // Validate wallet address format
    const address = credentials.apiKey.toLowerCase();
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error('Invalid wallet address. Must be a valid Ethereum address.');
    }

    this.walletAddress = address;
    this.credentials = credentials;

    // Test the connection by fetching user state
    const isValid = await this.testConnection();
    if (!isValid) {
      this.walletAddress = null;
      this.credentials = null;
      throw new Error('Failed to fetch account data. Check wallet address.');
    }

    // Load coin metadata
    await this.loadCoinMeta();

    this.connected = true;

    // Connect WebSocket for real-time updates
    await this.connectWebSocket();
  }

  async disconnect(): Promise<void> {
    this.disconnectWebSocket();
    this.walletAddress = null;
    this.credentials = null;
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    if (!this.walletAddress) return false;

    try {
      await this.getUserState();
      return true;
    } catch (error) {
      console.error('Hyperliquid connection test failed:', error);
      return false;
    }
  }

  protected generateSignature(): string {
    // Not needed for read-only operations
    return '';
  }

  private async loadCoinMeta(): Promise<void> {
    try {
      const response = await this.client.post<HyperliquidMeta>('/info', {
        type: 'meta',
      });

      response.data.universe.forEach((coin) => {
        this.coinMeta.set(coin.name, coin.szDecimals);
      });
    } catch (error) {
      console.error('Failed to load coin meta:', error);
    }
  }

  private async getUserState(): Promise<HyperliquidClearinghouseState> {
    const response = await this.client.post<HyperliquidClearinghouseState>('/info', {
      type: 'clearinghouseState',
      user: this.walletAddress,
    });
    return response.data;
  }

  /**
   * Hyperliquid doesn't have traditional spot balances.
   * Returns empty array since it's a perp DEX.
   */
  async getSpotBalances(): Promise<Balance[]> {
    return [];
  }

  /**
   * Get futures balance (account value in USD)
   */
  async getFuturesBalances(): Promise<Balance[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const state = await this.getUserState();
    const balances: Balance[] = [];

    // Account value as USDC balance
    const accountValue = this.toDecimal(state.crossMarginSummary.accountValue);
    const withdrawable = this.toDecimal(state.crossMarginSummary.withdrawable);
    const marginUsed = this.toDecimal(state.crossMarginSummary.totalMarginUsed);

    if (accountValue.greaterThan(0)) {
      balances.push({
        asset: 'USDC',
        free: withdrawable,
        locked: marginUsed,
        total: accountValue,
        balanceType: 'futures',
        valueUsd: accountValue,
      });
    }

    return balances;
  }

  /**
   * Get all open perpetual positions
   */
  async getFuturesPositions(): Promise<Position[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const state = await this.getUserState();

    // Fetch current mark prices
    const mids = await this.getAllMids();

    return state.assetPositions
      .filter((ap) => parseFloat(ap.position.szi) !== 0)
      .map((ap) => {
        const size = this.toDecimal(ap.position.szi);
        const isLong = size.greaterThan(0);
        const markPrice = this.toDecimal(mids[ap.position.coin] || ap.position.entryPx);

        return {
          id: `${ap.position.coin}-${this.walletAddress}`,
          symbol: `${ap.position.coin}-USD`,
          side: isLong ? 'long' : 'short',
          size: size.abs(),
          entryPrice: this.toDecimal(ap.position.entryPx),
          markPrice,
          unrealizedPnl: this.toDecimal(ap.position.unrealizedPnl),
          leverage: ap.position.leverage.value,
          liquidationPrice: ap.position.liquidationPx
            ? this.toDecimal(ap.position.liquidationPx)
            : undefined,
          marginType: ap.position.leverage.type,
          margin: this.toDecimal(ap.position.marginUsed),
          notional: this.toDecimal(ap.position.positionValue).abs(),
        } as Position;
      });
  }

  /**
   * Hyperliquid doesn't have earn products
   */
  async getEarnPositions(): Promise<EarnPosition[]> {
    return [];
  }

  /**
   * Get trade (fill) history
   */
  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const response = await this.client.post<HyperliquidUserFill[]>('/info', {
      type: 'userFills',
      user: this.walletAddress,
    });

    let fills = response.data;

    // Filter by symbol if provided
    if (params?.symbol) {
      const coin = params.symbol.replace('-USD', '').replace('-PERP', '');
      fills = fills.filter((f) => f.coin === coin);
    }

    // Filter by timestamp if provided
    if (params?.since) {
      fills = fills.filter((f) => f.time >= params.since!);
    }

    // Limit results
    const limit = params?.limit || 500;
    fills = fills.slice(0, limit);

    return fills.map((f) => ({
      id: String(f.tid),
      symbol: `${f.coin}-USD`,
      side: f.side === 'B' ? 'buy' : 'sell',
      price: this.toDecimal(f.px),
      amount: this.toDecimal(f.sz).abs(),
      cost: this.toDecimal(f.px).times(this.toDecimal(f.sz).abs()),
      fee: this.toDecimal(f.fee).abs(),
      feeAsset: 'USDC',
      timestamp: new Date(f.time),
      orderId: String(f.oid),
    }));
  }

  /**
   * Hyperliquid deposits/withdraws are handled on-chain
   * This returns an empty array - use on-chain tracking instead
   */
  async getDepositHistory(_params?: TransferHistoryParams): Promise<Transfer[]> {
    // Deposits are on-chain bridging transactions
    // Would need to track via on-chain indexing
    return [];
  }

  async getWithdrawHistory(_params?: TransferHistoryParams): Promise<Transfer[]> {
    // Withdrawals are on-chain bridging transactions
    return [];
  }

  /**
   * Get funding rates for positions
   */
  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    await this.checkRateLimit();

    // Get all mids which includes funding data
    const response = await this.client.post<any>('/info', {
      type: 'metaAndAssetCtxs',
    });

    const [meta, assetCtxs] = response.data;
    const rates: FundingRate[] = [];

    assetCtxs.forEach((ctx: any, index: number) => {
      const coin = meta.universe[index]?.name;
      if (!coin) return;

      // Filter by symbols if provided
      if (symbols && !symbols.some((s) => s.includes(coin))) {
        return;
      }

      if (ctx.funding) {
        rates.push({
          symbol: `${coin}-USD`,
          rate: this.toDecimal(ctx.funding),
          timestamp: new Date(),
        });
      }
    });

    return rates;
  }

  /**
   * Get all mid prices
   */
  private async getAllMids(): Promise<HyperliquidAllMids> {
    const response = await this.client.post<HyperliquidAllMids>('/info', {
      type: 'allMids',
    });
    return response.data;
  }

  // WebSocket implementation
  protected async connectWebSocket(): Promise<void> {
    if (!this.walletAddress) return;

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('Hyperliquid WebSocket connected');

        // Subscribe to user events
        if (this.ws && this.walletAddress) {
          this.ws.send(
            JSON.stringify({
              method: 'subscribe',
              subscription: {
                type: 'userEvents',
                user: this.walletAddress,
              },
            })
          );

          // Subscribe to all mids for price updates
          this.ws.send(
            JSON.stringify({
              method: 'subscribe',
              subscription: {
                type: 'allMids',
              },
            })
          );
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Hyperliquid WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Hyperliquid WebSocket disconnected');
        this.ws = null;

        // Attempt to reconnect after 5 seconds
        if (this.connected) {
          this.wsReconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Failed to connect Hyperliquid WebSocket:', error);
    }
  }

  protected disconnectWebSocket(): void {
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleWebSocketMessage(data: any): void {
    if (!data.channel) return;

    switch (data.channel) {
      case 'userEvents':
        this.handleUserEvents(data.data);
        break;

      case 'allMids':
        // Price updates - could be used to update position mark prices
        break;
    }
  }

  private handleUserEvents(events: any): void {
    if (!events || !Array.isArray(events)) return;

    events.forEach((event: any) => {
      if (event.fills) {
        // Trade fills - we could notify about new trades
      }

      if (event.liquidation) {
        // Liquidation event
        console.warn('Position liquidated:', event.liquidation);
      }

      if (event.funding) {
        // Funding payment received
      }
    });

    // Refresh positions after any user event
    this.getFuturesPositions()
      .then((positions) => {
        positions.forEach((position) => {
          this.notifyPositionUpdate(position);
        });
      })
      .catch((error) => {
        console.error('Failed to refresh positions:', error);
      });

    // Refresh balances
    this.getFuturesBalances()
      .then((balances) => {
        balances.forEach((balance) => {
          this.notifyBalanceUpdate(balance);
        });
      })
      .catch((error) => {
        console.error('Failed to refresh balances:', error);
      });
  }
}
