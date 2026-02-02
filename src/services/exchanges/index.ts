export * from './types';
export * from './BaseAdapter';
export { CCXTAdapter, isCCXTSupported, getExchangeConfig, CCXT_SUPPORTED_EXCHANGES } from './CCXTAdapter';

// Legacy adapters (kept for reference during transition)
export { BinanceAdapter } from './legacy/binance';
export { UpbitAdapter } from './legacy/upbit';
export { OKXAdapter } from './legacy/okx';
export { HyperliquidAdapter } from './legacy/hyperliquid';
export { DydxAdapter } from './legacy/dydx';

import { IExchangeAdapter, SupportedExchange, ExchangeCredentials } from './types';
import { CCXTAdapter, isCCXTSupported } from './CCXTAdapter';

// Fallback to legacy adapters for any exchanges not supported by CCXT
import { BinanceAdapter } from './legacy/binance';
import { UpbitAdapter } from './legacy/upbit';
import { OKXAdapter } from './legacy/okx';
import { HyperliquidAdapter } from './legacy/hyperliquid';
import { DydxAdapter } from './legacy/dydx';

/**
 * Create an exchange adapter for the given exchange ID.
 * Uses CCXTAdapter for all CCXT-supported exchanges.
 */
export function createExchangeAdapter(exchangeId: SupportedExchange): IExchangeAdapter {
  // Use CCXTAdapter for all supported exchanges
  if (isCCXTSupported(exchangeId)) {
    return new CCXTAdapter(exchangeId);
  }

  // Fallback to legacy adapters (should not be reached for supported exchanges)
  switch (exchangeId) {
    case SupportedExchange.BINANCE:
      return new BinanceAdapter();
    case SupportedExchange.UPBIT:
      return new UpbitAdapter();
    case SupportedExchange.OKX:
      return new OKXAdapter();
    case SupportedExchange.HYPERLIQUID:
      return new HyperliquidAdapter();
    case SupportedExchange.DYDX:
      return new DydxAdapter();
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
