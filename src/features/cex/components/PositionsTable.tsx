import { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { Position } from '../../../services/exchanges';
import { toast } from '../../../components/Toast';
import { Card } from '../../../components/Card';
import { SearchInput } from '../../../components/SearchInput';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { NoResultsEmptyState } from '../../../components/EmptyState';

type SortField = 'symbol' | 'size' | 'pnl' | 'leverage';
type SortDirection = 'asc' | 'desc';

export function PositionsTable() {
  const { allPositions, accounts } = useExchangeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSide, setFilterSide] = useState<'all' | 'long' | 'short'>('all');
  const [sortField, setSortField] = useState<SortField>('pnl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Flatten all positions
  const allPositionsList = useMemo(() => {
    const list: Array<{ accountId: string; position: Position }> = [];
    allPositions.forEach((positions, accountId) => {
      positions.forEach(position => {
        list.push({ accountId, position });
      });
    });
    return list;
  }, [allPositions]);

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || id;
  };

  // Filter and sort positions
  const filteredAndSortedPositions = useMemo(() => {
    const getAccountNameLocal = (id: string) => {
      return accounts.find(a => a.id === id)?.name || id;
    };

    let filtered = allPositionsList;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ position, accountId }) =>
        position.symbol.toLowerCase().includes(query) ||
        getAccountNameLocal(accountId).toLowerCase().includes(query)
      );
    }

    // Apply side filter
    if (filterSide !== 'all') {
      filtered = filtered.filter(({ position }) => position.side === filterSide);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'symbol':
          comparison = a.position.symbol.localeCompare(b.position.symbol);
          break;
        case 'size':
          comparison = a.position.notional.minus(b.position.notional).toNumber();
          break;
        case 'pnl':
          comparison = a.position.unrealizedPnl.minus(b.position.unrealizedPnl).toNumber();
          break;
        case 'leverage':
          comparison = a.position.leverage - b.position.leverage;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [allPositionsList, searchQuery, filterSide, sortField, sortDirection, accounts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className={`ml-1 ${sortField === field ? 'text-primary-400' : 'text-surface-600'}`}>
      {sortField === field ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  const handleExportCSV = () => {
    if (allPositionsList.length === 0) {
      toast.error('No positions to export');
      return;
    }

    const headers = ['Symbol', 'Side', 'Size', 'Entry Price', 'Mark Price', 'uPnL', 'uPnL %', 'Leverage', 'Liq. Price', 'Notional', 'Exchange'];
    const rows = filteredAndSortedPositions.map(({ accountId, position }) => {
      const pnlPercent = position.entryPrice.isZero()
        ? new Decimal(0)
        : position.unrealizedPnl.dividedBy(position.size.times(position.entryPrice)).times(100);

      return [
        position.symbol,
        position.side,
        position.size.toString(),
        position.entryPrice.toString(),
        position.markPrice.toString(),
        position.unrealizedPnl.toFixed(2),
        pnlPercent.toFixed(2),
        position.leverage.toString(),
        position.liquidationPrice?.toString() || '',
        position.notional.toFixed(2),
        getAccountName(accountId),
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `positions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Positions exported to CSV');
  };

  if (allPositionsList.length === 0) {
    return null; // Don't show section if no positions at all
  }

  // Calculate totals (from filtered positions for display)
  const totalPnl = filteredAndSortedPositions.reduce(
    (sum, { position }) => sum.plus(position.unrealizedPnl),
    new Decimal(0)
  );

  const totalNotional = filteredAndSortedPositions.reduce(
    (sum, { position }) => sum.plus(position.notional),
    new Decimal(0)
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-surface-100">
            Open Positions
            {(searchQuery || filterSide !== 'all') && (
              <span className="text-surface-400 font-normal text-sm ml-2">
                ({filteredAndSortedPositions.length} of {allPositionsList.length})
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search..."
              size="sm"
              className="w-32"
            />
            <div className="flex gap-1">
              {(['all', 'long', 'short'] as const).map(side => (
                <Button
                  key={side}
                  onClick={() => setFilterSide(side)}
                  variant={filterSide === side ? 'primary' : 'secondary'}
                  size="xs"
                  className={
                    filterSide === side
                      ? side === 'long' ? '!bg-gain hover:!bg-gain/90' :
                        side === 'short' ? '!bg-loss hover:!bg-loss/90' :
                        ''
                      : ''
                  }
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              onClick={handleExportCSV}
              variant="ghost"
              size="xs"
            >
              Export CSV
            </Button>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-surface-400">Total Notional: </span>
            <span className="text-surface-100 font-tabular">
              ${formatCurrency(totalNotional)}
            </span>
          </div>
          <div>
            <span className="text-surface-400">Total uPnL: </span>
            <span className={`font-tabular ${totalPnl.greaterThanOrEqualTo(0) ? 'text-gain' : 'text-loss'}`}>
              {totalPnl.greaterThanOrEqualTo(0) ? '+' : ''}${formatCurrency(totalPnl)}
            </span>
          </div>
        </div>
      </div>

      {filteredAndSortedPositions.length === 0 ? (
        <NoResultsEmptyState
          searchTerm={searchQuery}
          onClear={() => {
            setSearchQuery('');
            setFilterSide('all');
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('symbol')}
                >
                  Symbol<SortIcon field="symbol" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Side</th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('size')}
                >
                  Size<SortIcon field="size" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Entry Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Mark Price</th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('pnl')}
                >
                  uPnL<SortIcon field="pnl" />
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('leverage')}
                >
                  Leverage<SortIcon field="leverage" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Liq. Price</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPositions.map(({ accountId, position }) => (
                <PositionRow
                  key={`${accountId}-${position.id}`}
                  position={position}
                  accountName={getAccountName(accountId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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
        <Badge variant={position.side === 'long' ? 'success' : 'danger'} size="sm">
          {position.side.toUpperCase()}
        </Badge>
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
        <Badge size="sm">{accountName}</Badge>
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
