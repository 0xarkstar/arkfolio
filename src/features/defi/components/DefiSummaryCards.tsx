import { Card } from '../../../components/Card';
import { SkeletonCard } from '../../../components/Skeleton';
import { DefiPosition } from '../../../stores/defiStore';
import { Decimal } from '../../../utils/decimal';
import { formatCurrency } from '../utils';

interface DefiSummaryCardsProps {
  positions: DefiPosition[];
  isLoading: boolean;
  totalValue: number;
  avgApy: number;
  getTotalCostBasisUsd: () => Decimal;
  getTotalUnrealizedPnL: () => { pnl: Decimal; percent: number };
}

export function DefiSummaryCards({
  positions,
  isLoading,
  totalValue,
  avgApy,
  getTotalCostBasisUsd,
  getTotalUnrealizedPnL,
}: DefiSummaryCardsProps) {
  if (isLoading && positions.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
    </div>
  );
}
