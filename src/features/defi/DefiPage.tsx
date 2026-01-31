import { useEffect, useState, useMemo } from 'react';
import { useDefiStore, DefiPosition } from '../../stores/defiStore';
import { useWalletsStore } from '../../stores/walletsStore';
import { toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Select, Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Modal, ModalFooter } from '../../components/Modal';
import { SkeletonCard, SectionLoading } from '../../components/Skeleton';
import { NoDataEmptyState, NoResultsEmptyState } from '../../components/EmptyState';
import { Decimal, parseDecimal, toDecimal, toDisplayNumber } from '../../utils/decimal';
import { ILCalculator } from './components';

type SortField = 'protocol' | 'value' | 'apy' | 'type';
type SortDirection = 'asc' | 'desc';

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
    entryDate: new Date('2024-01-15'),
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
    entryDate: new Date('2024-02-20'),
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
    entryDate: new Date('2024-03-10'),
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
    entryDate: new Date('2024-04-01'),
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
    entryDate: new Date('2024-05-15'),
    updatedAt: new Date(),
  },
];

const mockPoints = [
  { id: '1', protocol: 'EigenLayer', walletAddress: '', pointsBalance: new Decimal(12500), estimatedValueUsd: null, lastSync: null },
  { id: '2', protocol: 'Renzo', walletAddress: '', pointsBalance: new Decimal(8200), estimatedValueUsd: new Decimal(450), lastSync: null },
  { id: '3', protocol: 'Ethena', walletAddress: '', pointsBalance: new Decimal(5600), estimatedValueUsd: new Decimal(280), lastSync: null },
  { id: '4', protocol: 'Blast', walletAddress: '', pointsBalance: new Decimal(15000), estimatedValueUsd: null, lastSync: null },
];

const POSITION_TYPES = [
  { value: 'lending', label: 'Lending' },
  { value: 'borrowing', label: 'Borrowing' },
  { value: 'lp', label: 'Liquidity Pool' },
  { value: 'staking', label: 'Staking' },
  { value: 'vault', label: 'Vault' },
  { value: 'pt', label: 'Principal Token (PT)' },
  { value: 'yt', label: 'Yield Token (YT)' },
  { value: 'restaking', label: 'Restaking' },
];

const CHAINS = ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'BSC', 'Avalanche', 'Solana'];

const PROTOCOLS = [
  'Aave V3', 'Compound', 'Morpho', 'Spark', // Lending
  'Uniswap V3', 'Uniswap V2', 'SushiSwap', 'Curve', 'Balancer', // DEX
  'Pendle', 'Convex', 'Yearn', // Yield
  'EigenLayer', 'Lido', 'Rocket Pool', // Staking
  'Other',
];

export function DefiPage() {
  const {
    positions: storePositions,
    pointsBalances: storePoints,
    isLoading,
    isSyncing,
    isCalculatingCostBasis,
    lastZapperSync,
    loadPositions,
    loadPoints,
    getTotalValueUsd,
    getTotalCostBasisUsd,
    getTotalUnrealizedPnL,
    getAverageApy,
    getLowestHealthFactor,
    getPositionPnL,
    addPosition,
    removePosition,
    addPoints,
    syncFromZapper,
    calculateAllCostBasis,
    isZapperConfigured,
  } = useDefiStore();

  const { wallets: storedWallets, loadWallets } = useWalletsStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [positionToRemove, setPositionToRemove] = useState<DefiPosition | null>(null);

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterChain, setFilterChain] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [formProtocol, setFormProtocol] = useState('Aave V3');
  const [formType, setFormType] = useState<DefiPosition['positionType']>('lending');
  const [formChain, setFormChain] = useState('Ethereum');
  const [formAssets, setFormAssets] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formCostBasis, setFormCostBasis] = useState('');
  const [formApy, setFormApy] = useState('');
  const [formHealthFactor, setFormHealthFactor] = useState('');

  // Points form state
  const [pointsProtocol, setPointsProtocol] = useState('');
  const [pointsBalance, setPointsBalance] = useState('');
  const [pointsEstValue, setPointsEstValue] = useState('');

  const resetPointsForm = () => {
    setPointsProtocol('');
    setPointsBalance('');
    setPointsEstValue('');
    setAddError(null);
  };

  const resetForm = () => {
    setFormProtocol('Aave V3');
    setFormType('lending');
    setFormChain('Ethereum');
    setFormAssets('');
    setFormAmount('');
    setFormValue('');
    setFormCostBasis('');
    setFormApy('');
    setFormHealthFactor('');
    setAddError(null);
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      const assets = formAssets.split(',').map(a => a.trim().toUpperCase()).filter(a => a);
      const amount = parseDecimal(formAmount);
      const value = parseDecimal(formValue);
      const costBasis = formCostBasis ? parseDecimal(formCostBasis) : value;
      const apy = formApy ? toDisplayNumber(parseDecimal(formApy)) : null;
      const healthFactor = formHealthFactor ? toDisplayNumber(parseDecimal(formHealthFactor)) : null;

      if (assets.length === 0) {
        throw new Error('Please enter at least one asset');
      }

      if (value.lessThanOrEqualTo(0)) {
        throw new Error('Please enter a valid current value');
      }

      await addPosition({
        walletId: 'manual',
        protocol: formProtocol,
        positionType: formType,
        poolAddress: null,
        assets,
        amounts: [amount],
        costBasisUsd: costBasis,
        currentValueUsd: value,
        rewardsEarned: {},
        apy,
        maturityDate: null,
        healthFactor,
        chain: formChain,
        entryDate: null,
      });

      toast.success(`Added ${formProtocol} position`);
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add position';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePosition = (position: DefiPosition) => {
    setPositionToRemove(position);
  };

  const confirmRemovePosition = async () => {
    if (positionToRemove) {
      await removePosition(positionToRemove.id);
      toast.info('Position removed');
      setPositionToRemove(null);
    }
  };

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      if (!pointsProtocol.trim()) {
        throw new Error('Please enter a protocol name');
      }

      const balance = parseDecimal(pointsBalance);
      if (balance.lessThanOrEqualTo(0)) {
        throw new Error('Please enter a valid points balance');
      }

      const estValue = pointsEstValue ? parseDecimal(pointsEstValue) : null;

      await addPoints({
        protocol: pointsProtocol.trim(),
        walletAddress: '',
        pointsBalance: balance,
        estimatedValueUsd: estValue,
        lastSync: new Date(),
      });

      toast.success(`Added ${pointsProtocol} points`);
      setShowPointsModal(false);
      resetPointsForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add points';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    loadPositions();
    loadPoints();
    loadWallets();
  }, [loadPositions, loadPoints, loadWallets]);

  const handleSyncFromZapper = async () => {
    try {
      await syncFromZapper();
      toast.success('DeFi positions synced successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync positions';
      toast.error(message);
    }
  };

  const handleCalculateCostBasis = async () => {
    // Get unique wallet IDs from positions (excluding manual entries)
    const positionWalletIds = [...new Set(storePositions.map(p => p.walletId).filter(id => id !== 'manual'))];
    if (positionWalletIds.length === 0) {
      toast.error('No wallet addresses found. Sync positions first.');
      return;
    }

    // Map wallet IDs to actual addresses
    const walletAddresses = positionWalletIds
      .map(walletId => {
        const wallet = storedWallets.find(w => w.id === walletId);
        return wallet?.address;
      })
      .filter((addr): addr is string => !!addr);

    if (walletAddresses.length === 0) {
      toast.error('Could not find wallet addresses. Please sync wallets first.');
      return;
    }

    try {
      toast.info('Calculating cost basis from Zapper transaction history...');
      for (const address of walletAddresses) {
        await calculateAllCostBasis(address);
      }
      toast.success('Cost basis calculated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate cost basis';
      toast.error(message);
    }
  };

  // Use store data if available, otherwise show mock data for demo (only if Zapper not configured)
  const showMockData = storePositions.length === 0 && !isZapperConfigured();
  const positions = storePositions.length > 0 ? storePositions : (showMockData ? mockPositions : []);
  const pointsBalances = storePoints.length > 0 ? storePoints : (showMockData ? mockPoints : []);

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

  const totalValue = storePositions.length > 0
    ? toDisplayNumber(getTotalValueUsd())
    : mockPositions.reduce((sum, p) => sum + toDisplayNumber(p.currentValueUsd), 0);

  const avgApy = storePositions.length > 0
    ? getAverageApy()
    : positions.filter((p) => p.apy && p.apy > 0).reduce((sum, p) => sum + (p.apy || 0), 0) /
      positions.filter((p) => p.apy && p.apy > 0).length;

  const lowestHealth = storePositions.length > 0 ? getLowestHealthFactor() : null;

  const formatCurrency = (value: number | Decimal) => {
    const num = toDisplayNumber(toDecimal(value));
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
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

  const getPositionTypeVariant = (type: string): 'info' | 'success' | 'danger' | 'warning' | 'default' => {
    switch (type) {
      case 'lp':
        return 'info';
      case 'lending':
        return 'success';
      case 'borrowing':
        return 'danger';
      case 'pt':
      case 'yt':
      case 'restaking':
        return 'warning';
      case 'staking':
      case 'vault':
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading && positions.length === 0 ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total DeFi Value</p>
              <p className="text-2xl font-bold text-surface-100 font-tabular">
                {formatCurrency(totalValue)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Unrealized P&L</p>
              {(() => {
                const { pnl, percent } = getTotalUnrealizedPnL();
                const hasCostBasis = getTotalCostBasisUsd().greaterThan(0);
                if (!hasCostBasis) {
                  return <p className="text-2xl font-bold text-surface-500">-</p>;
                }
                const isProfit = pnl.greaterThanOrEqualTo(0);
                return (
                  <div>
                    <p className={`text-2xl font-bold font-tabular ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pnl)}
                    </p>
                    <p className={`text-xs ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{percent.toFixed(2)}%
                    </p>
                  </div>
                );
              })()}
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Avg. APY</p>
              <p className="text-2xl font-bold text-profit">
                {isNaN(avgApy) ? '-' : `${avgApy.toFixed(1)}%`}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Positions / Protocols</p>
              <p className="text-2xl font-bold text-surface-100">
                {positions.length} / {new Set(positions.map((p) => p.protocol)).size}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Positions Table */}
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
            {isZapperConfigured() && (
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
            {storePositions.length > 0 && (
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
              onClick={() => setShowAddModal(true)}
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
          <NoDataEmptyState onAction={() => setShowAddModal(true)} />
        ) : filteredAndSortedPositions.length === 0 ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setFilterChain('all');
              setFilterType('all');
            }}
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

      {/* Points Tracking */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-100">Points & Airdrops</h2>
          <Button
            onClick={() => setShowPointsModal(true)}
            variant="secondary"
            size="sm"
          >
            Add Points
          </Button>
        </div>
        {pointsBalances.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">&#11088;</div>
            <p className="text-surface-400 mb-2">No points tracked</p>
            <p className="text-surface-500 text-sm">
              Track your protocol points and potential airdrops.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pointsBalances.map((point) => (
              <div key={point.id} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-surface-100">{point.protocol}</span>
                  <Badge size="sm">Points</Badge>
                </div>
                <p className="text-2xl font-bold text-primary-400 font-tabular">
                  {toDisplayNumber(point.pointsBalance).toLocaleString()}
                </p>
                {point.estimatedValueUsd && (
                  <p className="text-sm text-surface-400 mt-1">
                    Est. {formatCurrency(point.estimatedValueUsd)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* IL & Risk Analysis */}
      {positions.length > 0 && (
        <ILCalculator positions={positions} />
      )}

      {/* Risk Overview */}
      <Card className="p-6">
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
                    .reduce((sum, p) => sum + toDisplayNumber(p.currentValueUsd), 0)
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
      </Card>

      {/* Setup Notice */}
      {storePositions.length === 0 && (
        <Card className="p-6 border-primary-600/30 bg-primary-600/5">
          <h3 className="text-lg font-semibold text-surface-100 mb-2">
            DeFi Position Tracking
          </h3>
          {!isZapperConfigured() ? (
            <>
              <p className="text-surface-400 text-sm mb-4">
                To automatically detect your DeFi positions, set up your Zapper API key in Settings.
                <br />
                Supported protocols: Uniswap, Aave, Morpho, Pendle, EigenLayer, and more.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => window.location.hash = '#/settings'}
                >
                  Go to Settings
                </Button>
                <Button variant="secondary" onClick={() => setShowAddModal(true)}>
                  Add Position Manually
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-surface-400 text-sm mb-4">
                Click "Sync from Zapper" to detect your DeFi positions automatically.
                <br />
                Make sure you have wallets connected in the Wallets page.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleSyncFromZapper}
                  loading={isSyncing}
                  disabled={isSyncing}
                >
                  Sync from Zapper
                </Button>
                <Button variant="secondary" onClick={() => setShowAddModal(true)}>
                  Add Position Manually
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Add Position Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title="Add DeFi Position"
        size="lg"
      >
        {addError && (
          <Alert variant="error" className="mb-4">
            {addError}
          </Alert>
        )}

        <form onSubmit={handleAddPosition} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Protocol"
              value={formProtocol}
              onChange={(e) => setFormProtocol(e.target.value)}
              options={PROTOCOLS.map(p => ({ value: p, label: p }))}
            />

            <Select
              label="Position Type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as DefiPosition['positionType'])}
              options={POSITION_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
          </div>

          <Select
            label="Chain"
            value={formChain}
            onChange={(e) => setFormChain(e.target.value)}
            options={CHAINS.map(c => ({ value: c, label: c }))}
          />

          <Input
            label="Assets (comma separated)"
            type="text"
            value={formAssets}
            onChange={(e) => setFormAssets(e.target.value)}
            placeholder="ETH, USDC"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount (primary asset)"
              type="number"
              step="any"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
            />

            <Input
              label="Current Value (USD)"
              type="number"
              step="any"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cost Basis (USD)"
              type="number"
              step="any"
              value={formCostBasis}
              onChange={(e) => setFormCostBasis(e.target.value)}
              placeholder="Optional"
            />

            <Input
              label="APY (%)"
              type="number"
              step="any"
              value={formApy}
              onChange={(e) => setFormApy(e.target.value)}
              placeholder="Optional"
            />

            <Input
              label="Health Factor"
              type="number"
              step="any"
              value={formHealthFactor}
              onChange={(e) => setFormHealthFactor(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              onClick={() => { setShowAddModal(false); resetForm(); }}
              variant="secondary"
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isAdding}
              loading={isAdding}
            >
              Add Position
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Add Points Modal */}
      <Modal
        isOpen={showPointsModal}
        onClose={() => { setShowPointsModal(false); resetPointsForm(); }}
        title="Add Points"
        size="md"
      >
        {addError && (
          <Alert variant="error" className="mb-4">
            {addError}
          </Alert>
        )}

        <form onSubmit={handleAddPoints} className="space-y-4">
          <Input
            label="Protocol Name"
            type="text"
            value={pointsProtocol}
            onChange={(e) => setPointsProtocol(e.target.value)}
            placeholder="e.g., EigenLayer, Renzo, Ethena"
            required
          />

          <Input
            label="Points Balance"
            type="number"
            step="any"
            value={pointsBalance}
            onChange={(e) => setPointsBalance(e.target.value)}
            placeholder="0"
            required
          />

          <Input
            label="Estimated Value (USD) - Optional"
            hint="Your estimate of the potential airdrop value"
            type="number"
            step="any"
            value={pointsEstValue}
            onChange={(e) => setPointsEstValue(e.target.value)}
            placeholder="0.00"
          />

          <ModalFooter>
            <Button
              type="button"
              onClick={() => { setShowPointsModal(false); resetPointsForm(); }}
              variant="secondary"
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isAdding}
              loading={isAdding}
            >
              Add Points
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Remove Position Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!positionToRemove}
        title="Remove Position"
        message={`Are you sure you want to remove this ${positionToRemove?.protocol} position?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemovePosition}
        onCancel={() => setPositionToRemove(null)}
      />
    </div>
  );
}
