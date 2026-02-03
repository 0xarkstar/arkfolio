import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { Decimal, toDisplayNumber } from '../../../utils/decimal';
import { formatCurrency } from '../utils';

interface PointsBalance {
  id: string;
  protocol: string;
  walletAddress: string;
  pointsBalance: Decimal;
  estimatedValueUsd: Decimal | null;
  lastSync: Date | null;
}

interface PointsSectionProps {
  pointsBalances: PointsBalance[];
  onAddPoints: () => void;
}

export function PointsSection({ pointsBalances, onAddPoints }: PointsSectionProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-surface-100">Points & Airdrops</h2>
        <Button
          onClick={onAddPoints}
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
  );
}
