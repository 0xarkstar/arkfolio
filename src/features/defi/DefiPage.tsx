import { useEffect, useState } from 'react';
import { useDefiStore, DefiPosition } from '../../stores/defiStore';
import Decimal from 'decimal.js';

// Mock data for demonstration when no real data exists
const mockPositions: DefiPosition[] = [
  {
    id: '1',
    walletId: 'demo',
    protocol: 'Uniswap V3',
    positionType: 'lp',
    poolAddress: null,
    assets: ['ETH', 'USDC'],
    amounts: [new Decimal(2.5), new Decimal(5000)],
    costBasisUsd: new Decimal(14000),
    currentValueUsd: new Decimal(15000),
    rewardsEarned: {},
    apy: 12.5,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    updatedAt: new Date(),
  },
  {
    id: '2',
    walletId: 'demo',
    protocol: 'Aave V3',
    positionType: 'lending',
    poolAddress: null,
    assets: ['USDC'],
    amounts: [new Decimal(25000)],
    costBasisUsd: new Decimal(25000),
    currentValueUsd: new Decimal(25000),
    rewardsEarned: {},
    apy: 4.2,
    maturityDate: null,
    healthFactor: 2.8,
    chain: 'Arbitrum',
    updatedAt: new Date(),
  },
  {
    id: '3',
    walletId: 'demo',
    protocol: 'Pendle',
    positionType: 'pt',
    poolAddress: null,
    assets: ['stETH'],
    amounts: [new Decimal(5)],
    costBasisUsd: new Decimal(9500),
    currentValueUsd: new Decimal(10000),
    rewardsEarned: {},
    apy: 8.5,
    maturityDate: new Date('2024-12-26'),
    healthFactor: null,
    chain: 'Ethereum',
    updatedAt: new Date(),
  },
  {
    id: '4',
    walletId: 'demo',
    protocol: 'EigenLayer',
    positionType: 'restaking',
    poolAddress: null,
    assets: ['stETH'],
    amounts: [new Decimal(15)],
    costBasisUsd: new Decimal(28000),
    currentValueUsd: new Decimal(30000),
    rewardsEarned: {},
    apy: 0,
    maturityDate: null,
    healthFactor: null,
    chain: 'Ethereum',
    updatedAt: new Date(),
  },
  {
    id: '5',
    walletId: 'demo',
    protocol: 'Morpho',
    positionType: 'vault',
    poolAddress: null,
    assets: ['USDC'],
    amounts: [new Decimal(8000)],
    costBasisUsd: new Decimal(8000),
    currentValueUsd: new Decimal(8000),
    rewardsEarned: { MORPHO: new Decimal(45) },
    apy: 6.8,
    maturityDate: null,
    healthFactor: null,
    chain: 'Base',
    updatedAt: new Date(),
  },
];

const mockPoints = [
  { id: '1', protocol: 'EigenLayer', walletAddress: '', pointsBalance: new Decimal(12500), estimatedValueUsd: null, lastSync: null },
  { id: '2', protocol: 'Renzo', walletAddress: '', pointsBalance: new Decimal(8200), estimatedValueUsd: new Decimal(450), lastSync: null },
  { id: '3', protocol: 'Ethena', walletAddress: '', pointsBalance: new Decimal(5600), estimatedValueUsd: new Decimal(280), lastSync: null },
  { id: '4', protocol: 'Blast', walletAddress: '', pointsBalance: new Decimal(15000), estimatedValueUsd: null, lastSync: null },
];

export function DefiPage() {
  const {
    positions: storePositions,
    pointsBalances: storePoints,
    isLoading,
    loadPositions,
    loadPoints,
    getTotalValueUsd,
    getAverageApy,
    getLowestHealthFactor,
  } = useDefiStore();

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadPositions();
    loadPoints();
  }, [loadPositions, loadPoints]);

  // Use store data if available, otherwise show mock data for demo
  const positions = storePositions.length > 0 ? storePositions : mockPositions;
  const pointsBalances = storePoints.length > 0 ? storePoints : mockPoints;

  const totalValue = storePositions.length > 0
    ? getTotalValueUsd().toNumber()
    : mockPositions.reduce((sum, p) => sum + p.currentValueUsd.toNumber(), 0);

  const avgApy = storePositions.length > 0
    ? getAverageApy()
    : positions.filter((p) => p.apy && p.apy > 0).reduce((sum, p) => sum + (p.apy || 0), 0) /
      positions.filter((p) => p.apy && p.apy > 0).length;

  const lowestHealth = storePositions.length > 0 ? getLowestHealthFactor() : null;

  const formatCurrency = (value: number | Decimal) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getPositionTypeColor = (type: string) => {
    switch (type) {
      case 'lp':
        return 'bg-blue-500/20 text-blue-400';
      case 'lending':
        return 'bg-green-500/20 text-green-400';
      case 'borrowing':
        return 'bg-red-500/20 text-red-400';
      case 'pt':
      case 'yt':
        return 'bg-purple-500/20 text-purple-400';
      case 'restaking':
        return 'bg-orange-500/20 text-orange-400';
      case 'staking':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'vault':
      default:
        return 'bg-surface-700 text-surface-300';
    }
  };

  const getPositionTypeLabel = (type: string) => {
    switch (type) {
      case 'lp':
        return 'LP';
      case 'lending':
        return 'Lending';
      case 'borrowing':
        return 'Borrowing';
      case 'pt':
        return 'PT';
      case 'yt':
        return 'YT';
      case 'restaking':
        return 'Restaking';
      case 'staking':
        return 'Staking';
      case 'vault':
        return 'Vault';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total DeFi Value</p>
          <p className="text-2xl font-bold text-surface-100 font-tabular">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Active Positions</p>
          <p className="text-2xl font-bold text-surface-100">{positions.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Avg. APY</p>
          <p className="text-2xl font-bold text-profit">
            {isNaN(avgApy) ? '-' : `${avgApy.toFixed(1)}%`}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Protocols</p>
          <p className="text-2xl font-bold text-surface-100">
            {new Set(positions.map((p) => p.protocol)).size}
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-100">DeFi Positions</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary text-sm"
          >
            Add Position
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-surface-400">Loading positions...</div>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">&#127793;</div>
            <p className="text-surface-400 mb-2">No DeFi positions tracked</p>
            <p className="text-surface-500 text-sm">
              Add your wallet addresses to track DeFi positions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Protocol
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Assets
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Chain
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Value
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    APY
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Health
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
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
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getPositionTypeColor(
                          position.positionType
                        )}`}
                      >
                        {getPositionTypeLabel(position.positionType)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-surface-300">
                      {position.assets.join('/')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-surface-700 rounded text-xs text-surface-300">
                        {position.chain}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-tabular text-surface-100">
                      {formatCurrency(position.currentValueUsd)}
                    </td>
                    <td className="py-3 px-4 text-right font-tabular text-profit">
                      {position.apy && position.apy > 0 ? `${position.apy}%` : '-'}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Points Tracking */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Points & Airdrops</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pointsBalances.map((point) => (
            <div key={point.id} className="bg-surface-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-surface-100">{point.protocol}</span>
                <span className="text-xs text-surface-400">Points</span>
              </div>
              <p className="text-2xl font-bold text-primary-400 font-tabular">
                {point.pointsBalance.toNumber().toLocaleString()}
              </p>
              {point.estimatedValueUsd && (
                <p className="text-sm text-surface-400 mt-1">
                  Est. {formatCurrency(point.estimatedValueUsd)}
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
              {lowestHealth ? (
                <>
                  <p
                    className={`text-xl font-bold font-tabular ${
                      lowestHealth.value > 2
                        ? 'text-profit'
                        : lowestHealth.value > 1.5
                        ? 'text-warning'
                        : 'text-loss'
                    }`}
                  >
                    {lowestHealth.value.toFixed(2)}
                  </p>
                  <p className="text-xs text-surface-500">
                    {lowestHealth.position.protocol} - {lowestHealth.position.assets.join('/')}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-warning font-tabular">2.80</p>
                  <p className="text-xs text-surface-500">Aave V3 - USDC Supply</p>
                </>
              )}
            </div>
            <div>
              <p className="text-sm text-surface-400 mb-1">IL Exposure</p>
              <p className="text-xl font-bold text-surface-100 font-tabular">
                {formatCurrency(
                  positions
                    .filter((p) => p.positionType === 'lp')
                    .reduce((sum, p) => sum + p.currentValueUsd.toNumber(), 0)
                )}
              </p>
              <p className="text-xs text-surface-500">
                {positions.filter((p) => p.positionType === 'lp').length} LP position(s)
              </p>
            </div>
            <div>
              <p className="text-sm text-surface-400 mb-1">PT Maturity</p>
              {(() => {
                const ptPositions = positions.filter(
                  (p) => p.positionType === 'pt' && p.maturityDate
                );
                if (ptPositions.length === 0) {
                  return (
                    <>
                      <p className="text-xl font-bold text-surface-100">-</p>
                      <p className="text-xs text-surface-500">No PT positions</p>
                    </>
                  );
                }
                const nextMaturity = ptPositions
                  .map((p) => p.maturityDate!)
                  .sort((a, b) => a.getTime() - b.getTime())[0];
                return (
                  <>
                    <p className="text-xl font-bold text-surface-100">
                      {nextMaturity.toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-surface-500">Next expiring position</p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      {storePositions.length === 0 && (
        <div className="card p-6 border-primary-600/30 bg-primary-600/5">
          <h3 className="text-lg font-semibold text-surface-100 mb-2">
            DeFi Position Tracking
          </h3>
          <p className="text-surface-400 text-sm mb-4">
            Automatic DeFi position detection is coming soon. Currently showing demo data.
            <br />
            Supported protocols: Uniswap, Aave, Morpho, Pendle, EigenLayer, and more.
          </p>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setShowAddModal(true)}>
              Add Position Manually
            </button>
          </div>
        </div>
      )}

      {/* Add Position Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-surface-100">Add DeFi Position</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-surface-400 hover:text-surface-100 text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="text-center py-8">
              <div className="text-4xl mb-4">&#128679;</div>
              <p className="text-surface-400 mb-2">Manual position entry coming soon</p>
              <p className="text-surface-500 text-sm">
                Automatic detection via wallet address will be available in a future update.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="btn-secondary w-full mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
