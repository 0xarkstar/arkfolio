import { useEffect, useState } from 'react';
import { useRebalanceStore } from '../../stores/rebalanceStore';
import { usePortfolioStore } from '../../stores/portfolioStore';
import { toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { SkeletonCard, SectionLoading } from '../../components/Skeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TargetAllocationEditor } from './components/TargetAllocation';
import { RebalanceSuggestion } from './components/RebalanceSuggestion';
import Decimal from 'decimal.js';

export function RebalancePage() {
  const {
    allocations,
    isLoading,
    isSaving,
    error,
    loadAllocations,
    setTargetAllocation,
    removeAllocation,
    clearAllAllocations,
    calculateRebalance,
    generateSuggestions,
    getTotalTargetPercent,
    isValidAllocation,
  } = useRebalanceStore();

  const {
    holdings,
    summary,
    refreshPortfolio,
    isLoading: portfolioLoading,
  } = usePortfolioStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadAllocations();
    refreshPortfolio();
  }, [loadAllocations, refreshPortfolio]);

  const handleSetAllocation = async (asset: string, percent: number) => {
    try {
      await setTargetAllocation(asset, percent);
      toast.success(`Target for ${asset} set to ${percent}%`);
    } catch (err) {
      toast.error('Failed to save allocation');
    }
  };

  const handleRemoveAllocation = async (id: string) => {
    try {
      await removeAllocation(id);
      toast.info('Allocation removed');
    } catch (err) {
      toast.error('Failed to remove allocation');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllAllocations();
      toast.info('All allocations cleared');
      setShowClearConfirm(false);
    } catch (err) {
      toast.error('Failed to clear allocations');
    }
  };

  const handleExportPlan = () => {
    const suggestions = generateSuggestions(
      holdings.map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd })),
      summary.totalValueUsd
    );

    if (suggestions.length === 0) {
      toast.info('No rebalancing needed');
      return;
    }

    const lines = [
      'Rebalancing Plan',
      `Generated: ${new Date().toISOString()}`,
      `Portfolio Value: $${summary.totalValueUsd.toFixed(2)}`,
      '',
      'Target Allocations:',
      ...allocations.map((a) => `  ${a.asset}: ${a.targetPercent}%`),
      '',
      'Suggested Trades:',
      ...suggestions.map(
        (s) =>
          `  ${s.type.toUpperCase()} ${s.asset}: $${s.amountUsd.toFixed(2)} (${s.fromPercent.toFixed(1)}% -> ${s.toPercent.toFixed(1)}%)`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebalance-plan-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Rebalancing plan exported');
  };

  // Calculate rebalance with current portfolio
  const totalValue = summary.totalValueUsd;
  const holdingsData = holdings.map((h) => ({
    symbol: h.symbol,
    valueUsd: h.valueUsd,
  }));

  const rebalanceAllocations = calculateRebalance(holdingsData, totalValue);
  const suggestions = generateSuggestions(holdingsData, totalValue);
  const totalPercent = getTotalTargetPercent();
  const isValid = isValidAllocation();

  const formatCurrency = (value: Decimal | number) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const loading = isLoading || portfolioLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Portfolio Rebalancing</h1>
          <p className="text-surface-400 mt-1">
            Set target allocations and get rebalancing suggestions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {allocations.length > 0 && (
            <>
              <Button
                onClick={handleExportPlan}
                variant="ghost"
                size="sm"
                disabled={!isValid || suggestions.length === 0}
              >
                Export Plan
              </Button>
              <Button
                onClick={() => setShowClearConfirm(true)}
                variant="ghost"
                size="sm"
                className="text-loss"
              >
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => {}}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loading && allocations.length === 0 ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Portfolio Value</p>
              <p className="text-2xl font-bold text-surface-100 font-tabular">
                {formatCurrency(totalValue)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Assets Tracked</p>
              <p className="text-2xl font-bold text-surface-100">{holdings.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Target Assets</p>
              <p className="text-2xl font-bold text-surface-100">{allocations.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Trades Needed</p>
              <p
                className={`text-2xl font-bold ${
                  suggestions.length === 0 ? 'text-profit' : 'text-warning'
                }`}
              >
                {suggestions.length}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Target Allocation Editor */}
        <Card className="p-6">
          {loading ? (
            <SectionLoading message="Loading allocations..." />
          ) : (
            <TargetAllocationEditor
              allocations={allocations}
              totalPercent={totalPercent}
              onUpdateAllocation={handleSetAllocation}
              onRemoveAllocation={handleRemoveAllocation}
              onAddAllocation={handleSetAllocation}
              isSaving={isSaving}
            />
          )}
        </Card>

        {/* Rebalancing Suggestions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-100 mb-4">
            Rebalancing Suggestions
          </h3>
          {loading ? (
            <SectionLoading message="Calculating..." />
          ) : allocations.length === 0 ? (
            <div className="p-6 bg-surface-800 rounded-xl text-center">
              <div className="text-4xl mb-3">&#9878;</div>
              <p className="text-surface-400">
                Add target allocations to see rebalancing suggestions.
              </p>
            </div>
          ) : totalValue.isZero() ? (
            <div className="p-6 bg-surface-800 rounded-xl text-center">
              <div className="text-4xl mb-3">&#128176;</div>
              <p className="text-surface-400">
                No portfolio data available. Connect exchanges or wallets first.
              </p>
            </div>
          ) : (
            <RebalanceSuggestion
              allocations={rebalanceAllocations}
              suggestions={suggestions}
              isValid={isValid}
            />
          )}
        </Card>
      </div>

      {/* Tips */}
      <Card className="p-6 border-primary-600/30 bg-primary-600/5">
        <h3 className="text-lg font-semibold text-surface-100 mb-2">
          Rebalancing Tips
        </h3>
        <ul className="text-surface-400 text-sm space-y-2">
          <li>
            <strong className="text-surface-300">Start simple:</strong> Begin with 3-5 major
            assets (BTC, ETH, stablecoins) before adding smaller positions.
          </li>
          <li>
            <strong className="text-surface-300">Consider fees:</strong> Small rebalances may
            not be worth the trading fees. Consider rebalancing only when drift exceeds 5%.
          </li>
          <li>
            <strong className="text-surface-300">Tax implications:</strong> Selling assets may
            trigger taxable events. Consider using new deposits to rebalance when possible.
          </li>
          <li>
            <strong className="text-surface-300">Review regularly:</strong> Update your targets
            as market conditions and your investment thesis change.
          </li>
        </ul>
      </Card>

      {/* Clear Confirm Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Allocations"
        message="Are you sure you want to remove all target allocations? This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

export default RebalancePage;
