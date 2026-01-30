export * from './types';
export * from './BaseAdapter';
export { BinanceAdapter } from './binance';
export { UpbitAdapter } from './upbit';
export { OKXAdapter } from './okx';
export { HyperliquidAdapter } from './hyperliquid';

import { IExchangeAdapter, SupportedExchange, ExchangeCredentials } from './types';
import { BinanceAdapter } from './binance';
import { UpbitAdapter } from './upbit';
import { OKXAdapter } from './okx';
import { HyperliquidAdapter } from './hyperliquid';

// Exchange adapter factory
export function createExchangeAdapter(exchangeId: SupportedExchange): IExchangeAdapter {
  switch (exchangeId) {
    case SupportedExchange.BINANCE:
      return new BinanceAdapter();
    case SupportedExchange.UPBIT:
      return new UpbitAdapter();
    case SupportedExchange.OKX:
      return new OKXAdapter();
    case SupportedExchange.HYPERLIQUID:
      return new HyperliquidAdapter();
    default:
      throw new Error(`Unsupported exchange: ${exchangeId}`);
  }
}

// Exchange manager class for managing multiple exchange connections
export class ExchangeManager {
  private adapters: Map<string, IExchangeAdapter> = new Map();

  async connectExchange(
    exchangeId: SupportedExchange,
    credentials: ExchangeCredentials,
    accountId: string
  ): Promise<IExchangeAdapter> {
    const adapter = createExchangeAdapter(exchangeId);
    await adapter.connect(credentials);
    this.adapters.set(accountId, adapter);
    return adapter;
  }

  async disconnectExchange(accountId: string): Promise<void> {
    const adapter = this.adapters.get(accountId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(accountId);
    }
  }

  getAdapter(accountId: string): IExchangeAdapter | undefined {
    return this.adapters.get(accountId);
  }

  getAllAdapters(): Map<string, IExchangeAdapter> {
    return this.adapters;
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values()).map(
      adapter => adapter.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.adapters.clear();
  }
}

// Singleton instance
export const exchangeManager = new ExchangeManager();
