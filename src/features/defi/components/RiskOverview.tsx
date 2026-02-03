import { Card } from '../../../components/Card';
import { DefiPosition } from '../../../stores/defiStore';
import { toDisplayNumber } from '../../../utils/decimal';
import { formatCurrency } from '../utils';

interface LowestHealthFactor {
  value: number;
  position: DefiPosition;
}

interface RiskOverviewProps {
  positions: DefiPosition[];
  lowestHealth: LowestHealthFactor | null;
}

export function RiskOverview({ positions, lowestHealth }: RiskOverviewProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-surface-100 mb-4">Risk Overview</h2>
      <div className="bg-surface-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lowest Health Factor */}
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

          {/* IL Exposure */}
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

          {/* PT Maturity */}
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
  );
}
