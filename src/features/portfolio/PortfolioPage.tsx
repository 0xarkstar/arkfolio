import { useEffect, useState, useMemo } from 'react';
import { usePortfolioStore } from '../../stores/portfolioStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { useWalletsStore } from '../../stores/walletsStore';
import { useDefiStore } from '../../stores/defiStore';
import { excelExportService } from '../../services/export';
import { PortfolioChart, AssetAllocationChart, CategoryAllocationChart, PerformanceStats } from '../../components/charts';
import { toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { AssetAvatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/Skeleton';
import { NoDataEmptyState, NoResultsEmptyState } from '../../components/EmptyState';

type SortField = 'value' | 'change' | 'name' | 'amount';
type SortDirection = 'asc' | 'desc';

export function PortfolioPage() {
  const { summary, holdings, isLoading, lastRefresh, refreshPortfolio } = usePortfolioStore();
  const { accounts } = useExchangeStore();
  const { getTotalValueUsd: getWalletsTotalValue } = useWalletsStore();
  const { getTotalValueUsd: getDefiTotalValue } = useDefiStore();
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate category values
  const cexValue = summary.totalValueUsd.toNumber();
  const walletsValue = getWalletsTotalValue().toNumber();
  const defiValue = getDefiTotalValue().toNumber();

  // Refresh portfolio on mount and when accounts change
  useEffect(() => {
    refreshPortfolio();
  }, [refreshPortfolio, accounts.length]);

  const hasData = holdings.length > 0;
  const connectedExchanges = accounts.filter(a => a.isConnected).length;

  // Filter and sort holdings
  const filteredAndSortedHoldings = useMemo(() => {
    let filtered = holdings;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = holdings.filter(
        h => h.symbol.toLowerCase().includes(query) || h.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'value':
          comparison = a.valueUsd.minus(b.valueUsd).toNumber();
          break;
        case 'change':
          comparison = a.change24h - b.change24h;
          break;
        case 'name':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'amount':
          comparison = a.totalAmount.minus(b.totalAmount).toNumber();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [holdings, sortField, sortDirection, searchQuery]);

  const displayedHoldings = showAllHoldings ? filteredAndSortedHoldings : filteredAndSortedHoldings.slice(0, 10);

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
    if (holdings.length === 0) {
      toast.error('No holdings to export');
      return;
    }

    const headers = ['Symbol', 'Name', 'Amount', 'Value (USD)', '24h Change (%)'];
    const rows = holdings.map(h => [
      h.symbol,
      h.name,
      h.totalAmount.toString(),
      h.valueUsd.toFixed(2),
      h.change24h.toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Portfolio exported to CSV');
  };

  const handleExportExcel = async () => {
    if (holdings.length === 0) {
      toast.error('No holdings to export');
      return;
    }

    try {
      await excelExportService.exportPortfolio({
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          amount: h.totalAmount,
          priceUsd: h.priceUsd,
          valueUsd: h.valueUsd,
          allocation: summary.totalValueUsd.greaterThan(0)
            ? h.valueUsd.div(summary.totalValueUsd).times(100).toNumber()
            : 0,
          change24h: h.change24h,
        })),
        summary: {
          totalValueUsd: summary.totalValueUsd,
          assetCount: summary.totalAssets,
        },
      });

      toast.success('Portfolio exported to Excel');
    } catch {
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading && !hasData ? (
          <>
            <div className="md:col-span-2">
              <SkeletonCard />
            </div>
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="p-6 md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-surface-400 mb-1">Total Portfolio Value</p>
                  <p className="text-4xl font-bold text-surface-100 font-tabular">
                    {formatCurrency(summary.totalValueUsd.toNumber())}
                  </p>
                  <p className={`text-sm mt-2 ${summary.change24hPercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {summary.change24hPercent >= 0 ? '+' : ''}
                    {formatCurrency(summary.change24hUsd.toNumber())}
                    {' '}({summary.change24hPercent >= 0 ? '+' : ''}{summary.change24hPercent.toFixed(2)}%) 24h
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-500">Last updated</p>
                  <p className="text-sm text-surface-400">
                    {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
                  </p>
                  <div className="flex gap-2 mt-2 justify-end">
                    <Button
                      onClick={() => refreshPortfolio()}
                      disabled={isLoading}
                      variant="ghost"
                      size="xs"
                      loading={isLoading}
                    >
                      Refresh
                    </Button>
                    {hasData && (
                      <>
                        <Button
                          onClick={handleExportCSV}
                          variant="ghost"
                          size="xs"
                        >
                          Export CSV
                        </Button>
                        <Button
                          onClick={handleExportExcel}
                          variant="ghost"
                          size="xs"
                        >
                          Export Excel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-sm text-surface-400 mb-4">Quick Stats</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-surface-400">Assets</span>
                  <span className="text-surface-100 font-medium">{summary.totalAssets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Positions</span>
                  <span className="text-surface-100 font-medium">{summary.totalPositions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Exchanges</span>
                  <span className="text-surface-100 font-medium">{connectedExchanges}</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Empty State */}
      {!hasData && !isLoading && (
        <Card className="p-8">
          <NoDataEmptyState />
        </Card>
      )}

      {/* Portfolio Distribution (CEX / On-chain / DeFi) */}
      {(cexValue > 0 || walletsValue > 0 || defiValue > 0) && (
        <Card className="p-6">
          <CategoryAllocationChart
            cexValue={cexValue}
            onchainValue={walletsValue}
            defiValue={defiValue}
          />
        </Card>
      )}

      {/* Asset Allocation */}
      {hasData && (
        <Card className="p-6">
          <AssetAllocationChart
            data={holdings.map((h, i) => ({
              label: h.symbol,
              value: h.valueUsd.toNumber(),
              color: getAllocationColor(i),
            }))}
            title="Asset Allocation"
          />
        </Card>
      )}

      {/* Performance Stats */}
      {hasData && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-100 mb-4">Performance Summary</h3>
          <PerformanceStats
            totalReturn={summary.change24hUsd.toNumber() * 30} // Approximate monthly (placeholder)
            totalReturnPercent={summary.change24hPercent * 30}
            dayReturn={summary.change24hUsd.toNumber()}
            dayReturnPercent={summary.change24hPercent}
            weekReturn={summary.change24hUsd.toNumber() * 7}
            weekReturnPercent={summary.change24hPercent * 7}
            monthReturn={summary.change24hUsd.toNumber() * 30}
            monthReturnPercent={summary.change24hPercent * 30}
          />
        </Card>
      )}

      {/* Performance Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Historical Performance</h2>
        <PortfolioChart height={300} />
      </Card>

      {/* Top Holdings */}
      {hasData && (
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-surface-100">
              Holdings
              {searchQuery && (
                <span className="text-surface-400 font-normal text-sm ml-2">
                  ({filteredAndSortedHoldings.length} results)
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search assets..."
                size="sm"
                className="w-40"
              />
              <div className="flex items-center gap-1">
                {(['name', 'value', 'change'] as const).map((field) => (
                  <Button
                    key={field}
                    onClick={() => handleSort(field)}
                    variant={sortField === field ? 'primary' : 'ghost'}
                    size="xs"
                  >
                    {field === 'change' ? '24h' : field.charAt(0).toUpperCase() + field.slice(1)}
                    <SortIcon field={field} />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {filteredAndSortedHoldings.length === 0 && searchQuery ? (
            <NoResultsEmptyState
              searchTerm={searchQuery}
              onClear={() => setSearchQuery('')}
            />
          ) : (
            <>
              <div className="space-y-3">
                {displayedHoldings.map((holding) => (
                  <div
                    key={holding.symbol}
                    className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <AssetAvatar symbol={holding.symbol} size="sm" />
                      <div>
                        <p className="font-medium text-surface-100">{holding.symbol}</p>
                        <p className="text-xs text-surface-400">{holding.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-surface-100 font-tabular">
                        {formatCurrency(holding.valueUsd.toNumber())}
                      </p>
                      <p className="text-xs text-surface-400 font-tabular">
                        {formatAmount(holding.totalAmount.toNumber())} {holding.symbol}
                      </p>
                    </div>
                    <div className={`text-sm font-tabular w-16 text-right ${holding.change24h >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>

              {filteredAndSortedHoldings.length > 10 && (
                <div className="mt-4 text-center">
                  <Button
                    onClick={() => setShowAllHoldings(!showAllHoldings)}
                    variant="ghost"
                    size="sm"
                  >
                    {showAllHoldings ? 'Show top 10' : `View all ${filteredAndSortedHoldings.length} assets`}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Holdings by Exchange */}
      {hasData && holdings.some(h => h.sources.length > 1) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Holdings by Exchange</h2>
          <div className="space-y-4">
            {holdings.filter(h => h.sources.length > 1).slice(0, 5).map((holding) => (
              <div key={holding.symbol} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AssetAvatar symbol={holding.symbol} size="sm" />
                    <span className="font-medium text-surface-100">{holding.symbol}</span>
                    <Badge size="sm">{holding.sources.length} exchanges</Badge>
                  </div>
                  <span className="text-surface-400 font-tabular">
                    Total: {formatAmount(holding.totalAmount.toNumber())}
                  </span>
                </div>
                <div className="space-y-2">
                  {holding.sources.map((source, idx) => (
                    <div
                      key={`${source.exchangeId}-${idx}`}
                      className="flex justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-surface-400">{source.exchangeName}</span>
                        <Badge size="sm" variant="default">{source.balanceType}</Badge>
                      </div>
                      <span className="text-surface-300 font-tabular">
                        {formatAmount(source.amount.toNumber())}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  if (value >= 1) {
    return value.toFixed(4);
  }
  if (value >= 0.0001) {
    return value.toFixed(6);
  }
  return value.toFixed(8);
}

const ALLOCATION_COLORS = [
  '#7c3aed', // Purple
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
];

function getAllocationColor(index: number): string {
  return ALLOCATION_COLORS[index % ALLOCATION_COLORS.length];
}
