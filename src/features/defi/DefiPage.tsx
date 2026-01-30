const mockPositions = [
  {
    id: '1',
    protocol: 'Uniswap V3',
    type: 'LP',
    pool: 'ETH/USDC',
    chain: 'Ethereum',
    value: 15000,
    apy: 12.5,
    rewards: 234,
    healthFactor: null,
  },
  {
    id: '2',
    protocol: 'Aave V3',
    type: 'Lending',
    pool: 'USDC Supply',
    chain: 'Arbitrum',
    value: 25000,
    apy: 4.2,
    rewards: 0,
    healthFactor: 2.8,
  },
  {
    id: '3',
    protocol: 'Pendle',
    type: 'PT',
    pool: 'stETH PT-26Dec2024',
    chain: 'Ethereum',
    value: 10000,
    apy: 8.5,
    rewards: 0,
    healthFactor: null,
  },
  {
    id: '4',
    protocol: 'EigenLayer',
    type: 'Restaking',
    pool: 'stETH',
    chain: 'Ethereum',
    value: 30000,
    apy: 0,
    rewards: 0,
    healthFactor: null,
    points: 12500,
  },
  {
    id: '5',
    protocol: 'Morpho',
    type: 'Vault',
    pool: 'USDC Vault',
    chain: 'Base',
    value: 8000,
    apy: 6.8,
    rewards: 45,
    healthFactor: null,
  },
];

const mockPoints = [
  { protocol: 'EigenLayer', points: 12500, estimatedValue: null },
  { protocol: 'Renzo', points: 8200, estimatedValue: 450 },
  { protocol: 'Ethena', points: 5600, estimatedValue: 280 },
  { protocol: 'Blast', points: 15000, estimatedValue: null },
];

export function DefiPage() {
  const totalValue = mockPositions.reduce((sum, p) => sum + p.value, 0);
  const avgApy = mockPositions.filter(p => p.apy > 0).reduce((sum, p) => sum + p.apy, 0) / mockPositions.filter(p => p.apy > 0).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total DeFi Value</p>
          <p className="text-2xl font-bold text-surface-100 font-tabular">
            ${totalValue.toLocaleString()}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Active Positions</p>
          <p className="text-2xl font-bold text-surface-100">{mockPositions.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Avg. APY</p>
          <p className="text-2xl font-bold text-profit">{avgApy.toFixed(1)}%</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Protocols</p>
          <p className="text-2xl font-bold text-surface-100">
            {new Set(mockPositions.map(p => p.protocol)).size}
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">DeFi Positions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Protocol</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Pool</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Chain</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Value</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">APY</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Health</th>
              </tr>
            </thead>
            <tbody>
              {mockPositions.map((position) => (
                <tr key={position.id} className="border-b border-surface-800 hover:bg-surface-800/50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-surface-100">{position.protocol}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      position.type === 'LP' ? 'bg-blue-500/20 text-blue-400' :
                      position.type === 'Lending' ? 'bg-green-500/20 text-green-400' :
                      position.type === 'PT' ? 'bg-purple-500/20 text-purple-400' :
                      position.type === 'Restaking' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-surface-700 text-surface-300'
                    }`}>
                      {position.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-surface-300">{position.pool}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 bg-surface-700 rounded text-xs text-surface-300">
                      {position.chain}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-100">
                    ${position.value.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-profit">
                    {position.apy > 0 ? `${position.apy}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {position.healthFactor ? (
                      <span className={`font-tabular ${
                        position.healthFactor > 2 ? 'text-profit' :
                        position.healthFactor > 1.5 ? 'text-warning' :
                        'text-loss'
                      }`}>
                        {position.healthFactor.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-surface-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Points Tracking */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Points & Airdrops</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockPoints.map((point) => (
            <div key={point.protocol} className="bg-surface-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-surface-100">{point.protocol}</span>
                <span className="text-xs text-surface-400">Points</span>
              </div>
              <p className="text-2xl font-bold text-primary-400 font-tabular">
                {point.points.toLocaleString()}
              </p>
              {point.estimatedValue && (
                <p className="text-sm text-surface-400 mt-1">
                  Est. ${point.estimatedValue.toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Risk Overview */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Risk Overview</h2>
        <div className="bg-surface-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-surface-400 mb-1">Lowest Health Factor</p>
              <p className="text-xl font-bold text-warning font-tabular">2.80</p>
              <p className="text-xs text-surface-500">Aave V3 - USDC Supply</p>
            </div>
            <div>
              <p className="text-sm text-surface-400 mb-1">IL Exposure</p>
              <p className="text-xl font-bold text-surface-100 font-tabular">$15,000</p>
              <p className="text-xs text-surface-500">1 LP position</p>
            </div>
            <div>
              <p className="text-sm text-surface-400 mb-1">PT Maturity</p>
              <p className="text-xl font-bold text-surface-100">26 Dec 2024</p>
              <p className="text-xs text-surface-500">Next expiring position</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
