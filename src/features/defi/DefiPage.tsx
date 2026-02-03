import { useMemo } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { toDisplayNumber } from '../../utils/decimal';
import { useDefiPage } from './hooks';
import { MOCK_POSITIONS, MOCK_POINTS } from './constants';
import {
  DefiSummaryCards,
  DefiPositionsTable,
  PointsSection,
  RiskOverview,
  AddPositionModal,
  AddPointsModal,
  SetupNotice,
  ILCalculator,
} from './components';

export function DefiPage() {
  const {
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
  } = useDefiPage();

  // Use store data if available, otherwise show mock data for demo (only if Zapper not configured)
  const showMockData = storePositions.length === 0 && !isZapperConfigured();
  const positions = storePositions.length > 0 ? storePositions : (showMockData ? MOCK_POSITIONS : []);
  const pointsBalances = storePoints.length > 0 ? storePoints : (showMockData ? MOCK_POINTS : []);

  // Compute summary values
  const totalValue = useMemo(() =>
    storePositions.length > 0
      ? toDisplayNumber(getTotalValueUsd())
      : MOCK_POSITIONS.reduce((sum, p) => sum + toDisplayNumber(p.currentValueUsd), 0),
    [storePositions.length, getTotalValueUsd]
  );

  const avgApy = useMemo(() => {
    if (storePositions.length > 0) {
      return getAverageApy();
    }
    const filtered = positions.filter((p) => p.apy && p.apy > 0);
    return filtered.length > 0
      ? filtered.reduce((sum, p) => sum + (p.apy || 0), 0) / filtered.length
      : 0;
  }, [storePositions.length, getAverageApy, positions]);

  const lowestHealth = storePositions.length > 0 ? getLowestHealthFactor() : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <DefiSummaryCards
        positions={positions}
        isLoading={isLoading}
        totalValue={totalValue}
        avgApy={avgApy}
        getTotalCostBasisUsd={getTotalCostBasisUsd}
        getTotalUnrealizedPnL={getTotalUnrealizedPnL}
      />

      {/* Positions Table */}
      <DefiPositionsTable
        positions={positions}
        isLoading={isLoading}
        isSyncing={isSyncing}
        isCalculatingCostBasis={isCalculatingCostBasis}
        lastZapperSync={lastZapperSync}
        isZapperConfigured={isZapperConfigured()}
        hasStorePositions={storePositions.length > 0}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortField={sortField}
        sortDirection={sortDirection}
        filterChain={filterChain}
        setFilterChain={setFilterChain}
        filterType={filterType}
        setFilterType={setFilterType}
        handleSort={handleSort}
        handleSyncFromZapper={handleSyncFromZapper}
        handleCalculateCostBasis={handleCalculateCostBasis}
        handleRemovePosition={handleRemovePosition}
        getPositionPnL={getPositionPnL}
        onAddPosition={() => setShowAddModal(true)}
        clearFilters={clearFilters}
      />

      {/* Points Tracking */}
      <PointsSection
        pointsBalances={pointsBalances}
        onAddPoints={() => setShowPointsModal(true)}
      />

      {/* IL & Risk Analysis */}
      {positions.length > 0 && (
        <ILCalculator positions={positions} />
      )}

      {/* Risk Overview */}
      <RiskOverview
        positions={positions}
        lowestHealth={lowestHealth}
      />

      {/* Setup Notice */}
      {storePositions.length === 0 && (
        <SetupNotice
          isZapperConfigured={isZapperConfigured()}
          isSyncing={isSyncing}
          onSyncFromZapper={handleSyncFromZapper}
          onAddPosition={() => setShowAddModal(true)}
        />
      )}

      {/* Add Position Modal */}
      <AddPositionModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetPositionForm(); }}
        onSubmit={handleAddPosition}
        isAdding={isAdding}
        error={addError}
        form={positionForm}
        setForm={setPositionForm}
      />

      {/* Add Points Modal */}
      <AddPointsModal
        isOpen={showPointsModal}
        onClose={() => { setShowPointsModal(false); resetPointsForm(); }}
        onSubmit={handleAddPoints}
        isAdding={isAdding}
        error={addError}
        form={pointsForm}
        setForm={setPointsForm}
      />

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
