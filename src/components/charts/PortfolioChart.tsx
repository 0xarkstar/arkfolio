import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { snapshotService, SnapshotPeriod, PortfolioDataPoint } from '../../services/portfolio/SnapshotService';

interface PortfolioChartProps {
  data?: { time: string; value: number }[];
  height?: number;
  showTooltip?: boolean;
  currentValue?: number; // Current portfolio value for real-time display
}

type Period = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

// Generate mock data when no real data is available
function generateMockData(period: Period, baseValue: number = 100000): { time: string; value: number }[] {
  const data: { time: string; value: number }[] = [];
  const now = new Date();
  let days: number;
  let interval: number; // hours between data points

  switch (period) {
    case '1D':
      days = 1;
      interval = 1;
      break;
    case '1W':
      days = 7;
      interval = 4;
      break;
    case '1M':
      days = 30;
      interval = 24;
      break;
    case '3M':
      days = 90;
      interval = 24;
      break;
    case '1Y':
      days = 365;
      interval = 24 * 7;
      break;
    case 'ALL':
      days = 730;
      interval = 24 * 7;
      break;
    default:
      days = 30;
      interval = 24;
  }

  const totalPoints = Math.floor((days * 24) / interval);
  let value = baseValue * 0.8 + Math.random() * baseValue * 0.4;

  for (let i = totalPoints; i >= 0; i--) {
    const date = new Date(now.getTime() - i * interval * 60 * 60 * 1000);
    const change = (Math.random() - 0.48) * value * 0.02;
    value = Math.max(value + change, baseValue * 0.5);

    data.push({
      time: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }

  // Make the last point match the current value
  if (data.length > 0) {
    data[data.length - 1].value = baseValue;
  }

  // Remove duplicates by time
  const uniqueData = data.reduce((acc, curr) => {
    const existing = acc.find(d => d.time === curr.time);
    if (!existing) {
      acc.push(curr);
    }
    return acc;
  }, [] as { time: string; value: number }[]);

  return uniqueData;
}

export function PortfolioChart({ height = 300, showTooltip = true, currentValue: propCurrentValue }: PortfolioChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1M');
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  // Fetch data from snapshot service
  const fetchChartData = useCallback(async (period: Period): Promise<PortfolioDataPoint[]> => {
    try {
      const snapshots = await snapshotService.getSnapshots(period as SnapshotPeriod);
      if (snapshots.length > 0) {
        setHasRealData(true);
        return snapshots;
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    }

    // Fall back to mock data
    setHasRealData(false);
    return generateMockData(period, propCurrentValue || 100000);
  }, [propCurrentValue]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(124, 58, 237, 0.5)',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: 'rgba(124, 58, 237, 0.5)',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      handleScale: {
        mouseWheel: false,
        pinch: false,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
      },
    });

    chartRef.current = chart;

    // Create area series
    const series = chart.addAreaSeries({
      lineColor: '#7c3aed',
      topColor: 'rgba(124, 58, 237, 0.4)',
      bottomColor: 'rgba(124, 58, 237, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => '$' + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      },
    });

    seriesRef.current = series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Subscribe to crosshair move for tooltip
    if (showTooltip) {
      chart.subscribeCrosshairMove((param) => {
        if (param.time && param.seriesData.get(series)) {
          const data = param.seriesData.get(series) as LineData;
          setDisplayValue(data.value as number);
        }
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height, showTooltip]);

  // Update data when period changes
  useEffect(() => {
    if (!seriesRef.current) return;

    setIsLoading(true);

    const loadData = async () => {
      const data = await fetchChartData(selectedPeriod);
      const chartData: LineData[] = data.map(d => ({
        time: d.time as Time,
        value: d.value,
      }));

      seriesRef.current?.setData(chartData);

      // Calculate change
      if (data.length >= 2) {
        const startValue = data[0].value;
        const endValue = data[data.length - 1].value;
        const change = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
        setChangePercent(change);
        setDisplayValue(endValue);
      } else if (propCurrentValue) {
        setDisplayValue(propCurrentValue);
        setChangePercent(0);
      }

      // Fit content
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      setIsLoading(false);
    };

    loadData();
  }, [selectedPeriod, fetchChartData, propCurrentValue]);

  const periods: Period[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
  const isPositive = changePercent >= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {isLoading ? (
            <div className="flex items-baseline gap-3 animate-pulse">
              <div className="h-8 w-32 bg-surface-700 rounded" />
              <div className="h-5 w-16 bg-surface-700 rounded" />
            </div>
          ) : displayValue !== null ? (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-surface-100 font-tabular">
                ${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
              {!hasRealData && (
                <span className="text-xs text-surface-500">(simulated)</span>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex gap-1">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              disabled={isLoading}
              className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
                selectedPeriod === period
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-100'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div ref={chartContainerRef} className={`w-full transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
