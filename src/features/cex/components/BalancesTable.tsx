import { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { toast } from '../../../components/Toast';
import { Card } from '../../../components/Card';
import { SearchInput } from '../../../components/SearchInput';
import { Checkbox } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { AssetAvatar } from '../../../components/Avatar';
import { Badge } from '../../../components/Badge';
import { NoDataEmptyState, NoResultsEmptyState } from '../../../components/EmptyState';

export function BalancesTable() {
  const { getAggregatedBalances, accounts } = useExchangeStore();
  const aggregatedBalances = getAggregatedBalances();
  const [searchQuery, setSearchQuery] = useState('');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);

  // Filter and sort balances
  const filteredAndSortedBalances = useMemo(() => {
    let filtered = aggregatedBalances;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => b.asset.toLowerCase().includes(query));
    }

    // Hide small balances (< $1 equivalent - approximated by very small amounts)
    if (hideSmallBalances) {
      filtered = filtered.filter(b => b.total.greaterThan(0.0001));
    }

    // Sort by total (descending)
    return [...filtered].sort((a, b) => b.total.comparedTo(a.total));
  }, [aggregatedBalances, searchQuery, hideSmallBalances]);

  const handleExportCSV = () => {
    if (aggregatedBalances.length === 0) {
      toast.error('No balances to export');
      return;
    }

    const headers = ['Asset', 'Total', 'Available', 'Locked', 'Exchanges'];
    const rows = filteredAndSortedBalances.map(balance => {
      const totalFree = Array.from(balance.byExchange.values()).reduce(
        (sum, b) => sum.plus(b.free), new Decimal(0)
      );
      const totalLocked = Array.from(balance.byExchange.values()).reduce(
        (sum, b) => sum.plus(b.locked), new Decimal(0)
      );
      const exchangeNames = Array.from(balance.byExchange.keys())
        .map(id => accounts.find(a => a.id === id)?.name || id)
        .join('; ');

      return [
        balance.asset,
        balance.total.toString(),
        totalFree.toString(),
        totalLocked.toString(),
        exchangeNames,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cex-balances-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Balances exported to CSV');
  };

  if (aggregatedBalances.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Balances</h2>
        <NoDataEmptyState />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-surface-100">
          Balances
          {(searchQuery || hideSmallBalances) && (
            <span className="text-surface-400 font-normal text-sm ml-2">
              ({filteredAndSortedBalances.length} of {aggregatedBalances.length})
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search asset..."
            size="sm"
            className="w-36"
          />
          <Checkbox
            checked={hideSmallBalances}
            onChange={(e) => setHideSmallBalances(e.target.checked)}
            label="Hide small"
          />
          <Button
            onClick={handleExportCSV}
            variant="ghost"
            size="xs"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {filteredAndSortedBalances.length === 0 ? (
        <NoResultsEmptyState
          searchTerm={searchQuery}
          onClear={() => {
            setSearchQuery('');
            setHideSmallBalances(false);
          }}
        />
      ) : (
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
              {filteredAndSortedBalances.map(balance => (
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
      )}
    </Card>
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
        <div className="flex items-center gap-2">
          <AssetAvatar symbol={asset} size="sm" />
          <span className="font-medium text-surface-100">{asset}</span>
        </div>
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
              title={`${getAccountName(accountId)}: ${formatAmount(balance.total)}`}
            >
              <Badge size="sm">
                {getAccountName(accountId).split(' ')[0]} {formatAmount(balance.total)}
              </Badge>
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
