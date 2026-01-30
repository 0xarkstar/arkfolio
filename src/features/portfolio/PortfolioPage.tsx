import { useEffect } from 'react';
import { usePortfolioStore } from '../../stores/portfolioStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { PortfolioChart } from '../../components/charts';

export function PortfolioPage() {
  const { summary, holdings, allocations, isLoading, lastRefresh, refreshPortfolio } = usePortfolioStore();
  const { accounts } = useExchangeStore();

  // Refresh portfolio on mount and when accounts change
  useEffect(() => {
    refreshPortfolio();
  }, [refreshPortfolio, accounts.length]);

  const hasData = holdings.length > 0;
  const connectedExchanges = accounts.filter(a => a.isConnected).length;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-surface-400 mb-1">Total Portfolio Value</p>
              <p className="text-4xl font-bold text-surface-100 font-tabular">
                {formatCurrency(summary.totalValueUsd.toNumber())}
              </p>
              <p className={`text-sm mt-2 ${summary.change24hPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
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
              <button
                onClick={() => refreshPortfolio()}
                disabled={isLoading}
                className="mt-2 text-xs text-primary-400 hover:text-primary-300 disabled:opacity-50"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="card p-6">
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
        </div>
      </div>

      {/* Empty State */}
      {!hasData && !isLoading && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-surface-100 mb-2">No Portfolio Data</h3>
          <p className="text-surface-400 mb-4">
            Connect an exchange and sync your balances to see your portfolio.
          </p>
        </div>
      )}

      {/* Asset Allocation */}
      {hasData && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Asset Allocation</h2>

          {/* Progress bar */}
          <div className="h-4 rounded-full overflow-hidden flex mb-4">
            {allocations.map((allocation) => (
              <div
                key={allocation.category}
                className={`${allocation.color} transition-all`}
                style={{ width: `${allocation.percent}%` }}
                title={`${allocation.category}: ${allocation.percent.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allocations.map((allocation) => (
              <div key={allocation.category} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${allocation.color}`} />
                <div>
                  <p className="text-sm font-medium text-surface-100">{allocation.category}</p>
                  <p className="text-xs text-surface-400">
                    {formatCurrency(allocation.value.toNumber())} ({allocation.percent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Performance</h2>
        <PortfolioChart height={300} />
      </div>

      {/* Top Holdings */}
      {hasData && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Top Holdings</h2>
          <div className="space-y-3">
            {holdings.slice(0, 10).map((holding) => (
              <div
                key={holding.symbol}
                className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {holding.symbol.slice(0, 2)}
                  </div>
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
                <div className={`text-sm font-tabular w-16 text-right ${holding.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>

          {holdings.length > 10 && (
            <div className="mt-4 text-center">
              <button className="text-sm text-primary-400 hover:text-primary-300">
                View all {holdings.length} assets
              </button>
            </div>
          )}
        </div>
      )}

      {/* Holdings by Exchange */}
      {hasData && holdings.some(h => h.sources.length > 1) && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Holdings by Exchange</h2>
          <div className="space-y-4">
            {holdings.filter(h => h.sources.length > 1).slice(0, 5).map((holding) => (
              <div key={holding.symbol} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-100">{holding.symbol}</span>
                    <span className="text-xs text-surface-500">
                      ({holding.sources.length} exchanges)
                    </span>
                  </div>
                  <span className="text-surface-400">
                    Total: {formatAmount(holding.totalAmount.toNumber())}
                  </span>
                </div>
                <div className="space-y-2">
                  {holding.sources.map((source, idx) => (
                    <div
                      key={`${source.exchangeId}-${idx}`}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-surface-400">
                        {source.exchangeName}
                        <span className="text-surface-600 ml-1">({source.balanceType})</span>
                      </span>
                      <span className="text-surface-300 font-tabular">
                        {formatAmount(source.amount.toNumber())}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
