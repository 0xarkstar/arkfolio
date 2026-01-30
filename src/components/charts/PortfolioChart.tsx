import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';

interface PortfolioChartProps {
  data?: { time: string; value: number }[];
  height?: number;
  showTooltip?: boolean;
}

type Period = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

// Generate mock data for demonstration
function generateMockData(period: Period): { time: string; value: number }[] {
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
  let value = 100000 + Math.random() * 50000;

  for (let i = totalPoints; i >= 0; i--) {
    const date = new Date(now.getTime() - i * interval * 60 * 60 * 1000);
    const change = (Math.random() - 0.48) * value * 0.02;
    value = Math.max(value + change, 10000);

    data.push({
      time: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
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

export function PortfolioChart({ height = 300, showTooltip = true }: PortfolioChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1M');
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number>(0);

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
          setCurrentValue(data.value as number);
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

    const data = generateMockData(selectedPeriod);
    const chartData: LineData[] = data.map(d => ({
      time: d.time as Time,
      value: d.value,
    }));

    seriesRef.current.setData(chartData);

    // Calculate change
    if (data.length >= 2) {
      const startValue = data[0].value;
      const endValue = data[data.length - 1].value;
      const change = ((endValue - startValue) / startValue) * 100;
      setChangePercent(change);
      setCurrentValue(endValue);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [selectedPeriod]);

  const periods: Period[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
  const isPositive = changePercent >= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {currentValue !== null && (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-surface-100 font-tabular">
                ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
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
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
