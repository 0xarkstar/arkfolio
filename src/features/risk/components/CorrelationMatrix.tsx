import { useMemo } from 'react';
import { riskAnalysisService } from '../../../services/risk';
import { Badge } from '../../../components/Badge';

interface CorrelationMatrixProps {
  assetSymbols: string[];
  assetReturns?: Map<string, number[]>;
}

export function CorrelationMatrix({ assetSymbols, assetReturns }: CorrelationMatrixProps) {
  // Generate mock returns if not provided
  const returnsData = useMemo(() => {
    if (assetReturns && assetReturns.size > 0) {
      return assetReturns;
    }

    // Generate mock correlated returns for demonstration
    const mockReturns = new Map<string, number[]>();

    // Generate base market return
    const marketReturns = riskAnalysisService.generateMockReturns('market', 365, 0.0008, 0.02);

    for (const symbol of assetSymbols.slice(0, 8)) {
      // Generate returns with varying correlation to market
      const correlation = 0.3 + Math.random() * 0.6; // 0.3 to 0.9 correlation
      const idiosyncraticVol = 0.01 + Math.random() * 0.02;

      const assetReturn = marketReturns.map((mr) => {
        const idiosyncratic = riskAnalysisService.generateMockReturns('noise', 1, 0, idiosyncraticVol)[0];
        return correlation * mr + (1 - correlation) * idiosyncratic;
      });

      mockReturns.set(symbol, assetReturn);
    }

    return mockReturns;
  }, [assetSymbols, assetReturns]);

  const correlationMatrix = useMemo(() => {
    return riskAnalysisService.calculateCorrelationMatrix(returnsData);
  }, [returnsData]);

  if (correlationMatrix.assets.length < 2) {
    return (
      <div className="p-6 bg-surface-700 rounded-lg text-center">
        <p className="text-surface-400">
          Need at least 2 assets to calculate correlations.
        </p>
      </div>
    );
  }

  const getCorrelationColor = (corr: number): string => {
    if (corr >= 0.7) return 'bg-loss/80';
    if (corr >= 0.4) return 'bg-warning/60';
    if (corr >= 0) return 'bg-surface-600';
    if (corr >= -0.4) return 'bg-blue-600/60';
    return 'bg-profit/80';
  };

  const getCorrelationText = (corr: number): string => {
    if (corr >= 0.7) return 'text-surface-100';
    if (corr >= 0.4) return 'text-surface-100';
    if (corr >= 0) return 'text-surface-300';
    if (corr >= -0.4) return 'text-surface-100';
    return 'text-surface-100';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-surface-100">Correlation Matrix</h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-profit/80"></span>
            <span className="text-surface-400">Negative</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-surface-600"></span>
            <span className="text-surface-400">Low</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-loss/80"></span>
            <span className="text-surface-400">High</span>
          </span>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs text-surface-500"></th>
              {correlationMatrix.assets.map((asset) => (
                <th key={asset} className="p-2 text-center text-xs text-surface-400">
                  {asset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlationMatrix.assets.map((asset, i) => (
              <tr key={asset}>
                <td className="p-2 text-xs text-surface-400">{asset}</td>
                {correlationMatrix.matrix[i].map((corr, j) => (
                  <td
                    key={`${i}-${j}`}
                    className={`p-2 text-center text-xs font-tabular ${getCorrelationColor(
                      corr
                    )} ${getCorrelationText(corr)}`}
                  >
                    {i === j ? '-' : corr.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {correlationMatrix.highestPositive && (
          <div className="bg-surface-700 rounded-lg p-4">
            <p className="text-sm text-surface-400 mb-2">Highest Positive Correlation</p>
            <div className="flex items-center justify-between">
              <span className="text-surface-100">
                {correlationMatrix.highestPositive.asset1} / {correlationMatrix.highestPositive.asset2}
              </span>
              <Badge variant="warning" size="sm">
                {correlationMatrix.highestPositive.correlation.toFixed(2)}
              </Badge>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              These assets tend to move together. Consider diversifying if overexposed.
            </p>
          </div>
        )}

        {correlationMatrix.highestNegative && (
          <div className="bg-surface-700 rounded-lg p-4">
            <p className="text-sm text-surface-400 mb-2">Highest Negative Correlation</p>
            <div className="flex items-center justify-between">
              <span className="text-surface-100">
                {correlationMatrix.highestNegative.asset1} / {correlationMatrix.highestNegative.asset2}
              </span>
              <Badge variant="success" size="sm">
                {correlationMatrix.highestNegative.correlation.toFixed(2)}
              </Badge>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              These assets provide diversification by moving in opposite directions.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-surface-500">
        Correlation measures how assets move together. High positive correlation (near +1)
        means assets move together; negative correlation (near -1) means they move oppositely.
        Lower correlation between assets provides better diversification.
      </p>
    </div>
  );
}
