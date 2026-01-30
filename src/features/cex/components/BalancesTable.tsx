import Decimal from 'decimal.js';
import { useExchangeStore } from '../../../stores/exchangeStore';

export function BalancesTable() {
  const { getAggregatedBalances, accounts } = useExchangeStore();
  const aggregatedBalances = getAggregatedBalances();

  if (aggregatedBalances.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Balances</h2>
        <div className="text-center py-8 text-surface-400">
          <p>No balances to display</p>
          <p className="text-sm mt-1">Connect an exchange and sync to see your balances</p>
        </div>
      </div>
    );
  }

  // Sort by total value (descending)
  const sortedBalances = [...aggregatedBalances].sort((a, b) =>
    b.total.comparedTo(a.total)
  );

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-surface-100 mb-4">Balances</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Asset</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Total</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Available</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Locked</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {sortedBalances.map(balance => (
              <BalanceRow
                key={balance.asset}
                asset={balance.asset}
                total={balance.total}
                byExchange={balance.byExchange}
                accounts={accounts}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface BalanceRowProps {
  asset: string;
  total: Decimal;
  byExchange: Map<string, { free: Decimal; locked: Decimal; total: Decimal }>;
  accounts: { id: string; name: string }[];
}

function BalanceRow({ asset, total, byExchange, accounts }: BalanceRowProps) {
  const totalFree = Array.from(byExchange.values()).reduce(
    (sum, b) => sum.plus(b.free),
    new Decimal(0)
  );

  const totalLocked = Array.from(byExchange.values()).reduce(
    (sum, b) => sum.plus(b.locked),
    new Decimal(0)
  );

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || id;
  };

  return (
    <tr className="border-b border-surface-800 hover:bg-surface-800/50">
      <td className="py-3 px-4">
        <span className="font-medium text-surface-100">{asset}</span>
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-100">
        {formatAmount(total)}
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-300">
        {formatAmount(totalFree)}
      </td>
      <td className="py-3 px-4 text-right font-tabular text-surface-400">
        {formatAmount(totalLocked)}
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          {Array.from(byExchange.entries()).map(([accountId, balance]) => (
            <span
              key={accountId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-700 rounded text-xs text-surface-300"
              title={`${getAccountName(accountId)}: ${formatAmount(balance.total)}`}
            >
              {getAccountName(accountId).split(' ')[0]}
              <span className="text-surface-400">{formatAmount(balance.total)}</span>
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function formatAmount(value: Decimal): string {
  if (value.isZero()) return '0';

  const num = value.toNumber();

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }

  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }

  if (num >= 1) {
    return value.toFixed(4);
  }

  if (num >= 0.0001) {
    return value.toFixed(6);
  }

  return value.toExponential(2);
}
