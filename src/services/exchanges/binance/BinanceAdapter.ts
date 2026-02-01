import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';
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
import { logger } from '../../../utils/logger';
import { HttpError, HttpErrorType } from '../../utils/httpUtils';

// Binance API response types
interface BinanceSpotBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceFuturesBalance {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  availableBalance: string;
}

interface BinanceFuturesPosition {
  symbol: string;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: 'cross' | 'isolated';
  isolatedMargin: string;
  notional: string;
}

interface BinanceTrade {
  id: number;
  symbol: string;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

interface BinanceDeposit {
  id: string;
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  txId: string;
  insertTime: number;
}

interface BinanceWithdraw {
  id: string;
  amount: string;
  transactionFee: string;
  coin: string;
  status: number;
  address: string;
  txId: string;
  applyTime: string;
  network: string;
}

interface BinanceEarnPosition {
  productId: string;
  asset: string;
  amount: string;
  purchaseTime: number;
  duration: number;
  accrualDays: number;
  rewardAsset: string;
  apy: string;
  deliveryDate: number;
  redeemingAmt: string;
  rewardAmt: string;
  canRedeemEarly: boolean;
  type: string;
}

interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

export class BinanceAdapter extends BaseExchangeAdapter {
  readonly exchangeId = SupportedExchange.BINANCE;
  readonly exchangeInfo: ExchangeInfo = {
    id: SupportedExchange.BINANCE,
    name: 'Binance',
    type: 'cex',
    supportedFeatures: {
      spot: true,
      futures: true,
      margin: true,
      earn: true,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
  };

  private spotClient: AxiosInstance;
  private futuresClient: AxiosInstance;
  private ws: WebSocket | null = null;
  private wsListenKey: string | null = null;
  private wsKeepAliveInterval: ReturnType<typeof setInterval> | null = null;

  private readonly SPOT_BASE_URL = 'https://api.binance.com';
  private readonly FUTURES_BASE_URL = 'https://fapi.binance.com';

  constructor() {
    super();
    this.rateLimitConfig = { maxRequests: 1200, windowMs: 60000 };

    this.spotClient = axios.create({
      baseURL: this.SPOT_BASE_URL,
      timeout: 30000,
    });

    this.futuresClient = axios.create({
      baseURL: this.FUTURES_BASE_URL,
      timeout: 30000,
    });
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
    this.credentials = credentials;

    // Test the connection
    const isValid = await this.testConnection();
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    this.connected = true;

    // Connect WebSocket for real-time updates
    await this.connectWebSocket();
  }

  async disconnect(): Promise<void> {
    this.disconnectWebSocket();
    this.credentials = null;
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.signedRequest('GET', '/api/v3/account', {}, this.spotClient);
      return true;
    } catch (error) {
      const httpError = HttpError.fromError(error, HttpErrorType.AUTH);
      logger.error('Binance connection test failed:', httpError.getUserFriendlyMessage());
      return false;
    }
  }

  protected generateSignature(
    params: Record<string, string | number>,
    timestamp: number
  ): string {
    if (!this.credentials) {
      throw new Error('Not connected');
    }

    const queryString = this.buildQueryString({ ...params, timestamp });
    return CryptoJS.HmacSHA256(queryString, this.credentials.apiSecret).toString();
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    client: AxiosInstance = this.spotClient
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const timestamp = Date.now();
    const cleanParams: Record<string, string | number> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanParams[key] = value;
      }
    });

    const signature = this.generateSignature(cleanParams, timestamp);
    const queryString = this.buildQueryString({ ...cleanParams, timestamp, signature });

    const response = await client.request<T>({
      method,
      url: `${endpoint}?${queryString}`,
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });

    return response.data;
  }

  async getSpotBalances(): Promise<Balance[]> {
    interface AccountResponse {
      balances: BinanceSpotBalance[];
    }

    const account = await this.signedRequest<AccountResponse>('GET', '/api/v3/account');

    return account.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: this.toDecimal(b.free),
        locked: this.toDecimal(b.locked),
        total: this.toDecimal(b.free).plus(this.toDecimal(b.locked)),
        balanceType: 'spot' as const,
      }));
  }

  async getFuturesBalances(): Promise<Balance[]> {
    const balances = await this.signedRequest<BinanceFuturesBalance[]>(
      'GET',
      '/fapi/v2/balance',
      {},
      this.futuresClient
    );

    return balances
      .filter(b => parseFloat(b.walletBalance) > 0)
      .map(b => ({
        asset: b.asset,
        free: this.toDecimal(b.availableBalance),
        locked: this.toDecimal(b.walletBalance).minus(this.toDecimal(b.availableBalance)),
        total: this.toDecimal(b.walletBalance),
        balanceType: 'futures' as const,
      }));
  }

  async getFuturesPositions(): Promise<Position[]> {
    interface PositionResponse {
      positions: BinanceFuturesPosition[];
    }

    const account = await this.signedRequest<PositionResponse>(
      'GET',
      '/fapi/v2/account',
      {},
      this.futuresClient
    );

    return account.positions
      .filter(p => parseFloat(p.positionAmt) !== 0)
      .map(p => {
        const positionAmt = this.toDecimal(p.positionAmt);
        const isLong = positionAmt.greaterThan(0);

        return {
          id: `${p.symbol}-${p.positionSide}`,
          symbol: p.symbol,
          side: isLong ? 'long' : 'short',
          size: positionAmt.abs(),
          entryPrice: this.toDecimal(p.entryPrice),
          markPrice: this.toDecimal(p.markPrice),
          unrealizedPnl: this.toDecimal(p.unRealizedProfit),
          leverage: parseInt(p.leverage, 10),
          liquidationPrice: this.toDecimal(p.liquidationPrice),
          marginType: p.marginType,
          margin: this.toDecimal(p.isolatedMargin),
          notional: this.toDecimal(p.notional).abs(),
        } as Position;
      });
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    const positions: EarnPosition[] = [];

    // Flexible savings
    try {
      interface FlexibleResponse {
        rows: Array<{
          productId: string;
          asset: string;
          totalAmount: string;
          latestAnnualPercentageRate: string;
          canRedeem: boolean;
        }>;
      }

      const flexible = await this.signedRequest<FlexibleResponse>(
        'GET',
        '/sapi/v1/simple-earn/flexible/position',
        { size: 100 }
      );

      positions.push(
        ...flexible.rows.map(p => ({
          id: p.productId,
          asset: p.asset,
          amount: this.toDecimal(p.totalAmount),
          apy: parseFloat(p.latestAnnualPercentageRate) * 100,
          productType: 'flexible' as const,
          productName: `${p.asset} Flexible`,
          accruedInterest: new Decimal(0),
          redeemable: p.canRedeem,
        }))
      );
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn('Failed to fetch flexible earn positions:', httpError.getUserFriendlyMessage());
    }

    // Locked savings
    try {
      interface LockedResponse {
        rows: BinanceEarnPosition[];
      }

      const locked = await this.signedRequest<LockedResponse>(
        'GET',
        '/sapi/v1/simple-earn/locked/position',
        { size: 100 }
      );

      positions.push(
        ...locked.rows.map(p => ({
          id: p.productId,
          asset: p.asset,
          amount: this.toDecimal(p.amount),
          apy: parseFloat(p.apy) * 100,
          productType: 'locked' as const,
          productName: p.type,
          lockPeriodDays: p.duration,
          accruedInterest: this.toDecimal(p.rewardAmt),
          startDate: this.parseTimestamp(p.purchaseTime),
          endDate: this.parseTimestamp(p.deliveryDate),
          redeemable: p.canRedeemEarly,
        }))
      );
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn('Failed to fetch locked earn positions:', httpError.getUserFriendlyMessage());
    }

    return positions;
  }

  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    const trades = await this.signedRequest<BinanceTrade[]>('GET', '/api/v3/myTrades', {
      symbol: params?.symbol,
      startTime: params?.since,
      limit: params?.limit || 500,
    });

    return trades.map(t => ({
      id: String(t.id),
      symbol: t.symbol,
      side: t.isBuyer ? 'buy' : 'sell',
      price: this.toDecimal(t.price),
      amount: this.toDecimal(t.qty),
      cost: this.toDecimal(t.quoteQty),
      fee: this.toDecimal(t.commission),
      feeAsset: t.commissionAsset,
      timestamp: this.parseTimestamp(t.time),
      orderId: String(t.orderId),
    }));
  }

  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const deposits = await this.signedRequest<BinanceDeposit[]>('GET', '/sapi/v1/capital/deposit/hisrec', {
      coin: params?.asset,
      startTime: params?.since,
      limit: params?.limit || 1000,
    });

    return deposits.map(d => ({
      id: d.id,
      asset: d.coin,
      amount: this.toDecimal(d.amount),
      type: 'deposit' as const,
      txHash: d.txId,
      address: d.address,
      network: d.network,
      status: this.mapDepositStatus(d.status),
      timestamp: this.parseTimestamp(d.insertTime),
    }));
  }

  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const withdrawals = await this.signedRequest<BinanceWithdraw[]>('GET', '/sapi/v1/capital/withdraw/history', {
      coin: params?.asset,
      startTime: params?.since,
      limit: params?.limit || 1000,
    });

    return withdrawals.map(w => ({
      id: w.id,
      asset: w.coin,
      amount: this.toDecimal(w.amount),
      type: 'withdraw' as const,
      txHash: w.txId,
      address: w.address,
      network: w.network,
      status: this.mapWithdrawStatus(w.status),
      fee: this.toDecimal(w.transactionFee),
      timestamp: new Date(w.applyTime),
    }));
  }

  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    const rates = await this.futuresClient.get<BinanceFundingRate[]>('/fapi/v1/fundingRate', {
      params: {
        symbol: symbols?.[0],
        limit: 100,
      },
    });

    return rates.data.map(r => ({
      symbol: r.symbol,
      rate: this.toDecimal(r.fundingRate),
      timestamp: this.parseTimestamp(r.fundingTime),
    }));
  }

  // WebSocket implementation
  protected async connectWebSocket(): Promise<void> {
    if (!this.credentials) return;

    try {
      // Get listen key for user data stream
      const response = await this.spotClient.post<{ listenKey: string }>(
        '/api/v3/userDataStream',
        null,
        {
          headers: { 'X-MBX-APIKEY': this.credentials.apiKey },
        }
      );

      this.wsListenKey = response.data.listenKey;

      // Connect WebSocket
      this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${this.wsListenKey}`);

      this.ws.onopen = () => {
        logger.debug('Binance WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          this.handleWebSocketMessage(JSON.parse(event.data));
        } catch (e) {
          logger.warn('Invalid WebSocket message', { error: e });
        }
      };

      this.ws.onerror = (error) => {
        logger.error('Binance WebSocket error:', error);
      };

      this.ws.onclose = () => {
        logger.debug('Binance WebSocket disconnected');
        this.ws = null;
      };

      // Keep alive every 30 minutes
      this.wsKeepAliveInterval = setInterval(() => {
        this.keepAliveListenKey();
      }, 30 * 60 * 1000);
    } catch (error) {
      const httpError = HttpError.fromError(error, HttpErrorType.NETWORK);
      logger.error('Failed to connect Binance WebSocket:', httpError.getUserFriendlyMessage());
    }
  }

  protected disconnectWebSocket(): void {
    if (this.wsKeepAliveInterval) {
      clearInterval(this.wsKeepAliveInterval);
      this.wsKeepAliveInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.wsListenKey = null;
  }

  private async keepAliveListenKey(): Promise<void> {
    if (!this.credentials || !this.wsListenKey) return;

    try {
      await this.spotClient.put('/api/v3/userDataStream', null, {
        params: { listenKey: this.wsListenKey },
        headers: { 'X-MBX-APIKEY': this.credentials.apiKey },
      });
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.error('Failed to keep alive listen key:', httpError.getUserFriendlyMessage());
    }
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.e) {
      case 'outboundAccountPosition':
        // Balance update
        data.B.forEach((b: { a: string; f: string; l: string }) => {
          const balance: Balance = {
            asset: b.a,
            free: this.toDecimal(b.f),
            locked: this.toDecimal(b.l),
            total: this.toDecimal(b.f).plus(this.toDecimal(b.l)),
            balanceType: 'spot',
          };
          this.notifyBalanceUpdate(balance);
        });
        break;

      case 'ACCOUNT_UPDATE':
        // Futures account update
        if (data.a?.P) {
          data.a.P.forEach((p: any) => {
            if (parseFloat(p.pa) !== 0) {
              const positionAmt = this.toDecimal(p.pa);
              const isLong = positionAmt.greaterThan(0);

              const position: Position = {
                id: `${p.s}-${p.ps}`,
                symbol: p.s,
                side: isLong ? 'long' : 'short',
                size: positionAmt.abs(),
                entryPrice: this.toDecimal(p.ep),
                markPrice: new Decimal(0),
                unrealizedPnl: this.toDecimal(p.up),
                leverage: 1,
                marginType: p.mt?.toLowerCase() || 'cross',
                margin: this.toDecimal(p.iw),
                notional: new Decimal(0),
              };
              this.notifyPositionUpdate(position);
            }
          });
        }
        break;
    }
  }

  private mapDepositStatus(status: number): Transfer['status'] {
    switch (status) {
      case 0: return 'pending';
      case 1: return 'completed';
      case 6: return 'completed';
      default: return 'pending';
    }
  }

  private mapWithdrawStatus(status: number): Transfer['status'] {
    switch (status) {
      case 0: return 'pending';
      case 1: return 'cancelled';
      case 2: return 'pending';
      case 3: return 'failed';
      case 4: return 'pending';
      case 5: return 'failed';
      case 6: return 'completed';
      default: return 'pending';
    }
  }
}
