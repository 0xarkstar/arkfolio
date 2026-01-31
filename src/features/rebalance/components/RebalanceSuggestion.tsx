import { AssetAllocation, RebalanceSuggestion as Suggestion } from '../../../stores/rebalanceStore';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import Decimal from 'decimal.js';

interface RebalanceSuggestionProps {
  allocations: AssetAllocation[];
  suggestions: Suggestion[];
  isValid: boolean;
}

export function RebalanceSuggestion({
  allocations,
  suggestions,
  isValid,
}: RebalanceSuggestionProps) {
  const formatCurrency = (value: Decimal | number) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (!isValid) {
    return (
      <div className="p-6 bg-surface-800 rounded-xl text-center">
        <div className="text-4xl mb-3">&#9878;</div>
        <p className="text-surface-400">
          Target allocations must sum to 100% to generate rebalancing suggestions.
        </p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="p-6 bg-surface-800 rounded-xl text-center">
        <div className="text-4xl mb-3">&#9989;</div>
        <p className="text-surface-400">
          Your portfolio is already balanced! All assets are within 1% of their targets.
        </p>
      </div>
    );
  }

  const sellSuggestions = suggestions.filter((s) => s.type === 'sell');
  const buySuggestions = suggestions.filter((s) => s.type === 'buy');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border-loss/30 bg-loss/5">
          <p className="text-sm text-surface-400 mb-1">Total to Sell</p>
          <p className="text-2xl font-bold text-loss font-tabular">
            {formatCurrency(
              sellSuggestions.reduce((sum, s) => sum.plus(s.amountUsd), new Decimal(0))
            )}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {sellSuggestions.length} asset{sellSuggestions.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card className="p-4 border-profit/30 bg-profit/5">
          <p className="text-sm text-surface-400 mb-1">Total to Buy</p>
          <p className="text-2xl font-bold text-profit font-tabular">
            {formatCurrency(
              buySuggestions.reduce((sum, s) => sum.plus(s.amountUsd), new Decimal(0))
            )}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {buySuggestions.length} asset{buySuggestions.length !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Detailed suggestions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-surface-400">Suggested Trades</h4>

        {suggestions.map((suggestion, idx) => (
          <div
            key={`${suggestion.asset}-${idx}`}
            className="flex items-center gap-4 p-4 bg-surface-800 rounded-lg"
          >
            <Badge
              variant={suggestion.type === 'buy' ? 'success' : 'danger'}
              size="sm"
              className="w-12 justify-center"
            >
              {suggestion.type.toUpperCase()}
            </Badge>

            <div className="flex-1">
              <span className="font-medium text-surface-100">{suggestion.asset}</span>
              <div className="text-xs text-surface-400">
                {suggestion.fromPercent.toFixed(1)}% &rarr; {suggestion.toPercent.toFixed(1)}%
              </div>
            </div>

            <div className="text-right">
              <p
                className={`font-bold font-tabular ${
                  suggestion.type === 'buy' ? 'text-profit' : 'text-loss'
                }`}
              >
                {formatCurrency(suggestion.amountUsd)}
              </p>
              <p className={`text-xs ${suggestion.type === 'buy' ? 'text-profit' : 'text-loss'}`}>
                {formatPercent(suggestion.toPercent - suggestion.fromPercent)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Current vs Target visualization */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-surface-400">Allocation Comparison</h4>

        {allocations
          .filter((a) => a.currentPercent > 0 || a.targetPercent > 0)
          .sort((a, b) => b.targetPercent - a.targetPercent)
          .map((allocation) => (
            <div key={allocation.asset} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-surface-100">{allocation.asset}</span>
                <span
                  className={`font-tabular ${
                    Math.abs(allocation.difference) < 1
                      ? 'text-surface-400'
                      : allocation.difference > 0
                      ? 'text-profit'
                      : 'text-loss'
                  }`}
                >
                  {allocation.currentPercent.toFixed(1)}% / {allocation.targetPercent.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-3 bg-surface-700 rounded-full overflow-hidden">
                {/* Current allocation bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-surface-500 rounded-full"
                  style={{ width: `${Math.min(allocation.currentPercent, 100)}%` }}
                />
                {/* Target line indicator */}
                {allocation.targetPercent > 0 && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-primary-400"
                    style={{ left: `${allocation.targetPercent}%` }}
                  />
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-primary-600/10 border border-primary-600/30 rounded-lg">
        <p className="text-sm text-surface-300">
          <strong className="text-surface-100">How to rebalance:</strong> Execute the suggested
          trades on your exchange(s) to bring your portfolio back to target allocation. For
          cross-chain rebalancing, you may need to bridge assets.
        </p>
      </div>
    </div>
  );
}
