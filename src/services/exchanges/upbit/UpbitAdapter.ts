import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';
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

// Upbit API response types
interface UpbitAccount {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  avg_buy_price_modified: boolean;
  unit_currency: string;
}

interface UpbitOrder {
  uuid: string;
  side: 'bid' | 'ask';
  ord_type: string;
  price: string;
  state: string;
  market: string;
  created_at: string;
  volume: string;
  remaining_volume: string;
  executed_volume: string;
  trades_count: number;
  paid_fee: string;
  locked: string;
}

interface UpbitDeposit {
  uuid: string;
  currency: string;
  txid: string;
  state: string;
  created_at: string;
  done_at: string;
  amount: string;
  fee: string;
}

interface UpbitWithdraw {
  uuid: string;
  currency: string;
  txid: string;
  state: string;
  created_at: string;
  done_at: string;
  amount: string;
  fee: string;
}

export class UpbitAdapter extends BaseExchangeAdapter {
  readonly exchangeId = SupportedExchange.UPBIT;
  readonly exchangeInfo: ExchangeInfo = {
    id: SupportedExchange.UPBIT,
    name: 'Upbit',
    type: 'cex',
    supportedFeatures: {
      spot: true,
      futures: false,
      margin: false,
      earn: false,
      deposit: true,
      withdraw: true,
      websocket: true,
    },
  };

  private client: AxiosInstance;
  private ws: WebSocket | null = null;

  private readonly BASE_URL = 'https://api.upbit.com/v1';
  private readonly WS_URL = 'wss://api.upbit.com/websocket/v1';

  constructor() {
    super();
    this.rateLimitConfig = { maxRequests: 900, windowMs: 60000 }; // Upbit: 900 req/min for order API

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
    });
  }

  async connect(credentials: ExchangeCredentials): Promise<void> {
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
      await this.signedRequest('GET', '/accounts');
      return true;
    } catch (error) {
      console.error('Upbit connection test failed:', error);
      return false;
    }
  }

  protected generateSignature(
    _params: Record<string, string | number>,
    _timestamp: number
  ): string {
    // Upbit uses JWT, signature generation is different
    return '';
  }

  private generateJWT(queryHash?: string): string {
    if (!this.credentials) {
      throw new Error('Not connected');
    }

    const payload: Record<string, any> = {
      access_key: this.credentials.apiKey,
      nonce: crypto.randomUUID(),
    };

    if (queryHash) {
      payload.query_hash = queryHash;
      payload.query_hash_alg = 'SHA512';
    }

    // Create JWT header
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = CryptoJS.HmacSHA256(signatureInput, this.credentials.apiSecret);
    const encodedSignature = this.base64UrlEncode(
      CryptoJS.enc.Base64.stringify(signature)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    );

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  private base64UrlEncode(str: string): string {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error('Not connected');
    }

    await this.checkRateLimit();

    const cleanParams: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanParams[key] = value;
      }
    });

    let queryHash: string | undefined;
    let queryString = '';

    if (Object.keys(cleanParams).length > 0) {
      queryString = this.buildQueryString(cleanParams);
      queryHash = CryptoJS.SHA512(queryString).toString();
    }

    const token = this.generateJWT(queryHash);

    const response = await this.client.request<T>({
      method,
      url: queryString ? `${endpoint}?${queryString}` : endpoint,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  }

  async getSpotBalances(): Promise<Balance[]> {
    const accounts = await this.signedRequest<UpbitAccount[]>('GET', '/accounts');

    return accounts
      .filter(a => parseFloat(a.balance) > 0 || parseFloat(a.locked) > 0)
      .map(a => ({
        asset: a.currency,
        free: this.toDecimal(a.balance),
        locked: this.toDecimal(a.locked),
        total: this.toDecimal(a.balance).plus(this.toDecimal(a.locked)),
        balanceType: 'spot' as const,
      }));
  }

  async getFuturesBalances(): Promise<Balance[]> {
    // Upbit doesn't support futures
    return [];
  }

  async getFuturesPositions(): Promise<Position[]> {
    // Upbit doesn't support futures
    return [];
  }

  async getEarnPositions(): Promise<EarnPosition[]> {
    // Upbit doesn't have earn products via API
    return [];
  }

  async getTradeHistory(params?: TradeHistoryParams): Promise<Trade[]> {
    // Upbit uses order history, not trade history directly
    // Need to fetch closed orders
    const orders = await this.signedRequest<UpbitOrder[]>('GET', '/orders', {
      market: params?.symbol,
      state: 'done',
      limit: params?.limit || 100,
    });

    return orders.map(o => {
      const [quote, base] = o.market.split('-');
      return {
        id: o.uuid,
        symbol: o.market,
        side: o.side === 'bid' ? 'buy' : 'sell',
        price: this.toDecimal(o.price),
        amount: this.toDecimal(o.executed_volume),
        cost: this.toDecimal(o.price).times(this.toDecimal(o.executed_volume)),
        fee: this.toDecimal(o.paid_fee),
        feeAsset: o.side === 'bid' ? base : quote,
        timestamp: new Date(o.created_at),
        orderId: o.uuid,
      };
    });
  }

  async getDepositHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const deposits = await this.signedRequest<UpbitDeposit[]>('GET', '/deposits', {
      currency: params?.asset,
      limit: params?.limit || 100,
    });

    return deposits.map(d => ({
      id: d.uuid,
      asset: d.currency,
      amount: this.toDecimal(d.amount),
      type: 'deposit' as const,
      txHash: d.txid,
      status: this.mapUpbitStatus(d.state),
      fee: this.toDecimal(d.fee),
      timestamp: new Date(d.done_at || d.created_at),
    }));
  }

  async getWithdrawHistory(params?: TransferHistoryParams): Promise<Transfer[]> {
    const withdrawals = await this.signedRequest<UpbitWithdraw[]>('GET', '/withdraws', {
      currency: params?.asset,
      limit: params?.limit || 100,
    });

    return withdrawals.map(w => ({
      id: w.uuid,
      asset: w.currency,
      amount: this.toDecimal(w.amount),
      type: 'withdraw' as const,
      txHash: w.txid,
      status: this.mapUpbitStatus(w.state),
      fee: this.toDecimal(w.fee),
      timestamp: new Date(w.done_at || w.created_at),
    }));
  }

  async getFundingRates(_symbols?: string[]): Promise<FundingRate[]> {
    // Upbit doesn't support futures
    return [];
  }

  protected async connectWebSocket(): Promise<void> {
    // Upbit WebSocket is for market data, not user data
    // User data requires polling
    this.ws = new WebSocket(this.WS_URL);

    this.ws.onopen = () => {
      console.log('Upbit WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      // Handle market data messages
      try {
        const data = JSON.parse(event.data.toString());
        console.log('Upbit WS message:', data);
      } catch {
        // Binary data
      }
    };

    this.ws.onerror = (error) => {
      console.error('Upbit WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Upbit WebSocket disconnected');
      this.ws = null;
    };
  }

  protected disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private mapUpbitStatus(state: string): Transfer['status'] {
    switch (state) {
      case 'DONE':
      case 'accepted':
        return 'completed';
      case 'WAITING':
      case 'PROCESSING':
      case 'submitting':
      case 'submitted':
      case 'almost_accepted':
        return 'pending';
      case 'REJECTED':
      case 'rejected':
      case 'canceled':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
