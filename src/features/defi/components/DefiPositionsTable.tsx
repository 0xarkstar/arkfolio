import { useMemo } from 'react';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { SearchInput } from '../../../components/SearchInput';
import { Select } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { SectionLoading } from '../../../components/Skeleton';
import { NoDataEmptyState, NoResultsEmptyState } from '../../../components/EmptyState';
import { DefiPosition } from '../../../stores/defiStore';
import { Decimal, toDisplayNumber } from '../../../utils/decimal';
import { formatCurrency, getPositionTypeLabel, getPositionTypeVariant } from '../utils';
import { toast } from '../../../components/Toast';
import type { SortField, SortDirection } from '../hooks/useDefiPage';

interface DefiPositionsTableProps {
  positions: DefiPosition[];
  isLoading: boolean;
  isSyncing: boolean;
  isCalculatingCostBasis: boolean;
  lastZapperSync: Date | null;
  isZapperConfigured: boolean;
  hasStorePositions: boolean;

  // Filter/sort
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  filterChain: string;
  setFilterChain: (value: string) => void;
  filterType: string;
  setFilterType: (value: string) => void;

  // Handlers
  handleSort: (field: SortField) => void;
  handleSyncFromZapper: () => void;
  handleCalculateCostBasis: () => void;
  handleRemovePosition: (position: DefiPosition) => void;
  getPositionPnL: (positionId: string) => { unrealizedPnL: Decimal; unrealizedPnLPercent: number; hasCostBasis: boolean } | null;
  onAddPosition: () => void;
  clearFilters: () => void;
}

export function DefiPositionsTable({
  positions,
  isLoading,
  isSyncing,
  isCalculatingCostBasis,
  lastZapperSync,
  isZapperConfigured,
  hasStorePositions,
  searchQuery,
  setSearchQuery,
  sortField,
  sortDirection,
  filterChain,
  setFilterChain,
  filterType,
  setFilterType,
  handleSort,
  handleSyncFromZapper,
  handleCalculateCostBasis,
  handleRemovePosition,
  getPositionPnL,
  onAddPosition,
  clearFilters,
}: DefiPositionsTableProps) {
  // Get unique chains and types for filter dropdowns
  const uniqueChains = useMemo(() =>
    Array.from(new Set(positions.map(p => p.chain))).sort(),
    [positions]
  );
  const uniqueTypes = useMemo(() =>
    Array.from(new Set(positions.map(p => p.positionType))).sort(),
    [positions]
  );

  // Filter and sort positions
  const filteredAndSortedPositions = useMemo(() => {
    let filtered = positions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.protocol.toLowerCase().includes(query) ||
             p.assets.some(a => a.toLowerCase().includes(query)) ||
             p.chain.toLowerCase().includes(query)
      );
    }

    // Apply chain filter
    if (filterChain !== 'all') {
      filtered = filtered.filter(p => p.chain === filterChain);
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.positionType === filterType);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'protocol':
          comparison = a.protocol.localeCompare(b.protocol);
          break;
        case 'value':
          comparison = a.currentValueUsd.minus(b.currentValueUsd).toNumber();
          break;
        case 'apy':
          comparison = (a.apy || 0) - (b.apy || 0);
          break;
        case 'type':
          comparison = a.positionType.localeCompare(b.positionType);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [positions, searchQuery, filterChain, filterType, sortField, sortDirection]);

  const handleExportCSV = () => {
    if (positions.length === 0) {
      toast.error('No positions to export');
      return;
    }

    const headers = ['Protocol', 'Type', 'Chain', 'Assets', 'Value (USD)', 'Cost Basis (USD)', 'APY (%)', 'Health Factor', 'P&L (USD)', 'P&L (%)'];
    const rows = filteredAndSortedPositions.map(p => {
      const pnl = toDisplayNumber(p.currentValueUsd.minus(p.costBasisUsd));
      const costBasisNum = toDisplayNumber(p.costBasisUsd);
      const pnlPercent = costBasisNum > 0 ? (pnl / costBasisNum * 100) : 0;
      return [
        p.protocol,
        p.positionType,
        p.chain,
        p.assets.join('/'),
        p.currentValueUsd.toFixed(2),
        p.costBasisUsd.toFixed(2),
        p.apy?.toFixed(2) || '',
        p.healthFactor?.toFixed(2) || '',
        pnl.toFixed(2),
        pnlPercent.toFixed(2),
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defi-positions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('DeFi positions exported to CSV');
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className={`ml-1 ${sortField === field ? 'text-primary-400' : 'text-surface-600'}`}>
      {sortField === field ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-surface-100">
          DeFi Positions
          {(searchQuery || filterChain !== 'all' || filterType !== 'all') &&
            ` (${filteredAndSortedPositions.length} of ${positions.length})`}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search..."
            size="sm"
            className="w-32"
          />
          <Select
            value={filterChain}
            onChange={(e) => setFilterChain(e.target.value)}
            size="sm"
            options={[
              { value: 'all', label: 'All Chains' },
              ...uniqueChains.map(chain => ({ value: chain, label: chain }))
            ]}
          />
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            size="sm"
            options={[
              { value: 'all', label: 'All Types' },
              ...uniqueTypes.map(type => ({ value: type, label: getPositionTypeLabel(type) }))
            ]}
          />
          {positions.length > 0 && (
            <Button
              onClick={handleExportCSV}
              variant="ghost"
              size="xs"
            >
              Export CSV
            </Button>
          )}
          {isZapperConfigured && (
            <Button
              onClick={handleSyncFromZapper}
              variant="secondary"
              size="sm"
              loading={isSyncing}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync from Zapper'}
            </Button>
          )}
          {hasStorePositions && (
            <Button
              onClick={handleCalculateCostBasis}
              variant="secondary"
              size="sm"
              loading={isCalculatingCostBasis}
              disabled={isCalculatingCostBasis}
              title="Calculate cost basis from transaction history"
            >
              {isCalculatingCostBasis ? 'Calculating...' : 'Calculate Cost Basis'}
            </Button>
          )}
          <Button
            onClick={onAddPosition}
            variant="secondary"
            size="sm"
          >
            Add Position
          </Button>
        </div>
      </div>

      {/* Last sync info */}
      {lastZapperSync && (
        <div className="mb-4 text-xs text-surface-500">
          Last synced from Zapper: {lastZapperSync.toLocaleString()}
        </div>
      )}

      {isLoading || isSyncing ? (
        <SectionLoading message="Loading positions..." />
      ) : positions.length === 0 ? (
        <NoDataEmptyState onAction={onAddPosition} />
      ) : filteredAndSortedPositions.length === 0 ? (
        <NoResultsEmptyState
          searchTerm={searchQuery}
          onClear={clearFilters}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('protocol')}
                >
                  Protocol<SortIcon field="protocol" />
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('type')}
                >
                  Type<SortIcon field="type" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                  Assets
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                  Chain
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('value')}
                >
                  Value<SortIcon field="value" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                  P&L
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                  onClick={() => handleSort('apy')}
                >
                  APY<SortIcon field="apy" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                  Health
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPositions.map((position) => (
                <tr
                  key={position.id}
                  className="border-b border-surface-800 hover:bg-surface-800/50"
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-surface-100">
                      {position.protocol}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={getPositionTypeVariant(position.positionType)} size="sm">
                      {getPositionTypeLabel(position.positionType)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-surface-300">
                    {position.assets.join('/')}
                  </td>
                  <td className="py-3 px-4">
                    <Badge size="sm">{position.chain}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-100">
                    {formatCurrency(position.currentValueUsd)}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular">
                    {(() => {
                      const pnl = getPositionPnL(position.id);
                      if (!pnl || !pnl.hasCostBasis) {
                        return <span className="text-surface-500">-</span>;
                      }
                      const isProfit = pnl.unrealizedPnL.greaterThanOrEqualTo(0);
                      return (
                        <div>
                          <span className={isProfit ? 'text-profit' : 'text-loss'}>
                            {isProfit ? '+' : ''}{formatCurrency(pnl.unrealizedPnL)}
                          </span>
                          <span className={`text-xs ml-1 ${isProfit ? 'text-profit' : 'text-loss'}`}>
                            ({isProfit ? '+' : ''}{pnl.unrealizedPnLPercent.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-profit">
                    {position.apy && position.apy > 0 ? `${position.apy.toFixed(2)}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {position.healthFactor ? (
                      <span
                        className={`font-tabular ${
                          position.healthFactor > 2
                            ? 'text-profit'
                            : position.healthFactor > 1.5
                            ? 'text-warning'
                            : 'text-loss'
                        }`}
                      >
                        {position.healthFactor.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-surface-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {position.walletId === 'manual' && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleRemovePosition(position); }}
                        variant="ghost"
                        size="xs"
                        className="text-surface-500 hover:text-loss"
                        title="Remove position"
                      >
                        &times;
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
