import { useEffect, useRef } from 'react';
import { createChart, IChartApi, Time, LineData } from 'lightweight-charts';

interface PerformanceData {
  label: string;
  data: { time: string; value: number }[];
  color: string;
}

interface PerformanceChartProps {
  series: PerformanceData[];
  height?: number;
  title?: string;
  showLegend?: boolean;
}

export function PerformanceChart({
  series,
  height = 300,
  title = 'Performance Comparison',
  showLegend = true,
}: PerformanceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || series.length === 0) return;

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
      },
    });

    chartRef.current = chart;

    // Add each series as a line
    series.forEach((s) => {
      const lineSeries = chart.addLineSeries({
        color: s.color,
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => price.toFixed(2) + '%',
        },
      });

      // Convert data to percentage change from first value
      const firstValue = s.data[0]?.value || 0;
      const normalizedData: LineData[] = s.data.map((d) => ({
        time: d.time as Time,
        value: firstValue > 0 ? ((d.value - firstValue) / firstValue) * 100 : 0,
      }));

      lineSeries.setData(normalizedData);
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [series, height]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-500">
        No performance data available
      </div>
    );
  }

  // Calculate final performance for each series
  const performances = series.map((s) => {
    const firstValue = s.data[0]?.value || 0;
    const lastValue = s.data[s.data.length - 1]?.value || 0;
    const change = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    return { label: s.label, change, color: s.color };
  });

  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-surface-100 mb-4">{title}</h3>}

      {showLegend && (
        <div className="flex flex-wrap gap-4 mb-4">
          {performances.map((p, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 rounded-lg hover:bg-surface-700 transition-colors"
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-sm text-surface-300">{p.label}</span>
              <span
                className={`text-sm font-medium ${
                  p.change >= 0 ? 'text-profit' : 'text-loss'
                }`}
              >
                {p.change >= 0 ? '+' : ''}
                {p.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div ref={chartContainerRef} />
    </div>
  );
}

// Performance Stats Cards
interface PerformanceStatsProps {
  totalReturn: number;
  totalReturnPercent: number;
  dayReturn: number;
  dayReturnPercent: number;
  weekReturn: number;
  weekReturnPercent: number;
  monthReturn: number;
  monthReturnPercent: number;
}

export function PerformanceStats({
  totalReturn,
  totalReturnPercent,
  dayReturn,
  dayReturnPercent,
  weekReturn,
  weekReturnPercent,
  monthReturn,
  monthReturnPercent,
}: PerformanceStatsProps) {
  const stats = [
    { label: '24h', value: dayReturn, percent: dayReturnPercent },
    { label: '7d', value: weekReturn, percent: weekReturnPercent },
    { label: '30d', value: monthReturn, percent: monthReturnPercent },
    { label: 'All Time', value: totalReturn, percent: totalReturnPercent },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="p-4 bg-surface-800 rounded-lg">
          <p className="text-sm text-surface-400 mb-1">{stat.label}</p>
          <p
            className={`text-lg font-semibold ${
              stat.value >= 0 ? 'text-profit' : 'text-loss'
            }`}
          >
            {stat.value >= 0 ? '+' : ''}$
            {Math.abs(stat.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p
            className={`text-sm ${stat.percent >= 0 ? 'text-profit' : 'text-loss'}`}
          >
            {stat.percent >= 0 ? '+' : ''}
            {stat.percent.toFixed(2)}%
          </p>
        </div>
      ))}
    </div>
  );
}
