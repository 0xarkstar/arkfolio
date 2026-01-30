import Decimal from 'decimal.js';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { Position } from '../../../services/exchanges';

export function PositionsTable() {
  const { allPositions, accounts } = useExchangeStore();

  // Flatten all positions
  const allPositionsList: Array<{ accountId: string; position: Position }> = [];
  allPositions.forEach((positions, accountId) => {
    positions.forEach(position => {
      allPositionsList.push({ accountId, position });
    });
  });

  if (allPositionsList.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Open Positions</h2>
        <div className="text-center py-8 text-surface-400">
          <p>No open positions</p>
          <p className="text-sm mt-1">Your futures positions will appear here</p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPnl = allPositionsList.reduce(
    (sum, { position }) => sum.plus(position.unrealizedPnl),
    new Decimal(0)
  );

  const totalNotional = allPositionsList.reduce(
    (sum, { position }) => sum.plus(position.notional),
    new Decimal(0)
  );

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || id;
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-surface-100">Open Positions</h2>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-surface-400">Total Notional: </span>
            <span className="text-surface-100 font-tabular">
              ${formatCurrency(totalNotional)}
            </span>
          </div>
          <div>
            <span className="text-surface-400">Total uPnL: </span>
            <span className={`font-tabular ${totalPnl.greaterThanOrEqualTo(0) ? 'text-profit' : 'text-loss'}`}>
              {totalPnl.greaterThanOrEqualTo(0) ? '+' : ''}${formatCurrency(totalPnl)}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Symbol</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Side</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Size</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Entry Price</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Mark Price</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">uPnL</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Leverage</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Liq. Price</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Exchange</th>
            </tr>
          </thead>
          <tbody>
            {allPositionsList.map(({ accountId, position }) => (
              <PositionRow
                key={`${accountId}-${position.id}`}
                position={position}
                accountName={getAccountName(accountId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PositionRowProps {
  position: Position;
  accountName: string;
}

function PositionRow({ position, accountName }: PositionRowProps) {
  const pnlPercent = position.entryPrice.isZero()
    ? new Decimal(0)
    : position.unrealizedPnl.dividedBy(
        position.size.times(position.entryPrice)
      ).times(100);

  return (
    <tr className="border-b border-surface-800 hover:bg-surface-800/50">
      <td className="py-3 px-4">
        <span className="font-medium text-surface-100">{position.symbol}</span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            position.side === 'long'
              ? 'bg-profit/20 text-profit'
              : 'bg-loss/20 text-loss'
          }`}
        >
          {position.side.toUpperCase()}
        </span>
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-100">
        {formatAmount(position.size)}
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-300">
        {formatPrice(position.entryPrice)}
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-300">
        {formatPrice(position.markPrice)}
      </td>
      <td className="py-3 px-4 text-right">
        <div className={`font-tabular ${position.unrealizedPnl.greaterThanOrEqualTo(0) ? 'text-profit' : 'text-loss'}`}>
          {position.unrealizedPnl.greaterThanOrEqualTo(0) ? '+' : ''}
          ${formatCurrency(position.unrealizedPnl)}
        </div>
        <div className={`text-xs ${pnlPercent.greaterThanOrEqualTo(0) ? 'text-profit' : 'text-loss'}`}>
          {pnlPercent.greaterThanOrEqualTo(0) ? '+' : ''}{pnlPercent.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-300">
        {position.leverage}x
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-400">
        {position.liquidationPrice ? formatPrice(position.liquidationPrice) : '-'}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-surface-400">
          {accountName}
        </span>
      </td>
    </tr>
  );
}

function formatAmount(value: Decimal): string {
  if (value.isZero()) return '0';

  const num = value.toNumber();

  if (num >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

function formatPrice(value: Decimal): string {
  if (value.isZero()) return '-';

  const num = value.toNumber();

  if (num >= 1000) {
    return value.toFixed(2);
  }

  if (num >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

function formatCurrency(value: Decimal): string {
  const num = Math.abs(value.toNumber());

  if (num >= 1000000) {
    return `${(value.toNumber() / 1000000).toFixed(2)}M`;
  }

  if (num >= 1000) {
    return `${(value.toNumber() / 1000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}
