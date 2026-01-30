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

// dYdX v4 API response types
interface DydxSubaccount {
  address: string;
  subaccountNumber: number;
  equity: string;
  freeCollateral: string;
  openPerpetualPositions: {
    [market: string]: DydxPerpetualPosition;
  };
  assetPositions: {
    [asset: string]: DydxAssetPosition;
  };
  marginEnabled: boolean;
}

interface DydxPerpetualPosition {
  market: string;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  side: 'LONG' | 'SHORT';
  size: string;
  maxSize: string;
  entryPrice: string;
  exitPrice: string | null;
  realizedPnl: string;
  unrealizedPnl: string;
  createdAt: string;
  createdAtHeight: string;
  closedAt: string | null;
  sumOpen: string;
  sumClose: string;
  netFunding: string;
}

interface DydxAssetPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  assetId: string;
}

interface DydxFill {
  id: string;
  side: 'BUY' | 'SELL';
  liquidity: 'TAKER' | 'MAKER';
  type: 'LIMIT' | 'MARKET' | 'LIQUIDATED' | 'DELEVERAGED';
  market: string;
  marketType: 'PERPETUAL';
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  createdAtHeight: string;
  orderId: string | null;
  clientMetadata: string | null;
}

interface DydxTransfer {
  id: string;
  sender: {
    address: string;
    subaccountNumber: number;
  };
  recipient: {
    address: string;
    subaccountNumber: number;
  };
  size: string;
  createdAt: string;
  createdAtHeight: string;
  symbol: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  transactionHash: string;
}

interface DydxMarket {
  ticker: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  initialMarginFraction: string;
  maintenanceMarginFraction: string;
  openInterest: string;
  atomicResolution: number;
  quantumConversionExponent: number;
  tickSize: string;
  stepSize: string;
  stepBaseQuantums: number;
  subticksPerTick: number;
  marketType: 'PERPETUAL';
  openInterestLowerCap: string;
  openInterestUpperCap: string;
  baseOpenInterest: string;
  priceChange24H: string;
  volume24H: string;
  trades24H: number;
  nextFundingRate: string;
  oraclePrice: string;
}

interface DydxMarketsResponse {
  markets: {
    [ticker: string]: DydxMarket;
  };
}

/**
 * dYdX v4 DEX Adapter
 *
 * dYdX v4 runs on its own Cosmos-based chain. For read-only portfolio tracking,
 * we use the indexer API which only requires the wallet address.
 * The address is stored in apiKey field (dydx1... format).
 */
export class DydxAdapter extends BaseExchangeAdapter {
  readonly exchangeId = SupportedExchange.DYDX;
  readonly exchangeInfo: ExchangeInfo = {
    id: SupportedExchange.DYDX,
    name: 'dYdX',
    type: 'perp',
    supportedFeatures: {
      spot: false,
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
  private subaccountNumber: number = 0;
  private ws: WebSocket | null = null;
  private wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private markets: Map<string, DydxMarket> = new Map();

  // dYdX v4 indexer API
  private readonly INDEXER_URL = 'https://indexer.dydx.trade/v4';
  private readonly WS_URL = 'wss://indexer.dydx.trade/v4/ws';

  constructor() {
    super();
    this.rateLimitConfig = { maxRequests: 100, windowMs: 10000 }; // dYdX has stricter limits

    this.client = axios.create({
      baseURL: this.INDEXER_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connect using dYdX address.
   * For dYdX v4, apiKey = wallet address (dydx1... format).
   */
  async connect(credentials: ExchangeCredentials): Promise<void> {
    const address = credentials.apiKey.toLowerCase();

    // Validate dYdX address format
    if (!address.startsWith('dydx1') || address.length !== 43) {
      throw new Error('Invalid dYdX address. Must be a valid dydx1... address.');
    }

    this.walletAddress = address;
    this.credentials = credentials;

    // Parse subaccount number from apiSecret if provided (default 0)
    if (credentials.apiSecret) {
      const subNum = parseInt(credentials.apiSecret, 10);
      if (!isNaN(subNum) && subNum >= 0) {
        this.subaccountNumber = subNum;
      }
    }

    // Test the connection
    const isValid = await this.testConnection();
    if (!isValid) {
      this.walletAddress = null;
      this.credentials = null;
      throw new Error('Failed to fetch account data. Check wallet address.');
    }

    // Load markets data
    await this.loadMarkets();

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
      await this.getSubaccount();
      return true;
    } catch (error) {
      console.error('dYdX connection test failed:', error);
      return false;
    }
  }

  protected generateSignature(): string {
    // Not needed for indexer API (read-only)
    return '';
  }

  private async loadMarkets(): Promise<void> {
    try {
      const response = await this.client.get<DydxMarketsResponse>('/perpetualMarkets');
      Object.entries(response.data.markets).forEach(([ticker, market]) => {
        this.markets.set(ticker, market);
      });
    } catch (error) {
      console.error('Failed to load dYdX markets:', error);
    }
  }

  private async getSubaccount(): Promise<DydxSubaccount> {
    const response = await this.client.get<{ subaccount: DydxSubaccount }>(
      `/addresses/${this.walletAddress}/subaccountNumber/${this.subaccountNumber}`
    );
    return response.data.subaccount;
  }

  /**
   * dYdX doesn't have spot trading
   */
  async getSpotBalances(): Promise<Balance[]> {
    return [];
  }

  /**
   * Get futures balance (USDC collateral)
   */
  async getFuturesBalances(): Promise<Balance[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const subaccount = await this.getSubaccount();
    const balances: Balance[] = [];

    // Main equity as USDC balance
    const equity = this.toDecimal(subaccount.equity);
    const freeCollateral = this.toDecimal(subaccount.freeCollateral);
    const marginUsed = equity.minus(freeCollateral);

    if (equity.greaterThan(0)) {
      balances.push({
        asset: 'USDC',
        free: freeCollateral,
        locked: marginUsed,
        total: equity,
        balanceType: 'futures',
        valueUsd: equity,
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

    const subaccount = await this.getSubaccount();
    const positions: Position[] = [];

    for (const [market, pos] of Object.entries(subaccount.openPerpetualPositions)) {
      if (pos.status !== 'OPEN') continue;

      const size = this.toDecimal(pos.size);
      if (size.equals(0)) continue;

      const marketData = this.markets.get(market);
      const markPrice = marketData
        ? this.toDecimal(marketData.oraclePrice)
        : this.toDecimal(pos.entryPrice);

      const isLong = pos.side === 'LONG';

      positions.push({
        id: `${market}-${this.walletAddress}-${this.subaccountNumber}`,
        symbol: market,
        side: isLong ? 'long' : 'short',
        size: size.abs(),
        entryPrice: this.toDecimal(pos.entryPrice),
        markPrice,
        unrealizedPnl: this.toDecimal(pos.unrealizedPnl),
        leverage: 1, // dYdX v4 uses cross-margin, effective leverage varies
        liquidationPrice: undefined, // Would need separate calculation
        marginType: 'cross',
        margin: new Decimal(0), // Cross-margin, shared across positions
        notional: size.abs().times(markPrice),
      });
    }

    return positions;
  }

  /**
   * dYdX doesn't have earn products
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

    const queryParams: Record<string, string | number> = {
      limit: params?.limit || 100,
    };

    if (params?.symbol) {
      queryParams.market = params.symbol;
    }

    const response = await this.client.get<{ fills: DydxFill[] }>(
      `/fills?address=${this.walletAddress}&subaccountNumber=${this.subaccountNumber}`,
      { params: queryParams }
    );

    let fills = response.data.fills;

    // Filter by timestamp if provided
    if (params?.since) {
      const sinceDate = new Date(params.since);
      fills = fills.filter((f) => new Date(f.createdAt) >= sinceDate);
    }

    return fills.map((f) => ({
      id: f.id,
      symbol: f.market,
      side: f.side.toLowerCase() as 'buy' | 'sell',
      price: this.toDecimal(f.price),
      amount: this.toDecimal(f.size),
      cost: this.toDecimal(f.price).times(this.toDecimal(f.size)),
      fee: this.toDecimal(f.fee),
      feeAsset: 'USDC',
      timestamp: new Date(f.createdAt),
      orderId: f.orderId || undefined,
    }));
  }

  /**
   * Get deposit history
   */
  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const response = await this.client.get<{ transfers: DydxTransfer[] }>(
      `/transfers?address=${this.walletAddress}&subaccountNumber=${this.subaccountNumber}`,
      {
        params: {
          limit: params?.limit || 100,
        },
      }
    );

    return response.data.transfers
      .filter((t) => t.type === 'DEPOSIT' || t.type === 'TRANSFER_IN')
      .map((t) => ({
        id: t.id,
        asset: t.symbol || 'USDC',
        amount: this.toDecimal(t.size),
        type: 'deposit' as const,
        txHash: t.transactionHash,
        address: t.sender.address,
        status: 'completed' as const,
        timestamp: new Date(t.createdAt),
      }));
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    if (!this.walletAddress) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const response = await this.client.get<{ transfers: DydxTransfer[] }>(
      `/transfers?address=${this.walletAddress}&subaccountNumber=${this.subaccountNumber}`,
      {
        params: {
          limit: params?.limit || 100,
        },
      }
    );

    return response.data.transfers
      .filter((t) => t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT')
      .map((t) => ({
        id: t.id,
        asset: t.symbol || 'USDC',
        amount: this.toDecimal(t.size),
        type: 'withdraw' as const,
        txHash: t.transactionHash,
        address: t.recipient.address,
        status: 'completed' as const,
        timestamp: new Date(t.createdAt),
      }));
  }

  /**
   * Get funding rates for all markets
   */
  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    await this.checkRateLimit();

    // Refresh markets to get latest funding rates
    await this.loadMarkets();

    const rates: FundingRate[] = [];

    this.markets.forEach((market, ticker) => {
      // Filter by symbols if provided
      if (symbols && !symbols.includes(ticker)) {
        return;
      }

      if (market.nextFundingRate) {
        rates.push({
          symbol: ticker,
          rate: this.toDecimal(market.nextFundingRate),
          timestamp: new Date(),
        });
      }
    });

    return rates;
  }

  // WebSocket implementation
  protected async connectWebSocket(): Promise<void> {
    if (!this.walletAddress) return;

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('dYdX WebSocket connected');

        // Subscribe to subaccount updates
        if (this.ws && this.walletAddress) {
          this.ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: 'v4_subaccounts',
              id: `${this.walletAddress}/${this.subaccountNumber}`,
            })
          );

          // Subscribe to markets for price updates
          this.ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: 'v4_markets',
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
        console.error('dYdX WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('dYdX WebSocket disconnected');
        this.ws = null;

        // Attempt to reconnect after 5 seconds
        if (this.connected) {
          this.wsReconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Failed to connect dYdX WebSocket:', error);
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
      case 'v4_subaccounts':
        this.handleSubaccountUpdate(data);
        break;

      case 'v4_markets':
        this.handleMarketsUpdate(data);
        break;
    }
  }

  private handleSubaccountUpdate(data: any): void {
    if (data.type === 'subscribed' || data.type === 'channel_data') {
      // Refresh positions and balances
      this.getFuturesPositions()
        .then((positions) => {
          positions.forEach((position) => {
            this.notifyPositionUpdate(position);
          });
        })
        .catch((error) => {
          console.error('Failed to refresh positions:', error);
        });

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

  private handleMarketsUpdate(data: any): void {
    if (data.contents && data.contents.markets) {
      // Update cached market data
      Object.entries(data.contents.markets).forEach(([ticker, marketData]: [string, any]) => {
        const existing = this.markets.get(ticker);
        if (existing && marketData.oraclePrice) {
          existing.oraclePrice = marketData.oraclePrice;
        }
      });
    }
  }
}
