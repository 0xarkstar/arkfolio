import Decimal from 'decimal.js';

export interface VaRResult {
  var95: number; // 95% VaR as percentage
  var99: number; // 99% VaR as percentage
  var95Usd: Decimal; // 95% VaR in USD
  var99Usd: Decimal; // 99% VaR in USD
  confidenceLevel: number;
  timeHorizon: number; // in days
  method: 'historical' | 'parametric';
}

export interface CorrelationPair {
  asset1: string;
  asset2: string;
  correlation: number;
}

export interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
  pairs: CorrelationPair[];
  highestPositive: CorrelationPair | null;
  highestNegative: CorrelationPair | null;
}

export interface MaxDrawdownResult {
  maxDrawdown: number; // as percentage
  maxDrawdownUsd: Decimal;
  peakDate: Date | null;
  troughDate: Date | null;
  recoveryDate: Date | null;
  isRecovered: boolean;
}

export interface PortfolioBetaResult {
  beta: number;
  benchmark: string;
  interpretation: string;
}

export interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  volatility: number;
  maxDrawdown: MaxDrawdownResult;
  var: VaRResult;
  beta: PortfolioBetaResult;
}


class RiskAnalysisService {
  /**
   * Calculate standard deviation
   */
  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate Historical VaR (Value at Risk)
   * @param returns Array of historical returns
   * @param portfolioValue Current portfolio value in USD
   * @param confidenceLevel Confidence level (default 95%)
   * @param timeHorizon Time horizon in days (default 1)
   */
  calculateHistoricalVaR(
    returns: number[],
    portfolioValue: Decimal,
    confidenceLevel: number = 95,
    timeHorizon: number = 1
  ): VaRResult {
    if (returns.length === 0) {
      return {
        var95: 0,
        var99: 0,
        var95Usd: new Decimal(0),
        var99Usd: new Decimal(0),
        confidenceLevel,
        timeHorizon,
        method: 'historical',
      };
    }

    // Sort returns in ascending order
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Find VaR at different confidence levels
    const var95Index = Math.floor((1 - 0.95) * sortedReturns.length);
    const var99Index = Math.floor((1 - 0.99) * sortedReturns.length);

    const var95Return = sortedReturns[var95Index] || 0;
    const var99Return = sortedReturns[var99Index] || 0;

    // Scale for time horizon (assumes sqrt(time) scaling)
    const scaleFactor = Math.sqrt(timeHorizon);

    const var95 = Math.abs(var95Return) * scaleFactor * 100;
    const var99 = Math.abs(var99Return) * scaleFactor * 100;

    return {
      var95,
      var99,
      var95Usd: portfolioValue.times(Math.abs(var95Return) * scaleFactor),
      var99Usd: portfolioValue.times(Math.abs(var99Return) * scaleFactor),
      confidenceLevel,
      timeHorizon,
      method: 'historical',
    };
  }

  /**
   * Calculate Parametric VaR (assumes normal distribution)
   */
  calculateParametricVaR(
    returns: number[],
    portfolioValue: Decimal,
    confidenceLevel: number = 95,
    timeHorizon: number = 1
  ): VaRResult {
    if (returns.length === 0) {
      return {
        var95: 0,
        var99: 0,
        var95Usd: new Decimal(0),
        var99Usd: new Decimal(0),
        confidenceLevel,
        timeHorizon,
        method: 'parametric',
      };
    }

    const meanReturn = this.mean(returns);
    const volatility = this.stdDev(returns);

    // Z-scores for confidence levels
    const z95 = 1.645;
    const z99 = 2.326;

    // Scale for time horizon
    const scaleFactor = Math.sqrt(timeHorizon);

    const var95 = (meanReturn - z95 * volatility) * scaleFactor * -100;
    const var99 = (meanReturn - z99 * volatility) * scaleFactor * -100;

    return {
      var95: Math.max(0, var95),
      var99: Math.max(0, var99),
      var95Usd: portfolioValue.times(Math.max(0, -var95 / 100)),
      var99Usd: portfolioValue.times(Math.max(0, -var99 / 100)),
      confidenceLevel,
      timeHorizon,
      method: 'parametric',
    };
  }

  /**
   * Calculate correlation between two assets
   */
  calculateCorrelation(returns1: number[], returns2: number[]): number {
    const n = Math.min(returns1.length, returns2.length);
    if (n < 2) return 0;

    const r1 = returns1.slice(0, n);
    const r2 = returns2.slice(0, n);

    const mean1 = this.mean(r1);
    const mean2 = this.mean(r2);

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = r1[i] - mean1;
      const diff2 = r2[i] - mean2;
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Calculate correlation matrix for multiple assets
   */
  calculateCorrelationMatrix(assetReturns: Map<string, number[]>): CorrelationMatrix {
    const assets = Array.from(assetReturns.keys()).sort();
    const n = assets.length;
    const matrix: number[][] = [];
    const pairs: CorrelationPair[] = [];

    // Initialize matrix
    for (let i = 0; i < n; i++) {
      matrix.push(new Array(n).fill(0));
    }

    // Calculate correlations
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1; // Self-correlation is always 1
      for (let j = i + 1; j < n; j++) {
        const returns1 = assetReturns.get(assets[i]) || [];
        const returns2 = assetReturns.get(assets[j]) || [];
        const correlation = this.calculateCorrelation(returns1, returns2);
        matrix[i][j] = correlation;
        matrix[j][i] = correlation;

        pairs.push({
          asset1: assets[i],
          asset2: assets[j],
          correlation,
        });
      }
    }

    // Find extreme correlations
    let highestPositive: CorrelationPair | null = null;
    let highestNegative: CorrelationPair | null = null;

    for (const pair of pairs) {
      if (pair.correlation > 0) {
        if (!highestPositive || pair.correlation > highestPositive.correlation) {
          highestPositive = pair;
        }
      } else {
        if (!highestNegative || pair.correlation < highestNegative.correlation) {
          highestNegative = pair;
        }
      }
    }

    return {
      assets,
      matrix,
      pairs,
      highestPositive,
      highestNegative,
    };
  }

  /**
   * Calculate Maximum Drawdown
   */
  calculateMaxDrawdown(portfolioValues: { date: Date; value: number }[]): MaxDrawdownResult {
    if (portfolioValues.length < 2) {
      return {
        maxDrawdown: 0,
        maxDrawdownUsd: new Decimal(0),
        peakDate: null,
        troughDate: null,
        recoveryDate: null,
        isRecovered: true,
      };
    }

    let peak = portfolioValues[0].value;
    let peakDate = portfolioValues[0].date;
    let maxDrawdown = 0;
    let maxDrawdownUsd = 0;
    let maxDrawdownPeakDate = peakDate;
    let maxDrawdownTroughDate = portfolioValues[0].date;

    for (const point of portfolioValues) {
      if (point.value > peak) {
        peak = point.value;
        peakDate = point.date;
      }

      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownUsd = peak - point.value;
        maxDrawdownPeakDate = peakDate;
        maxDrawdownTroughDate = point.date;
      }
    }

    // Check for recovery
    let recoveryDate: Date | null = null;
    let isRecovered = false;
    const troughValue = portfolioValues.find(
      (p) => p.date.getTime() === maxDrawdownTroughDate.getTime()
    )?.value;

    if (troughValue) {
      for (const point of portfolioValues) {
        if (point.date > maxDrawdownTroughDate && point.value >= peak) {
          recoveryDate = point.date;
          isRecovered = true;
          break;
        }
      }
    }

    return {
      maxDrawdown: maxDrawdown * 100,
      maxDrawdownUsd: new Decimal(maxDrawdownUsd),
      peakDate: maxDrawdownPeakDate,
      troughDate: maxDrawdownTroughDate,
      recoveryDate,
      isRecovered,
    };
  }

  /**
   * Calculate Portfolio Beta (relative to BTC as benchmark)
   */
  calculateBeta(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    benchmarkName: string = 'BTC'
  ): PortfolioBetaResult {
    const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
    if (n < 2) {
      return { beta: 1, benchmark: benchmarkName, interpretation: 'Insufficient data' };
    }

    const pReturns = portfolioReturns.slice(0, n);
    const bReturns = benchmarkReturns.slice(0, n);

    const covariance = this.calculateCovariance(pReturns, bReturns);
    const benchmarkVariance = this.calculateVariance(bReturns);

    if (benchmarkVariance === 0) {
      return { beta: 1, benchmark: benchmarkName, interpretation: 'Benchmark has no variance' };
    }

    const beta = covariance / benchmarkVariance;

    let interpretation: string;
    if (beta > 1.5) {
      interpretation = 'Highly aggressive - significantly more volatile than market';
    } else if (beta > 1) {
      interpretation = 'Aggressive - more volatile than market';
    } else if (beta > 0.8) {
      interpretation = 'Neutral - similar volatility to market';
    } else if (beta > 0) {
      interpretation = 'Defensive - less volatile than market';
    } else {
      interpretation = 'Negative beta - moves opposite to market';
    }

    return { beta, benchmark: benchmarkName, interpretation };
  }

  /**
   * Calculate covariance
   */
  private calculateCovariance(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const meanX = this.mean(x.slice(0, n));
    const meanY = this.mean(y.slice(0, n));

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }

    return sum / n;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const std = this.stdDev(values);
    return std * std;
  }

  /**
   * Calculate Sharpe Ratio
   * @param returns Portfolio returns
   * @param riskFreeRate Annual risk-free rate (default 4% for current environment)
   */
  calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.04): number {
    if (returns.length === 0) return 0;

    const annualizedReturn = this.mean(returns) * 365;
    const annualizedVolatility = this.stdDev(returns) * Math.sqrt(365);

    if (annualizedVolatility === 0) return 0;

    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  /**
   * Calculate Sortino Ratio (considers only downside risk)
   */
  calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.04): number {
    if (returns.length === 0) return 0;

    const annualizedReturn = this.mean(returns) * 365;
    const dailyRiskFree = riskFreeRate / 365;

    // Calculate downside deviation (only negative returns)
    const negativeReturns = returns
      .map((r) => r - dailyRiskFree)
      .filter((r) => r < 0)
      .map((r) => r * r);

    if (negativeReturns.length === 0) return Infinity; // No downside risk

    const downsideDeviation = Math.sqrt(
      (negativeReturns.reduce((a, b) => a + b, 0) / returns.length) * 365
    );

    if (downsideDeviation === 0) return Infinity;

    return (annualizedReturn - riskFreeRate) / downsideDeviation;
  }

  /**
   * Calculate annualized volatility
   */
  calculateVolatility(returns: number[]): number {
    return this.stdDev(returns) * Math.sqrt(365) * 100;
  }

  /**
   * Generate mock historical returns for demonstration
   * In production, this would fetch real price history
   */
  generateMockReturns(
    _asset: string,
    days: number = 365,
    avgReturn: number = 0.001,
    volatility: number = 0.03
  ): number[] {
    const returns: number[] = [];
    for (let i = 0; i < days; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      returns.push(avgReturn + volatility * z);
    }
    return returns;
  }
}

export const riskAnalysisService = new RiskAnalysisService();
