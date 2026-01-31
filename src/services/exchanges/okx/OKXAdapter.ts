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

// OKX API response types
interface OKXResponse<T> {
  code: string;
  msg: string;
  data: T;
}

interface OKXBalance {
  ccy: string;
  bal: string;
  frozenBal: string;
  availBal: string;
  eqUsd: string;
}

interface OKXAccountBalance {
  totalEq: string;
  details: OKXBalance[];
}

interface OKXPosition {
  instId: string;
  posSide: 'long' | 'short' | 'net';
  pos: string;
  avgPx: string;
  markPx: string;
  upl: string;
  lever: string;
  liqPx: string;
  mgnMode: 'cross' | 'isolated';
  margin: string;
  notionalUsd: string;
}

interface OKXTrade {
  instId: string;
  tradeId: string;
  ordId: string;
  side: 'buy' | 'sell';
  fillPx: string;
  fillSz: string;
  fee: string;
  feeCcy: string;
  ts: string;
}

interface OKXDeposit {
  depId: string;
  ccy: string;
  amt: string;
  chain: string;
  state: string;
  txId: string;
  to: string;
  ts: string;
}

interface OKXWithdraw {
  wdId: string;
  ccy: string;
  amt: string;
  chain: string;
  state: string;
  txId: string;
  to: string;
  fee: string;
  ts: string;
}

interface OKXEarnPosition {
  ccy: string;
  amt: string;
  rate: string;
  productId: string;
  protocol: string;
  protocolType: string;
  term: string;
  state: string;
  earningData: Array<{
    ccy: string;
    earnings: string;
  }>;
}

interface OKXFundingRate {
  instId: string;
  fundingRate: string;
  fundingTime: string;
  nextFundingRate: string;
  nextFundingTime: string;
}

export class OKXAdapter extends BaseExchangeAdapter {
  readonly exchangeId = SupportedExchange.OKX;
  readonly exchangeInfo: ExchangeInfo = {
    id: SupportedExchange.OKX,
    name: 'OKX',
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

  private client: AxiosInstance;
  private ws: WebSocket | null = null;

  private readonly BASE_URL = 'https://www.okx.com';
  private readonly WS_URL = 'wss://ws.okx.com:8443/ws/v5/private';

  constructor() {
    super();
    this.rateLimitConfig = { maxRequests: 60, windowMs: 2000 }; // OKX: 60 req/2s for account API

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
    });
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
    if (!credentials.passphrase) {
      throw new Error('OKX requires a passphrase');
    }

    this.credentials = credentials;

    const isValid = await this.testConnection();
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    this.connected = true;
    await this.connectWebSocket();
  }

  async disconnect(): Promise<void> {
    this.disconnectWebSocket();
    this.credentials = null;
    this.connected = false;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.signedRequest('GET', '/api/v5/account/balance');
      return true;
    } catch (error) {
      const httpError = HttpError.fromError(error, HttpErrorType.AUTH);
      logger.error('OKX connection test failed:', httpError.getUserFriendlyMessage());
      return false;
    }
  }

  protected generateSignature(
    _params: Record<string, string | number>,
    timestamp: number
  ): string {
    // OKX signature is different - uses request method + path + body
    // This is handled in signedRequest
    return String(timestamp);
  }

  private generateOKXSignature(
    timestamp: string,
    method: string,
    requestPath: string,
    body: string = ''
  ): string {
    if (!this.credentials) {
      throw new Error('Not connected');
    }

    const prehash = timestamp + method.toUpperCase() + requestPath + body;
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(prehash, this.credentials.apiSecret)
    );
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    body?: Record<string, any>
  ): Promise<OKXResponse<T>> {
    if (!this.credentials || !this.credentials.passphrase) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const timestamp = new Date().toISOString();
    const queryString = Object.keys(params).length > 0
      ? '?' + this.buildQueryString(params as Record<string, string | number>)
      : '';
    const requestPath = endpoint + queryString;
    const bodyString = body ? JSON.stringify(body) : '';

    const signature = this.generateOKXSignature(timestamp, method, requestPath, bodyString);

    const response = await this.client.request<OKXResponse<T>>({
      method,
      url: requestPath,
      data: body,
      headers: {
        'OK-ACCESS-KEY': this.credentials.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': this.credentials.passphrase,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.code !== '0') {
      throw new Error(`OKX API error: ${response.data.msg}`);
    }

    return response.data;
  }

  async getSpotBalances(): Promise<Balance[]> {
    // Use funding account for spot balances
    const response = await this.signedRequest<OKXBalance[]>('GET', '/api/v5/asset/balances');

    return response.data
      .filter(b => parseFloat(b.availBal) > 0 || parseFloat(b.frozenBal) > 0)
      .map(b => ({
        asset: b.ccy,
        free: this.toDecimal(b.availBal),
        locked: this.toDecimal(b.frozenBal),
        total: this.toDecimal(b.bal),
        balanceType: 'spot' as const,
        valueUsd: this.toDecimal(b.eqUsd),
      }));
  }

  async getFuturesBalances(): Promise<Balance[]> {
    const response = await this.signedRequest<OKXAccountBalance[]>('GET', '/api/v5/account/balance');

    if (!response.data?.[0]?.details) {
      return [];
    }

    return response.data[0].details
      .filter(b => parseFloat(b.availBal) > 0 || parseFloat(b.frozenBal) > 0)
      .map(b => ({
        asset: b.ccy,
        free: this.toDecimal(b.availBal),
        locked: this.toDecimal(b.frozenBal),
        total: this.toDecimal(b.bal),
        balanceType: 'futures' as const,
        valueUsd: this.toDecimal(b.eqUsd),
      }));
  }

  async getFuturesPositions(): Promise<Position[]> {
    const response = await this.signedRequest<OKXPosition[]>('GET', '/api/v5/account/positions');

    return response.data
      .filter(p => parseFloat(p.pos) !== 0)
      .map(p => {
        const posAmt = this.toDecimal(p.pos);
        const isLong = p.posSide === 'long' || (p.posSide === 'net' && posAmt.greaterThan(0));

        return {
          id: `${p.instId}-${p.posSide}`,
          symbol: p.instId,
          side: isLong ? 'long' : 'short',
          size: posAmt.abs(),
          entryPrice: this.toDecimal(p.avgPx),
          markPrice: this.toDecimal(p.markPx),
          unrealizedPnl: this.toDecimal(p.upl),
          leverage: parseInt(p.lever, 10) || 1,
          liquidationPrice: this.toDecimal(p.liqPx),
          marginType: p.mgnMode,
          margin: this.toDecimal(p.margin),
          notional: this.toDecimal(p.notionalUsd),
        } as Position;
      });
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    try {
      const response = await this.signedRequest<OKXEarnPosition[]>(
        'GET',
        '/api/v5/finance/savings/balance'
      );

      return response.data.map(p => {
        const accruedInterest = p.earningData?.reduce(
          (sum, e) => sum.plus(this.toDecimal(e.earnings)),
          new Decimal(0)
        ) || new Decimal(0);

        return {
          id: p.productId,
          asset: p.ccy,
          amount: this.toDecimal(p.amt),
          apy: parseFloat(p.rate) * 100,
          productType: p.term === '0' ? 'flexible' : 'locked',
          productName: p.protocol,
          accruedInterest,
          redeemable: p.state === 'active',
        } as EarnPosition;
      });
    } catch (error) {
      const httpError = HttpError.fromError(error);
      logger.warn('Failed to fetch OKX earn positions:', httpError.getUserFriendlyMessage());
      return [];
    }
  }

  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    const response = await this.signedRequest<OKXTrade[]>('GET', '/api/v5/trade/fills-history', {
      instId: params?.symbol,
      begin: params?.since,
      limit: params?.limit || 100,
    });

    return response.data.map(t => ({
      id: t.tradeId,
      symbol: t.instId,
      side: t.side,
      price: this.toDecimal(t.fillPx),
      amount: this.toDecimal(t.fillSz),
      cost: this.toDecimal(t.fillPx).times(this.toDecimal(t.fillSz)),
      fee: this.toDecimal(t.fee).abs(),
      feeAsset: t.feeCcy,
      timestamp: this.parseTimestamp(t.ts),
      orderId: t.ordId,
    }));
  }

  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const response = await this.signedRequest<OKXDeposit[]>('GET', '/api/v5/asset/deposit-history', {
      ccy: params?.asset,
      after: params?.since,
      limit: params?.limit || 100,
    });

    return response.data.map(d => ({
      id: d.depId,
      asset: d.ccy,
      amount: this.toDecimal(d.amt),
      type: 'deposit' as const,
      txHash: d.txId,
      address: d.to,
      network: d.chain,
      status: this.mapOKXDepositStatus(d.state),
      timestamp: this.parseTimestamp(d.ts),
    }));
  }

  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const response = await this.signedRequest<OKXWithdraw[]>('GET', '/api/v5/asset/withdrawal-history', {
      ccy: params?.asset,
      after: params?.since,
      limit: params?.limit || 100,
    });

    return response.data.map(w => ({
      id: w.wdId,
      asset: w.ccy,
      amount: this.toDecimal(w.amt),
      type: 'withdraw' as const,
      txHash: w.txId,
      address: w.to,
      network: w.chain,
      status: this.mapOKXWithdrawStatus(w.state),
      fee: this.toDecimal(w.fee),
      timestamp: this.parseTimestamp(w.ts),
    }));
  }

  async getFundingRates(symbols?: string[]): Promise<FundingRate[]> {
    const results: FundingRate[] = [];

    // OKX requires fetching funding rate per symbol
    const symbolsToFetch = symbols || ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'];

    for (const symbol of symbolsToFetch) {
      try {
        const response = await this.client.get<OKXResponse<OKXFundingRate[]>>(
          '/api/v5/public/funding-rate',
          { params: { instId: symbol } }
        );

        if (response.data.data?.[0]) {
          const r = response.data.data[0];
          results.push({
            symbol: r.instId,
            rate: this.toDecimal(r.fundingRate),
            timestamp: this.parseTimestamp(r.fundingTime),
            nextFundingTime: r.nextFundingTime ? this.parseTimestamp(r.nextFundingTime) : undefined,
          });
        }
      } catch (error) {
        const httpError = HttpError.fromError(error);
        logger.warn(`Failed to fetch funding rate for ${symbol}:`, httpError.getUserFriendlyMessage());
      }
    }

    return results;
  }

  protected async connectWebSocket(): Promise<void> {
    if (!this.credentials || !this.credentials.passphrase) return;

    this.ws = new WebSocket(this.WS_URL);

    this.ws.onopen = () => {
      logger.debug('OKX WebSocket connected');
      this.authenticateWebSocket();
    };

    this.ws.onmessage = (event) => {
      this.handleWebSocketMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      logger.error('OKX WebSocket error:', error);
    };

    this.ws.onclose = () => {
      logger.debug('OKX WebSocket disconnected');
      this.ws = null;
    };
  }

  private authenticateWebSocket(): void {
    if (!this.ws || !this.credentials || !this.credentials.passphrase) return;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(timestamp + 'GET' + '/users/self/verify', this.credentials.apiSecret)
    );

    const loginMsg = {
      op: 'login',
      args: [{
        apiKey: this.credentials.apiKey,
        passphrase: this.credentials.passphrase,
        timestamp,
        sign,
      }],
    };

    this.ws.send(JSON.stringify(loginMsg));
  }

  private subscribeToChannels(): void {
    if (!this.ws) return;

    // Subscribe to account and positions channels
    const subscribeMsg = {
      op: 'subscribe',
      args: [
        { channel: 'account' },
        { channel: 'positions', instType: 'SWAP' },
      ],
    };

    this.ws.send(JSON.stringify(subscribeMsg));
  }

  private handleWebSocketMessage(data: any): void {
    if (data.event === 'login' && data.code === '0') {
      logger.debug('OKX WebSocket authenticated');
      this.subscribeToChannels();
      return;
    }

    if (data.arg?.channel === 'account' && data.data) {
      // Account balance update
      data.data[0]?.details?.forEach((b: OKXBalance) => {
        const balance: Balance = {
          asset: b.ccy,
          free: this.toDecimal(b.availBal),
          locked: this.toDecimal(b.frozenBal),
          total: this.toDecimal(b.bal),
          balanceType: 'futures',
          valueUsd: this.toDecimal(b.eqUsd),
        };
        this.notifyBalanceUpdate(balance);
      });
    }

    if (data.arg?.channel === 'positions' && data.data) {
      // Position update
      data.data.forEach((p: OKXPosition) => {
        if (parseFloat(p.pos) !== 0) {
          const posAmt = this.toDecimal(p.pos);
          const isLong = p.posSide === 'long' || (p.posSide === 'net' && posAmt.greaterThan(0));

          const position: Position = {
            id: `${p.instId}-${p.posSide}`,
            symbol: p.instId,
            side: isLong ? 'long' : 'short',
            size: posAmt.abs(),
            entryPrice: this.toDecimal(p.avgPx),
            markPrice: this.toDecimal(p.markPx),
            unrealizedPnl: this.toDecimal(p.upl),
            leverage: parseInt(p.lever, 10) || 1,
            liquidationPrice: this.toDecimal(p.liqPx),
            marginType: p.mgnMode,
            margin: this.toDecimal(p.margin),
            notional: this.toDecimal(p.notionalUsd),
          };
          this.notifyPositionUpdate(position);
        }
      });
    }
  }

  protected disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private mapOKXDepositStatus(state: string): Transfer['status'] {
    switch (state) {
      case '0': return 'pending'; // waiting for confirmation
      case '1': return 'pending'; // deposit credited
      case '2': return 'completed'; // deposit successful
      default: return 'pending';
    }
  }

  private mapOKXWithdrawStatus(state: string): Transfer['status'] {
    switch (state) {
      case '-3': return 'cancelled';
      case '-2': return 'cancelled';
      case '-1': return 'failed';
      case '0': return 'pending';
      case '1': return 'pending';
      case '2': return 'completed';
      case '7': return 'pending'; // approved
      case '10': return 'pending'; // waiting transfer
      default: return 'pending';
    }
  }
}
