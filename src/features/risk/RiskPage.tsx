import { useEffect, useState, useCallback } from 'react';
import { useExchangeStore } from '../../stores/exchangeStore';
import { usePortfolioStore } from '../../stores/portfolioStore';
import { useWalletsStore } from '../../stores/walletsStore';
import { useDefiStore } from '../../stores/defiStore';
import { toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { SkeletonCard } from '../../components/Skeleton';
import { ProgressBar } from '../../components/ProgressBar';
import Decimal from 'decimal.js';

export function RiskPage() {
  const { allPositions } = useExchangeStore();
  const { summary, holdings, refreshPortfolio, isLoading: portfolioLoading } = usePortfolioStore();
  const { getTotalValueUsd: getWalletsTotalValue, loadWallets, isLoading: walletsLoading } = useWalletsStore();
  const {
    positions: defiPositions,
    getTotalValueUsd: getDefiTotalValue,
    getLowestHealthFactor,
    loadPositions: loadDefiPositions,
    isLoading: defiLoading,
  } = useDefiStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isLoading = portfolioLoading || walletsLoading || defiLoading;

  const refreshData = useCallback(async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    try {
      await Promise.all([
        refreshPortfolio(),
        loadWallets(),
        loadDefiPositions(),
      ]);
      setLastRefresh(new Date());
      if (showToast) toast.success('Risk data refreshed');
    } catch (error) {
      console.error('Failed to refresh risk data:', error);
      if (showToast) toast.error('Failed to refresh risk data');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshPortfolio, loadWallets, loadDefiPositions]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Calculate portfolio metrics
  const cexValue = summary.totalValueUsd;
  const walletsValue = getWalletsTotalValue();
  const defiValue = getDefiTotalValue();
  const totalValue = cexValue.plus(walletsValue).plus(defiValue);

  // Futures positions analysis - convert Decimals to numbers
  const futuresPositions = Array.from(allPositions.values()).flat();
  const getPositionValue = (p: typeof futuresPositions[0]) => {
    const size = p.size instanceof Decimal ? p.size.toNumber() : (p.size || 0);
    const price = p.markPrice instanceof Decimal ? p.markPrice.toNumber() :
                  (p.markPrice || (p.entryPrice instanceof Decimal ? p.entryPrice.toNumber() : (p.entryPrice || 0)));
    return Math.abs(size * price);
  };
  const getPnl = (p: typeof futuresPositions[0]) => {
    if (!p.unrealizedPnl) return 0;
    return p.unrealizedPnl instanceof Decimal ? p.unrealizedPnl.toNumber() : p.unrealizedPnl;
  };

  const totalFuturesExposure = futuresPositions.reduce((sum, p) => sum + getPositionValue(p), 0);
  const totalUnrealizedPnl = futuresPositions.reduce((sum, p) => sum + getPnl(p), 0);
  const longExposure = futuresPositions
    .filter((p) => p.side === 'long')
    .reduce((sum, p) => sum + getPositionValue(p), 0);
  const shortExposure = futuresPositions
    .filter((p) => p.side === 'short')
    .reduce((sum, p) => sum + getPositionValue(p), 0);

  // DeFi risk metrics
  const lowestHealthResult = getLowestHealthFactor();
  const lpPositions = defiPositions.filter((p) => p.positionType === 'lp');
  const lendingPositions = defiPositions.filter(
    (p) => p.positionType === 'lending' || p.positionType === 'borrowing'
  );

  // IL exposure (LP positions)
  const totalILExposure = lpPositions.reduce(
    (sum, p) => sum.plus(p.currentValueUsd),
    new Decimal(0)
  );

  // Asset concentration risk
  const topHolding = holdings[0];
  const topHoldingPercent = topHolding && totalValue.greaterThan(0)
    ? topHolding.valueUsd.div(totalValue).times(100).toNumber()
    : 0;

  // Calculate risk score (0-100)
  const calculateRiskScore = () => {
    let score = 0;

    // Leverage risk (0-30 points)
    if (totalFuturesExposure > 0) {
      const leverageRatio = totalFuturesExposure / totalValue.toNumber();
      score += Math.min(leverageRatio * 15, 30);
    }

    // Health factor risk (0-25 points)
    if (lowestHealthResult && lowestHealthResult.value < 2) {
      score += Math.max(25 - lowestHealthResult.value * 10, 0);
    }

    // Concentration risk (0-20 points)
    if (topHoldingPercent > 50) {
      score += (topHoldingPercent - 50) * 0.4;
    }

    // IL exposure risk (0-15 points)
    const ilRatio = totalILExposure.div(totalValue.greaterThan(0) ? totalValue : new Decimal(1)).toNumber();
    score += ilRatio * 15;

    // Unrealized loss risk (0-10 points)
    if (totalUnrealizedPnl < 0) {
      const lossRatio = Math.abs(totalUnrealizedPnl) / totalValue.toNumber();
      score += Math.min(lossRatio * 100, 10);
    }

    return Math.min(Math.round(score), 100);
  };

  const riskScore = calculateRiskScore();

  const getRiskLevel = (score: number) => {
    if (score < 20) return { label: 'Low', color: 'text-profit', bgColor: 'bg-profit' };
    if (score < 40) return { label: 'Moderate', color: 'text-blue-400', bgColor: 'bg-blue-400' };
    if (score < 60) return { label: 'Elevated', color: 'text-warning', bgColor: 'bg-warning' };
    if (score < 80) return { label: 'High', color: 'text-orange-400', bgColor: 'bg-orange-400' };
    return { label: 'Critical', color: 'text-loss', bgColor: 'bg-loss' };
  };

  const riskLevel = getRiskLevel(riskScore);

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Risk Report', new Date().toISOString()],
      [],
      ['Overall Metrics'],
      ['Risk Score', riskScore.toString()],
      ['Risk Level', riskLevel.label],
      ['Total Portfolio Value', totalValue.toFixed(2)],
      [],
      ['Risk Factors'],
      ['Leverage Ratio', totalFuturesExposure > 0 ? (totalFuturesExposure / totalValue.toNumber()).toFixed(2) : '0'],
      ['Health Factor', lowestHealthResult ? lowestHealthResult.value.toFixed(2) : 'N/A'],
      ['Top Asset Concentration', `${topHoldingPercent.toFixed(1)}%`],
      ['IL Exposure', `${totalILExposure.div(totalValue.greaterThan(0) ? totalValue : new Decimal(1)).times(100).toFixed(1)}%`],
      [],
      ['Futures Exposure'],
      ['Total Exposure', totalFuturesExposure.toFixed(2)],
      ['Unrealized PnL', totalUnrealizedPnl.toFixed(2)],
      ['Long Exposure', longExposure.toFixed(2)],
      ['Short Exposure', shortExposure.toFixed(2)],
    ];

    if (futuresPositions.length > 0) {
      rows.push([]);
      rows.push(['Futures Positions']);
      rows.push(['Symbol', 'Side', 'Size', 'Entry Price', 'Mark Price', 'uPnL', 'Liq. Price']);
      futuresPositions.forEach(p => {
        const size = p.size instanceof Decimal ? p.size.toNumber() : (p.size || 0);
        const entry = p.entryPrice instanceof Decimal ? p.entryPrice.toNumber() : (p.entryPrice || 0);
        const mark = p.markPrice instanceof Decimal ? p.markPrice.toNumber() : (p.markPrice || 0);
        const pnl = p.unrealizedPnl instanceof Decimal ? p.unrealizedPnl.toNumber() : (p.unrealizedPnl || 0);
        const liq = p.liquidationPrice instanceof Decimal ? p.liquidationPrice.toNumber() : p.liquidationPrice;
        rows.push([
          p.symbol,
          p.side,
          Math.abs(size).toFixed(4),
          entry.toFixed(2),
          mark.toFixed(2),
          pnl.toFixed(2),
          liq ? liq.toFixed(2) : '',
        ]);
      });
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Risk report exported to CSV');
  };

  const formatCurrency = (value: number | Decimal) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100">Risk Analysis</h1>
          {lastRefresh && (
            <p className="text-xs text-surface-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => refreshData(true)}
            disabled={isRefreshing}
            variant="ghost"
            size="sm"
            loading={isRefreshing}
          >
            Refresh
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="ghost"
            size="sm"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Risk Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading && holdings.length === 0 ? (
          <>
            <div className="md:col-span-1">
              <SkeletonCard />
            </div>
            <div className="md:col-span-2">
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            <Card className="p-6 md:col-span-1">
              <p className="text-sm text-surface-400 mb-2">Overall Risk Score</p>
              <div className="flex items-end gap-4">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-surface-800"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${riskScore * 2.51} 251`}
                      className={riskLevel.color}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold ${riskLevel.color}`}>{riskScore}</span>
                  </div>
                </div>
                <div>
                  <p className={`text-xl font-bold ${riskLevel.color}`}>{riskLevel.label}</p>
                  <p className="text-sm text-surface-400">Risk Level</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 md:col-span-2">
              <p className="text-sm text-surface-400 mb-4">Risk Factors</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <RiskFactor
                  label="Leverage"
                  value={totalFuturesExposure > 0
                    ? `${(totalFuturesExposure / totalValue.toNumber()).toFixed(2)}x`
                    : '0x'}
                  status={totalFuturesExposure === 0 ? 'good' : totalFuturesExposure / totalValue.toNumber() > 2 ? 'danger' : 'warning'}
                />
                <RiskFactor
                  label="Health Factor"
                  value={lowestHealthResult ? lowestHealthResult.value.toFixed(2) : 'N/A'}
                  status={!lowestHealthResult ? 'good' : lowestHealthResult.value > 2 ? 'good' : lowestHealthResult.value > 1.5 ? 'warning' : 'danger'}
                />
                <RiskFactor
                  label="Concentration"
                  value={`${topHoldingPercent.toFixed(1)}%`}
                  status={topHoldingPercent < 30 ? 'good' : topHoldingPercent < 50 ? 'warning' : 'danger'}
                />
                <RiskFactor
                  label="IL Exposure"
                  value={`${totalILExposure.div(totalValue.greaterThan(0) ? totalValue : new Decimal(1)).times(100).toFixed(1)}%`}
                  status={totalILExposure.isZero() ? 'good' : totalILExposure.div(totalValue).greaterThan(0.3) ? 'danger' : 'warning'}
                />
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Futures Positions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Futures Exposure</h2>
        {futuresPositions.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            <p>No open futures positions</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-800 rounded-lg p-4">
                <p className="text-sm text-surface-400">Total Exposure</p>
                <p className="text-xl font-bold text-surface-100 font-tabular">
                  {formatCurrency(totalFuturesExposure)}
                </p>
              </div>
              <div className="bg-surface-800 rounded-lg p-4">
                <p className="text-sm text-surface-400">Unrealized PnL</p>
                <p className={`text-xl font-bold font-tabular ${totalUnrealizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
                </p>
              </div>
              <div className="bg-surface-800 rounded-lg p-4">
                <p className="text-sm text-surface-400">Long Exposure</p>
                <p className="text-xl font-bold text-profit font-tabular">
                  {formatCurrency(longExposure)}
                </p>
              </div>
              <div className="bg-surface-800 rounded-lg p-4">
                <p className="text-sm text-surface-400">Short Exposure</p>
                <p className="text-xl font-bold text-loss font-tabular">
                  {formatCurrency(shortExposure)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Symbol</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Side</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Size</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Entry</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Mark</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">uPnL</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Liq. Price</th>
                  </tr>
                </thead>
                <tbody>
                  {futuresPositions.map((position, idx) => {
                    const size = position.size instanceof Decimal ? position.size.toNumber() : (position.size || 0);
                    const entry = position.entryPrice instanceof Decimal ? position.entryPrice.toNumber() : (position.entryPrice || 0);
                    const mark = position.markPrice instanceof Decimal ? position.markPrice.toNumber() : (position.markPrice || 0);
                    const pnl = position.unrealizedPnl instanceof Decimal ? position.unrealizedPnl.toNumber() : (position.unrealizedPnl || 0);
                    const liq = position.liquidationPrice instanceof Decimal ? position.liquidationPrice.toNumber() : position.liquidationPrice;

                    return (
                      <tr key={`${position.symbol}-${idx}`} className="border-b border-surface-800 hover:bg-surface-800/50">
                        <td className="py-3 px-4 font-medium text-surface-100">{position.symbol}</td>
                        <td className="py-3 px-4">
                          <Badge variant={position.side === 'long' ? 'success' : 'danger'} size="sm">
                            {position.side.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-tabular text-surface-300">
                          {Math.abs(size).toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right font-tabular text-surface-300">
                          ${entry.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-tabular text-surface-300">
                          ${mark.toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right font-tabular ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-tabular text-warning">
                          {liq ? `$${liq.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* DeFi Health */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">DeFi Health</h2>
        {lendingPositions.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            <p>No lending/borrowing positions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lendingPositions.map((position) => (
              <div key={position.id} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-surface-100">{position.protocol}</p>
                    <p className="text-sm text-surface-400">
                      {position.assets.join('/')} - {position.positionType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-surface-100 font-tabular">
                      {formatCurrency(position.currentValueUsd)}
                    </p>
                    {position.healthFactor && (
                      <p className={`text-sm font-tabular ${
                        position.healthFactor > 2 ? 'text-profit' :
                        position.healthFactor > 1.5 ? 'text-warning' : 'text-loss'
                      }`}>
                        HF: {position.healthFactor.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {position.healthFactor && (
                  <ProgressBar
                    value={Math.min(position.healthFactor * 33, 100)}
                    variant={
                      position.healthFactor > 2 ? 'success' :
                      position.healthFactor > 1.5 ? 'warning' : 'danger'
                    }
                    size="sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Asset Concentration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Asset Concentration</h2>
        {holdings.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            <p>No assets to analyze</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.slice(0, 10).map((holding) => {
              const percent = totalValue.greaterThan(0)
                ? holding.valueUsd.div(totalValue).times(100).toNumber()
                : 0;
              return (
                <div key={holding.symbol} className="flex items-center gap-4">
                  <div className="w-12 text-sm font-medium text-surface-300">
                    {holding.symbol}
                  </div>
                  <div className="flex-1">
                    <ProgressBar
                      value={percent}
                      variant={
                        percent > 50 ? 'danger' :
                        percent > 30 ? 'warning' :
                        'primary'
                      }
                      size="md"
                    />
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-sm font-tabular ${
                      percent > 50 ? 'text-loss' :
                      percent > 30 ? 'text-warning' :
                      'text-surface-300'
                    }`}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Risk Recommendations */}
      <Card className="p-6 border-primary-600/30 bg-primary-600/5">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Recommendations</h2>
        <div className="space-y-3">
          {riskScore < 20 && (
            <Alert variant="info" title="Portfolio looks healthy">
              Your risk metrics are within acceptable ranges. Continue monitoring regularly.
            </Alert>
          )}
          {topHoldingPercent > 50 && (
            <Alert variant="warning" title="High concentration risk">
              {topHolding?.symbol} represents {topHoldingPercent.toFixed(1)}% of your portfolio. Consider diversifying.
            </Alert>
          )}
          {lowestHealthResult && lowestHealthResult.value < 1.5 && (
            <Alert variant="error" title="Low health factor detected">
              Your {lowestHealthResult.position.protocol} position has a health factor of {lowestHealthResult.value.toFixed(2)}. Consider adding collateral or reducing debt.
            </Alert>
          )}
          {totalFuturesExposure / totalValue.toNumber() > 2 && (
            <Alert variant="warning" title="High leverage exposure">
              Your futures exposure exceeds 2x your portfolio value. Consider reducing position sizes.
            </Alert>
          )}
          {totalUnrealizedPnl < -totalValue.toNumber() * 0.1 && (
            <Alert variant="error" title="Significant unrealized losses">
              Your unrealized losses exceed 10% of portfolio value. Review your positions and consider stop-losses.
            </Alert>
          )}
        </div>
      </Card>
    </div>
  );
}

interface RiskFactorProps {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'danger';
}

function RiskFactor({ label, value, status }: RiskFactorProps) {
  const colors = {
    good: 'text-profit',
    warning: 'text-warning',
    danger: 'text-loss',
  };

  return (
    <div className="text-center">
      <p className={`text-2xl font-bold font-tabular ${colors[status]}`}>{value}</p>
      <p className="text-sm text-surface-400">{label}</p>
    </div>
  );
}

export default RiskPage;
