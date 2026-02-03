// CCXT types - imported dynamically to avoid bundling issues
type Balances = import('ccxt').Balances;
type CCXTPosition = import('ccxt').Position;
type CCXTTrade = import('ccxt').Trade;
type Transaction = import('ccxt').Transaction;

import Decimal from 'decimal.js';
import { Balance, Position, Trade, Transfer, BalanceType } from '../types';

/**
 * Convert a value to Decimal
 */
export function toDecimal(value: number | string | Decimal | undefined | null): Decimal {
  if (value === undefined || value === null) {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Map CCXT balances to our Balance type
 */
export function mapBalances(ccxtBalance: Balances, type: BalanceType): Balance[] {
  const result: Balance[] = [];

  // Get the 'total' object which contains all assets
  // CCXT Balances has special structure with total/free/used objects
  const total = ccxtBalance.total || {};
  const free = ccxtBalance.free || {};
  const used = ccxtBalance.used || {};

  // Cast to generic records for indexing
  const freeRecord = free as unknown as Record<string, number | undefined>;
  const usedRecord = used as unknown as Record<string, number | undefined>;

  for (const [asset, totalAmount] of Object.entries(total)) {
    // Skip info/timestamp fields and zero balances
    if (asset === 'info' || asset === 'timestamp' || asset === 'datetime') continue;

    const totalValue = typeof totalAmount === 'number' ? totalAmount : parseFloat(String(totalAmount) || '0');
    if (totalValue <= 0) continue;

    const freeValue = freeRecord[asset];
    const usedValue = usedRecord[asset];

    const freeAmount = typeof freeValue === 'number' ? freeValue : parseFloat(String(freeValue) || '0');
    const usedAmount = typeof usedValue === 'number' ? usedValue : parseFloat(String(usedValue) || '0');

    result.push({
      asset,
      free: toDecimal(freeAmount),
      locked: toDecimal(usedAmount),
      total: toDecimal(totalValue),
      balanceType: type,
    });
  }

  return result;
}

/**
 * Map CCXT positions to our Position type
 */
export function mapPositions(ccxtPositions: CCXTPosition[]): Position[] {
  return ccxtPositions
    .filter(p => {
      const contracts = p.contracts ?? 0;
      return contracts !== 0 && contracts !== undefined;
    })
    .map(p => {
      const contracts = toDecimal(p.contracts ?? 0);
      const isLong = p.side === 'long' || contracts.greaterThan(0);

      return {
        id: p.id || `${p.symbol}-${p.side || 'both'}`,
        symbol: p.symbol || '',
        side: isLong ? 'long' : 'short',
        size: contracts.abs(),
        entryPrice: toDecimal(p.entryPrice ?? 0),
        markPrice: toDecimal(p.markPrice ?? 0),
        unrealizedPnl: toDecimal(p.unrealizedPnl ?? 0),
        leverage: p.leverage ?? 1,
        liquidationPrice: p.liquidationPrice ? toDecimal(p.liquidationPrice) : undefined,
        marginType: (p.marginMode === 'isolated' ? 'isolated' : 'cross') as Position['marginType'],
        margin: toDecimal(p.collateral ?? p.initialMargin ?? 0),
        notional: toDecimal(p.notional ?? 0).abs(),
      } as Position;
    });
}

/**
 * Map CCXT trades to our Trade type
 */
export function mapTrades(ccxtTrades: CCXTTrade[]): Trade[] {
  return ccxtTrades.map(t => ({
    id: t.id || String(t.timestamp),
    symbol: t.symbol || '',
    side: t.side as 'buy' | 'sell',
    price: toDecimal(t.price ?? 0),
    amount: toDecimal(t.amount ?? 0),
    cost: toDecimal(t.cost ?? 0),
    fee: toDecimal(t.fee?.cost ?? 0),
    feeAsset: t.fee?.currency || '',
    timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
    orderId: t.order,
  }));
}

/**
 * Map transfer status from CCXT to our status type
 */
function mapTransferStatus(status?: string): Transfer['status'] {
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

/**
 * Map CCXT transfers to our Transfer type
 */
export function mapTransfers(ccxtTransfers: Transaction[], type: 'deposit' | 'withdraw'): Transfer[] {
  return ccxtTransfers.map(t => ({
    id: t.id || String(t.timestamp),
    asset: t.currency || '',
    amount: toDecimal(t.amount ?? 0),
    type,
    txHash: t.txid,
    address: t.address,
    network: t.network,
    status: mapTransferStatus(t.status),
    fee: t.fee ? toDecimal(t.fee.cost ?? 0) : undefined,
    timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
  }));
}
