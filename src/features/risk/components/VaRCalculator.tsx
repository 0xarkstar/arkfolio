import { useState, useEffect, useMemo } from 'react';
import { riskAnalysisService, VaRResult } from '../../../services/risk';
import { Select } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { ProgressBar } from '../../../components/ProgressBar';
import Decimal from 'decimal.js';

interface VaRCalculatorProps {
  portfolioValue: Decimal;
  portfolioReturns?: number[];
}

export function VaRCalculator({ portfolioValue, portfolioReturns }: VaRCalculatorProps) {
  const [timeHorizon, setTimeHorizon] = useState(1);
  const [method, setMethod] = useState<'historical' | 'parametric'>('historical');
  const [varResult, setVarResult] = useState<VaRResult | null>(null);

  // Use provided returns or generate mock data for demonstration
  const returns = useMemo(() => {
    if (portfolioReturns && portfolioReturns.length > 0) {
      return portfolioReturns;
    }
    // Generate mock returns for demo
    return riskAnalysisService.generateMockReturns('portfolio', 365, 0.0008, 0.025);
  }, [portfolioReturns]);

  useEffect(() => {
    const result =
      method === 'historical'
        ? riskAnalysisService.calculateHistoricalVaR(
            returns,
            portfolioValue,
            95,
            timeHorizon
          )
        : riskAnalysisService.calculateParametricVaR(
            returns,
            portfolioValue,
            95,
            timeHorizon
          );
    setVarResult(result);
  }, [returns, portfolioValue, timeHorizon, method]);

  const formatCurrency = (value: Decimal | number) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getVaRSeverity = (var95: number): 'success' | 'warning' | 'danger' => {
    if (var95 < 5) return 'success';
    if (var95 < 15) return 'warning';
    return 'danger';
  };

  if (!varResult) {
    return null;
  }

  const severity = getVaRSeverity(varResult.var95);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-surface-100">Value at Risk (VaR)</h4>
        <div className="flex items-center gap-2">
          <Select
            value={timeHorizon.toString()}
            onChange={(e) => setTimeHorizon(Number(e.target.value))}
            size="sm"
            options={[
              { value: '1', label: '1 Day' },
              { value: '7', label: '1 Week' },
              { value: '30', label: '1 Month' },
            ]}
          />
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'historical' | 'parametric')}
            size="sm"
            options={[
              { value: 'historical', label: 'Historical' },
              { value: 'parametric', label: 'Parametric' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-surface-400">95% VaR</span>
            <Badge variant={severity} size="sm">
              {varResult.var95.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-xl font-bold text-surface-100 font-tabular">
            {formatCurrency(varResult.var95Usd)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            Max expected loss in {timeHorizon} day(s), 95% confidence
          </p>
        </div>

        <div className="bg-surface-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-surface-400">99% VaR</span>
            <Badge
              variant={getVaRSeverity(varResult.var99)}
              size="sm"
            >
              {varResult.var99.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-xl font-bold text-surface-100 font-tabular">
            {formatCurrency(varResult.var99Usd)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            Max expected loss in {timeHorizon} day(s), 99% confidence
          </p>
        </div>
      </div>

      {/* VaR visualization */}
      <div className="bg-surface-700 rounded-lg p-4">
        <p className="text-sm text-surface-400 mb-3">Loss Distribution</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-12 text-xs text-surface-500">95%</span>
            <div className="flex-1">
              <ProgressBar
                value={varResult.var95}
                max={30}
                variant={severity}
                size="sm"
              />
            </div>
            <span className="w-16 text-right text-sm font-tabular text-surface-300">
              {varResult.var95.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-12 text-xs text-surface-500">99%</span>
            <div className="flex-1">
              <ProgressBar
                value={varResult.var99}
                max={30}
                variant={getVaRSeverity(varResult.var99)}
                size="sm"
              />
            </div>
            <span className="w-16 text-right text-sm font-tabular text-surface-300">
              {varResult.var99.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-surface-500">
        VaR shows the maximum expected loss over a given time period at a confidence level.
        For example, a 95% 1-day VaR of 5% means there's a 5% chance of losing more than
        5% of portfolio value in a single day.
      </p>
    </div>
  );
}
