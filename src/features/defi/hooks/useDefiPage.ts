import { useEffect, useState, useCallback } from 'react';
import { useDefiStore, DefiPosition } from '../../../stores/defiStore';
import { useWalletsStore } from '../../../stores/walletsStore';
import { toast } from '../../../components/Toast';
import { parseDecimal, toDisplayNumber } from '../../../utils/decimal';

export type SortField = 'protocol' | 'value' | 'apy' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface AddPositionFormData {
  protocol: string;
  type: DefiPosition['positionType'];
  chain: string;
  assets: string;
  amount: string;
  value: string;
  costBasis: string;
  apy: string;
  healthFactor: string;
}

export interface AddPointsFormData {
  protocol: string;
  balance: string;
  estValue: string;
}

export function useDefiPage() {
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

  // Modal state
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

  // Position form state
  const [positionForm, setPositionForm] = useState<AddPositionFormData>({
    protocol: 'Aave V3',
    type: 'lending',
    chain: 'Ethereum',
    assets: '',
    amount: '',
    value: '',
    costBasis: '',
    apy: '',
    healthFactor: '',
  });

  // Points form state
  const [pointsForm, setPointsForm] = useState<AddPointsFormData>({
    protocol: '',
    balance: '',
    estValue: '',
  });

  const resetPointsForm = useCallback(() => {
    setPointsForm({ protocol: '', balance: '', estValue: '' });
    setAddError(null);
  }, []);

  const resetPositionForm = useCallback(() => {
    setPositionForm({
      protocol: 'Aave V3',
      type: 'lending',
      chain: 'Ethereum',
      assets: '',
      amount: '',
      value: '',
      costBasis: '',
      apy: '',
      healthFactor: '',
    });
    setAddError(null);
  }, []);

  const handleAddPosition = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      const assets = positionForm.assets.split(',').map(a => a.trim().toUpperCase()).filter(a => a);
      const amount = parseDecimal(positionForm.amount);
      const value = parseDecimal(positionForm.value);
      const costBasis = positionForm.costBasis ? parseDecimal(positionForm.costBasis) : value;
      const apy = positionForm.apy ? toDisplayNumber(parseDecimal(positionForm.apy)) : null;
      const healthFactor = positionForm.healthFactor ? toDisplayNumber(parseDecimal(positionForm.healthFactor)) : null;

      if (assets.length === 0) {
        throw new Error('Please enter at least one asset');
      }

      if (value.lessThanOrEqualTo(0)) {
        throw new Error('Please enter a valid current value');
      }

      await addPosition({
        walletId: 'manual',
        protocol: positionForm.protocol,
        positionType: positionForm.type,
        poolAddress: null,
        assets,
        amounts: [amount],
        costBasisUsd: costBasis,
        currentValueUsd: value,
        rewardsEarned: {},
        apy,
        maturityDate: null,
        healthFactor,
        chain: positionForm.chain,
        entryDate: null,
      });

      toast.success(`Added ${positionForm.protocol} position`);
      setShowAddModal(false);
      resetPositionForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add position';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  }, [positionForm, addPosition, resetPositionForm]);

  const handleRemovePosition = useCallback((position: DefiPosition) => {
    setPositionToRemove(position);
  }, []);

  const confirmRemovePosition = useCallback(async () => {
    if (positionToRemove) {
      await removePosition(positionToRemove.id);
      toast.info('Position removed');
      setPositionToRemove(null);
    }
  }, [positionToRemove, removePosition]);

  const handleAddPoints = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddError(null);

    try {
      if (!pointsForm.protocol.trim()) {
        throw new Error('Please enter a protocol name');
      }

      const balance = parseDecimal(pointsForm.balance);
      if (balance.lessThanOrEqualTo(0)) {
        throw new Error('Please enter a valid points balance');
      }

      const estValue = pointsForm.estValue ? parseDecimal(pointsForm.estValue) : null;

      await addPoints({
        protocol: pointsForm.protocol.trim(),
        walletAddress: '',
        pointsBalance: balance,
        estimatedValueUsd: estValue,
        lastSync: new Date(),
      });

      toast.success(`Added ${pointsForm.protocol} points`);
      setShowPointsModal(false);
      resetPointsForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add points';
      setAddError(message);
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  }, [pointsForm, addPoints, resetPointsForm]);

  useEffect(() => {
    loadPositions();
    loadPoints();
    loadWallets();
  }, [loadPositions, loadPoints, loadWallets]);

  const handleSyncFromZapper = useCallback(async () => {
    try {
      await syncFromZapper();
      toast.success('DeFi positions synced successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync positions';
      toast.error(message);
    }
  }, [syncFromZapper]);

  const handleCalculateCostBasis = useCallback(async () => {
    const positionWalletIds = [...new Set(storePositions.map(p => p.walletId).filter(id => id !== 'manual'))];
    if (positionWalletIds.length === 0) {
      toast.error('No wallet addresses found. Sync positions first.');
      return;
    }

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
  }, [storePositions, storedWallets, calculateAllCostBasis]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterChain('all');
    setFilterType('all');
  }, []);

  return {
    // Store data
    storePositions,
    storePoints,
    isLoading,
    isSyncing,
    isCalculatingCostBasis,
    lastZapperSync,

    // Store functions
    getTotalValueUsd,
    getTotalCostBasisUsd,
    getTotalUnrealizedPnL,
    getAverageApy,
    getLowestHealthFactor,
    getPositionPnL,
    isZapperConfigured,

    // Modal state
    showAddModal,
    setShowAddModal,
    showPointsModal,
    setShowPointsModal,
    isAdding,
    addError,
    positionToRemove,
    setPositionToRemove,

    // Filter/sort state
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    filterChain,
    setFilterChain,
    filterType,
    setFilterType,

    // Form state
    positionForm,
    setPositionForm,
    pointsForm,
    setPointsForm,

    // Handlers
    resetPositionForm,
    resetPointsForm,
    handleAddPosition,
    handleRemovePosition,
    confirmRemovePosition,
    handleAddPoints,
    handleSyncFromZapper,
    handleCalculateCostBasis,
    handleSort,
    clearFilters,
  };
}
