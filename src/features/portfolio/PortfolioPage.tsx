import { useExchangeStore } from '../../stores/exchangeStore';

export function PortfolioPage() {
  const { getAggregatedBalances, allPositions } = useExchangeStore();
  const balances = getAggregatedBalances();

  // Mock data for portfolio overview
  const portfolioSummary = {
    totalValue: 125432.56,
    change24h: 2341.23,
    changePercent: 1.9,
  };

  const assetAllocation = [
    { name: 'Bitcoin', symbol: 'BTC', value: 52000, percent: 41.5, color: 'bg-orange-500' },
    { name: 'Ethereum', symbol: 'ETH', value: 35000, percent: 27.9, color: 'bg-blue-500' },
    { name: 'Stablecoins', symbol: 'USD', value: 25000, percent: 19.9, color: 'bg-green-500' },
    { name: 'Others', symbol: 'ALT', value: 13432, percent: 10.7, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-surface-400 mb-1">Total Portfolio Value</p>
              <p className="text-4xl font-bold text-surface-100 font-tabular">
                ${portfolioSummary.totalValue.toLocaleString()}
              </p>
              <p className={`text-sm mt-2 ${portfolioSummary.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                {portfolioSummary.change24h >= 0 ? '+' : ''}${portfolioSummary.change24h.toLocaleString()}
                {' '}({portfolioSummary.changePercent >= 0 ? '+' : ''}{portfolioSummary.changePercent}%) 24h
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">As of</p>
              <p className="text-sm text-surface-400">{new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <p className="text-sm text-surface-400 mb-4">Quick Stats</p>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-surface-400">Assets</span>
              <span className="text-surface-100 font-medium">{balances.length || 12}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Positions</span>
              <span className="text-surface-100 font-medium">{allPositions.size || 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Exchanges</span>
              <span className="text-surface-100 font-medium">2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Asset Allocation</h2>

        {/* Progress bar */}
        <div className="h-4 rounded-full overflow-hidden flex mb-4">
          {assetAllocation.map((asset) => (
            <div
              key={asset.symbol}
              className={`${asset.color} transition-all`}
              style={{ width: `${asset.percent}%` }}
              title={`${asset.name}: ${asset.percent}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {assetAllocation.map((asset) => (
            <div key={asset.symbol} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${asset.color}`} />
              <div>
                <p className="text-sm font-medium text-surface-100">{asset.name}</p>
                <p className="text-xs text-surface-400">
                  ${asset.value.toLocaleString()} ({asset.percent}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-100">Performance</h2>
          <div className="flex gap-2">
            {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((period) => (
              <button
                key={period}
                className={`px-3 py-1 text-sm rounded ${
                  period === '1M'
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-100'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Chart placeholder */}
        <div className="h-64 bg-surface-800 rounded-lg flex items-center justify-center">
          <p className="text-surface-500">Chart will be implemented with TradingView Lightweight Charts</p>
        </div>
      </div>

      {/* Top Holdings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Top Holdings</h2>
        <div className="space-y-3">
          {[
            { symbol: 'BTC', name: 'Bitcoin', amount: '0.8521', value: 52000, change: 2.3 },
            { symbol: 'ETH', name: 'Ethereum', amount: '12.5', value: 35000, change: -1.2 },
            { symbol: 'USDT', name: 'Tether', amount: '15000', value: 15000, change: 0 },
            { symbol: 'USDC', name: 'USD Coin', amount: '10000', value: 10000, change: 0 },
            { symbol: 'SOL', name: 'Solana', amount: '85.2', value: 8500, change: 5.4 },
          ].map((holding) => (
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
                  ${holding.value.toLocaleString()}
                </p>
                <p className="text-xs text-surface-400 font-tabular">
                  {holding.amount} {holding.symbol}
                </p>
              </div>
              <div className={`text-sm font-tabular ${holding.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                {holding.change >= 0 ? '+' : ''}{holding.change}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
