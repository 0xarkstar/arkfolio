/**
 * Impermanent Loss Calculator Component
 *
 * Displays IL calculation results for LP positions with visual indicators.
 */

import { useMemo, useState } from 'react';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { DefiPosition } from '../../../stores/defiStore';
import {
  impermanentLossService,
  ILCalculationResult,
  LiquidationRisk,
} from '../../../services/defi';
import { toDisplayNumber, formatCurrency } from '../../../utils/decimal';

interface ILCalculatorProps {
  positions: DefiPosition[];
  priceData?: Map<string, { entryPrice: number; currentPrice: number }>;
}

interface ILSimulatorProps {
  onClose?: () => void;
}

/**
 * IL Simulator for hypothetical price changes
 */
function ILSimulator({ onClose }: ILSimulatorProps) {
  const [priceChange, setPriceChange] = useState('50');

  const simulation = useMemo(() => {
    const change = parseFloat(priceChange) || 0;
    return impermanentLossService.estimateILForPriceChange(change);
  }, [priceChange]);

  const presetChanges = [-50, -25, 25, 50, 100, 200];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-surface-100">IL Simulator</h4>
        {onClose && (
          <Button variant="ghost" size="xs" onClick={onClose}>
            &times;
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={priceChange}
          onChange={(e) => setPriceChange(e.target.value)}
          placeholder="Price change %"
          className="w-24"
          size="sm"
        />
        <span className="text-surface-400 text-sm">% price change</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {presetChanges.map((change) => (
          <Button
            key={change}
            variant={priceChange === String(change) ? 'primary' : 'secondary'}
            size="xs"
            onClick={() => setPriceChange(String(change))}
          >
            {change > 0 ? '+' : ''}{change}%
          </Button>
        ))}
      </div>

      <div className="bg-surface-800 rounded-lg p-4">
        <div className="text-center">
          <p className="text-sm text-surface-400 mb-1">Estimated IL</p>
          <p className={`text-2xl font-bold font-tabular ${simulation.il < 0 ? 'text-loss' : 'text-surface-100'}`}>
            {simulation.il.toFixed(2)}%
          </p>
          <p className="text-xs text-surface-500 mt-2">{simulation.description}</p>
        </div>
      </div>

      <div className="text-xs text-surface-500">
        IL assumes a constant product AMM (x * y = k) like Uniswap V2.
        Concentrated liquidity pools may have different IL characteristics.
      </div>
    </div>
  );
}

/**
 * Individual IL Position Card
 */
function ILPositionCard({ result }: { result: ILCalculationResult }) {
  const ilPercent = toDisplayNumber(result.impermanentLoss.times(100));
  const ilUsd = toDisplayNumber(result.impermanentLossUsd);
  const riskLevel = impermanentLossService.getILRiskLevel(ilPercent);

  const getRiskBadgeVariant = (level: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (level) {
      case 'low': return 'success';
      case 'moderate': return 'warning';
      case 'high': return 'danger';
      case 'severe': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="bg-surface-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-surface-100">
            {result.tokens.map(t => t.symbol).join('/')}
          </p>
        </div>
        <Badge variant={getRiskBadgeVariant(riskLevel)} size="sm">
          {riskLevel.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-surface-500">Impermanent Loss</p>
          <p className={`text-lg font-bold font-tabular ${ilPercent < 0 ? 'text-loss' : 'text-profit'}`}>
            {ilPercent.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-500">IL (USD)</p>
          <p className={`text-lg font-bold font-tabular ${ilUsd < 0 ? 'text-loss' : 'text-profit'}`}>
            {formatCurrency(ilUsd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-surface-500">Current Value</p>
          <p className="text-surface-200 font-tabular">
            {formatCurrency(result.currentValueUsd)}
          </p>
        </div>
        <div>
          <p className="text-xs text-surface-500">HODL Value</p>
          <p className="text-surface-200 font-tabular">
            {formatCurrency(result.hodlValueUsd)}
          </p>
        </div>
      </div>

      {/* Token price changes */}
      <div className="mt-3 pt-3 border-t border-surface-700">
        <p className="text-xs text-surface-500 mb-2">Token Price Changes</p>
        <div className="space-y-1">
          {result.tokens.map((token, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-surface-400">{token.symbol}</span>
              <span className={token.priceChange >= 0 ? 'text-profit' : 'text-loss'}>
                {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Liquidation Risk Card
 */
function LiquidationRiskCard({ risk }: { risk: LiquidationRisk }) {
  const getHealthColor = (level: LiquidationRisk['riskLevel']) => {
    switch (level) {
      case 'safe': return 'text-profit';
      case 'moderate': return 'text-warning';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-loss';
    }
  };

  const getHealthBg = (level: LiquidationRisk['riskLevel']) => {
    switch (level) {
      case 'safe': return 'bg-profit/20';
      case 'moderate': return 'bg-warning/20';
      case 'high': return 'bg-orange-400/20';
      case 'critical': return 'bg-loss/20';
    }
  };

  return (
    <div className={`rounded-lg p-4 ${getHealthBg(risk.riskLevel)}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-400">Health Factor</p>
          <p className={`text-2xl font-bold font-tabular ${getHealthColor(risk.riskLevel)}`}>
            {risk.healthFactor.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={risk.riskLevel === 'safe' || risk.riskLevel === 'moderate' ? 'success' : 'danger'}>
            {risk.riskLevel.toUpperCase()}
          </Badge>
          {risk.distanceToLiquidation !== undefined && (
            <p className="text-xs text-surface-500 mt-1">
              {risk.distanceToLiquidation.toFixed(1)}% to liquidation
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main IL Calculator Component
 */
export function ILCalculator({ positions, priceData }: ILCalculatorProps) {
  const [showSimulator, setShowSimulator] = useState(false);

  // Filter LP positions
  const lpPositions = useMemo(() =>
    positions.filter(p => p.positionType === 'lp'),
    [positions]
  );

  // Calculate IL for positions with price data
  const ilResults = useMemo(() => {
    if (!priceData || priceData.size === 0) {
      return new Map<string, ILCalculationResult>();
    }
    return impermanentLossService.calculateBatchIL(positions, priceData);
  }, [positions, priceData]);

  // Calculate liquidation risks
  const liquidationRisks = useMemo(() => {
    const risks: LiquidationRisk[] = [];
    for (const position of positions) {
      const risk = impermanentLossService.calculateLiquidationRisk(position);
      if (risk) {
        risks.push(risk);
      }
    }
    return risks;
  }, [positions]);

  // Get total IL stats
  const ilStats = useMemo(() => {
    return impermanentLossService.getTotalIL(ilResults);
  }, [ilResults]);

  if (lpPositions.length === 0 && liquidationRisks.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-surface-100">IL & Risk Analysis</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowSimulator(!showSimulator)}
        >
          {showSimulator ? 'Hide Simulator' : 'IL Simulator'}
        </Button>
      </div>

      {/* IL Summary */}
      {ilResults.size > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-800 rounded-lg p-4">
            <p className="text-sm text-surface-400 mb-1">Total IL (USD)</p>
            <p className={`text-2xl font-bold font-tabular ${
              toDisplayNumber(ilStats.totalILUsd) < 0 ? 'text-loss' : 'text-profit'
            }`}>
              {formatCurrency(ilStats.totalILUsd)}
            </p>
          </div>
          <div className="bg-surface-800 rounded-lg p-4">
            <p className="text-sm text-surface-400 mb-1">Average IL</p>
            <p className={`text-2xl font-bold font-tabular ${
              ilStats.averageILPercent < 0 ? 'text-loss' : 'text-profit'
            }`}>
              {ilStats.averageILPercent.toFixed(2)}%
            </p>
          </div>
          <div className="bg-surface-800 rounded-lg p-4">
            <p className="text-sm text-surface-400 mb-1">LP Positions</p>
            <p className="text-2xl font-bold text-surface-100">
              {ilStats.positionCount}
            </p>
          </div>
        </div>
      )}

      {/* IL Simulator */}
      {showSimulator && (
        <div className="mb-6 bg-surface-900 rounded-lg p-4">
          <ILSimulator onClose={() => setShowSimulator(false)} />
        </div>
      )}

      {/* Liquidation Risks */}
      {liquidationRisks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-md font-medium text-surface-200 mb-3">Liquidation Risk</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liquidationRisks
              .sort((a, b) => a.healthFactor - b.healthFactor)
              .slice(0, 4)
              .map(risk => (
                <LiquidationRiskCard key={risk.positionId} risk={risk} />
              ))}
          </div>
        </div>
      )}

      {/* IL Results */}
      {ilResults.size > 0 && (
        <div>
          <h3 className="text-md font-medium text-surface-200 mb-3">Impermanent Loss by Position</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(ilResults.values())
              .sort((a, b) => toDisplayNumber(a.impermanentLoss) - toDisplayNumber(b.impermanentLoss))
              .map(result => (
                <ILPositionCard key={result.positionId} result={result} />
              ))}
          </div>
        </div>
      )}

      {/* No IL Data Message */}
      {ilResults.size === 0 && lpPositions.length > 0 && (
        <div className="text-center py-6">
          <p className="text-surface-400 mb-2">
            IL calculation requires entry price data.
          </p>
          <p className="text-surface-500 text-sm">
            Calculate cost basis to see IL analysis for your LP positions.
          </p>
        </div>
      )}
    </Card>
  );
}

export default ILCalculator;
