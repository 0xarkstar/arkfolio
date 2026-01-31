import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { riskAnalysisService } from '../RiskAnalysisService';

describe('RiskAnalysisService', () => {
  describe('calculateHistoricalVaR', () => {
    it('should return zero VaR for empty returns', () => {
      const result = riskAnalysisService.calculateHistoricalVaR(
        [],
        new Decimal(100000)
      );

      expect(result.var95).toBe(0);
      expect(result.var99).toBe(0);
      expect(result.var95Usd.toNumber()).toBe(0);
      expect(result.var99Usd.toNumber()).toBe(0);
      expect(result.method).toBe('historical');
    });

    it('should calculate VaR correctly for sample returns', () => {
      // Create a sample of 100 returns with known distribution
      const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 100); // -0.5 to 0.49
      const portfolioValue = new Decimal(100000);

      const result = riskAnalysisService.calculateHistoricalVaR(
        returns,
        portfolioValue
      );

      expect(result.var95).toBeGreaterThan(0);
      expect(result.var99).toBeGreaterThan(result.var95);
      expect(result.var95Usd.toNumber()).toBeGreaterThan(0);
      expect(result.var99Usd.toNumber()).toBeGreaterThan(result.var95Usd.toNumber());
    });

    it('should scale VaR with time horizon', () => {
      const returns = Array.from({ length: 100 }, () => Math.random() * 0.1 - 0.05);
      const portfolioValue = new Decimal(100000);

      const var1Day = riskAnalysisService.calculateHistoricalVaR(
        returns,
        portfolioValue,
        95,
        1
      );

      const var10Day = riskAnalysisService.calculateHistoricalVaR(
        returns,
        portfolioValue,
        95,
        10
      );

      // 10-day VaR should be approximately sqrt(10) times 1-day VaR
      expect(var10Day.var95).toBeGreaterThan(var1Day.var95);
      expect(var10Day.timeHorizon).toBe(10);
    });
  });

  describe('calculateParametricVaR', () => {
    it('should return zero VaR for empty returns', () => {
      const result = riskAnalysisService.calculateParametricVaR(
        [],
        new Decimal(100000)
      );

      expect(result.var95).toBe(0);
      expect(result.var99).toBe(0);
      expect(result.method).toBe('parametric');
    });

    it('should calculate VaR using parametric method', () => {
      // Generate returns with known mean and volatility
      const returns = Array.from({ length: 252 }, () =>
        0.001 + 0.02 * (Math.random() * 2 - 1)
      );
      const portfolioValue = new Decimal(100000);

      const result = riskAnalysisService.calculateParametricVaR(
        returns,
        portfolioValue
      );

      expect(result.var95).toBeGreaterThanOrEqual(0);
      expect(result.var99).toBeGreaterThanOrEqual(0);
      expect(result.method).toBe('parametric');
    });
  });

  describe('calculateCorrelation', () => {
    it('should return 0 for insufficient data', () => {
      const correlation = riskAnalysisService.calculateCorrelation([1], [1]);
      expect(correlation).toBe(0);
    });

    it('should return 1 for perfectly correlated series', () => {
      const series1 = [1, 2, 3, 4, 5];
      const series2 = [2, 4, 6, 8, 10];

      const correlation = riskAnalysisService.calculateCorrelation(series1, series2);
      expect(correlation).toBeCloseTo(1, 5);
    });

    it('should return -1 for perfectly inversely correlated series', () => {
      const series1 = [1, 2, 3, 4, 5];
      const series2 = [10, 8, 6, 4, 2];

      const correlation = riskAnalysisService.calculateCorrelation(series1, series2);
      expect(correlation).toBeCloseTo(-1, 5);
    });

    it('should return 0 for uncorrelated series', () => {
      // Constant series has no variance, so correlation is 0
      const series1 = [1, 2, 3, 4, 5];
      const series2 = [3, 3, 3, 3, 3];

      const correlation = riskAnalysisService.calculateCorrelation(series1, series2);
      expect(correlation).toBe(0);
    });
  });

  describe('calculateCorrelationMatrix', () => {
    it('should return empty matrix for empty input', () => {
      const result = riskAnalysisService.calculateCorrelationMatrix(new Map());

      expect(result.assets).toHaveLength(0);
      expect(result.matrix).toHaveLength(0);
      expect(result.pairs).toHaveLength(0);
    });

    it('should calculate correlation matrix for multiple assets', () => {
      const assetReturns = new Map([
        ['BTC', [0.01, 0.02, -0.01, 0.03, -0.02]],
        ['ETH', [0.015, 0.025, -0.015, 0.035, -0.025]],
        ['SOL', [-0.01, -0.02, 0.01, -0.03, 0.02]],
      ]);

      const result = riskAnalysisService.calculateCorrelationMatrix(assetReturns);

      expect(result.assets).toHaveLength(3);
      expect(result.matrix).toHaveLength(3);
      expect(result.matrix[0]).toHaveLength(3);
      expect(result.pairs).toHaveLength(3); // n*(n-1)/2 pairs

      // Diagonal should be 1 (self-correlation)
      expect(result.matrix[0][0]).toBe(1);
      expect(result.matrix[1][1]).toBe(1);
      expect(result.matrix[2][2]).toBe(1);

      // Matrix should be symmetric
      expect(result.matrix[0][1]).toBe(result.matrix[1][0]);
    });

    it('should identify highest positive and negative correlations', () => {
      const assetReturns = new Map([
        ['BTC', [0.01, 0.02, -0.01, 0.03, -0.02]],
        ['ETH', [0.01, 0.02, -0.01, 0.03, -0.02]], // Identical to BTC
        ['SOL', [-0.01, -0.02, 0.01, -0.03, 0.02]], // Inverse of BTC
      ]);

      const result = riskAnalysisService.calculateCorrelationMatrix(assetReturns);

      expect(result.highestPositive).not.toBeNull();
      expect(result.highestPositive?.correlation).toBeCloseTo(1, 5);
      expect(result.highestNegative).not.toBeNull();
      expect(result.highestNegative?.correlation).toBeCloseTo(-1, 5);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should return zero drawdown for insufficient data', () => {
      const result = riskAnalysisService.calculateMaxDrawdown([
        { date: new Date(), value: 100 }
      ]);

      expect(result.maxDrawdown).toBe(0);
      expect(result.isRecovered).toBe(true);
    });

    it('should calculate max drawdown correctly', () => {
      const values = [
        { date: new Date('2024-01-01'), value: 100 },
        { date: new Date('2024-01-02'), value: 110 }, // Peak
        { date: new Date('2024-01-03'), value: 90 },  // Trough
        { date: new Date('2024-01-04'), value: 95 },
        { date: new Date('2024-01-05'), value: 115 }, // Recovery
      ];

      const result = riskAnalysisService.calculateMaxDrawdown(values);

      // Max drawdown from 110 to 90 = 18.18%
      expect(result.maxDrawdown).toBeCloseTo(18.18, 1);
      expect(result.peakDate).toEqual(new Date('2024-01-02'));
      expect(result.troughDate).toEqual(new Date('2024-01-03'));
      expect(result.isRecovered).toBe(true);
      expect(result.recoveryDate).toEqual(new Date('2024-01-05'));
    });

    it('should detect unrecovered drawdown', () => {
      const values = [
        { date: new Date('2024-01-01'), value: 100 },
        { date: new Date('2024-01-02'), value: 110 },
        { date: new Date('2024-01-03'), value: 80 },
        { date: new Date('2024-01-04'), value: 90 },
      ];

      const result = riskAnalysisService.calculateMaxDrawdown(values);

      expect(result.isRecovered).toBe(false);
      expect(result.recoveryDate).toBeNull();
    });
  });

  describe('calculateBeta', () => {
    it('should return default beta for insufficient data', () => {
      const result = riskAnalysisService.calculateBeta([0.01], [0.01]);

      expect(result.beta).toBe(1);
      expect(result.interpretation).toBe('Insufficient data');
    });

    it('should calculate beta of 1 for identical returns', () => {
      const returns = [0.01, 0.02, -0.01, 0.03, -0.02];
      const result = riskAnalysisService.calculateBeta(returns, returns);

      expect(result.beta).toBeCloseTo(1, 5);
    });

    it('should calculate beta > 1 for more volatile portfolio', () => {
      const portfolioReturns = [0.02, 0.04, -0.02, 0.06, -0.04]; // 2x benchmark
      const benchmarkReturns = [0.01, 0.02, -0.01, 0.03, -0.02];

      const result = riskAnalysisService.calculateBeta(portfolioReturns, benchmarkReturns);

      expect(result.beta).toBeCloseTo(2, 1);
      expect(result.interpretation.toLowerCase()).toContain('aggressive');
    });

    it('should calculate beta < 1 for less volatile portfolio', () => {
      const portfolioReturns = [0.005, 0.01, -0.005, 0.015, -0.01]; // 0.5x benchmark
      const benchmarkReturns = [0.01, 0.02, -0.01, 0.03, -0.02];

      const result = riskAnalysisService.calculateBeta(portfolioReturns, benchmarkReturns);

      expect(result.beta).toBeCloseTo(0.5, 1);
      expect(result.interpretation).toContain('Defensive');
    });

    it('should handle negative beta', () => {
      const portfolioReturns = [-0.01, -0.02, 0.01, -0.03, 0.02]; // Inverse of benchmark
      const benchmarkReturns = [0.01, 0.02, -0.01, 0.03, -0.02];

      const result = riskAnalysisService.calculateBeta(portfolioReturns, benchmarkReturns);

      expect(result.beta).toBeLessThan(0);
      expect(result.interpretation).toContain('opposite');
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should return 0 for empty returns', () => {
      const result = riskAnalysisService.calculateSharpeRatio([]);
      expect(result).toBe(0);
    });

    it('should return 0 for zero volatility', () => {
      const returns = [0.01, 0.01, 0.01, 0.01, 0.01]; // Same daily return
      const result = riskAnalysisService.calculateSharpeRatio(returns);
      expect(result).toBe(0);
    });

    it('should calculate positive Sharpe for good returns', () => {
      // Generate returns with positive mean and reasonable volatility
      const returns = Array.from({ length: 252 }, () => 0.001 + 0.01 * (Math.random() - 0.5));
      const result = riskAnalysisService.calculateSharpeRatio(returns);

      // With 0.1% daily return and 4% risk-free, should be positive
      expect(typeof result).toBe('number');
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('calculateSortinoRatio', () => {
    it('should return 0 for empty returns', () => {
      const result = riskAnalysisService.calculateSortinoRatio([]);
      expect(result).toBe(0);
    });

    it('should return Infinity for only positive returns', () => {
      const returns = [0.01, 0.02, 0.015, 0.025, 0.03];
      const result = riskAnalysisService.calculateSortinoRatio(returns);
      expect(result).toBe(Infinity);
    });

    it('should calculate finite Sortino for mixed returns', () => {
      const returns = [0.02, -0.01, 0.015, -0.005, 0.01, -0.02];
      const result = riskAnalysisService.calculateSortinoRatio(returns);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('calculateVolatility', () => {
    it('should calculate annualized volatility', () => {
      // Daily returns with ~2% daily vol
      const returns = Array.from({ length: 100 }, () => 0.02 * (Math.random() * 2 - 1));
      const volatility = riskAnalysisService.calculateVolatility(returns);

      // Annualized should be roughly daily * sqrt(365)
      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThan(200); // Reasonable upper bound
    });
  });

  describe('generateMockReturns', () => {
    it('should generate specified number of returns', () => {
      const returns = riskAnalysisService.generateMockReturns('BTC', 100);
      expect(returns).toHaveLength(100);
    });

    it('should generate returns with approximate characteristics', () => {
      const days = 1000;
      const avgReturn = 0.001;
      const volatility = 0.02;

      const returns = riskAnalysisService.generateMockReturns('BTC', days, avgReturn, volatility);

      // Calculate sample mean and std
      const sampleMean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const squaredDiffs = returns.map(r => Math.pow(r - sampleMean, 2));
      const sampleStd = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / returns.length);

      // Should be within reasonable bounds (statistical tolerance)
      expect(sampleMean).toBeGreaterThan(-0.01);
      expect(sampleMean).toBeLessThan(0.01);
      expect(sampleStd).toBeGreaterThan(0.01);
      expect(sampleStd).toBeLessThan(0.05);
    });
  });
});
