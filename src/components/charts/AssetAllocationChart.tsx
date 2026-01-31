interface AllocationData {
  label: string;
  value: number;
  color: string;
}

interface AssetAllocationChartProps {
  data: AllocationData[];
  height?: number;
  title?: string;
}

// Color palette for assets
const COLORS = [
  '#7c3aed', // Purple
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export function AssetAllocationChart({ data, height = 250, title = 'Asset Allocation' }: AssetAllocationChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Sort by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Take top 8 and group the rest as "Other"
  const displayData = sortedData.slice(0, 8);
  const otherValue = sortedData.slice(8).reduce((sum, item) => sum + item.value, 0);

  if (otherValue > 0) {
    displayData.push({ label: 'Other', value: otherValue, color: '#6b7280' });
  }

  // Assign colors if not provided
  displayData.forEach((item, index) => {
    if (!item.color || item.color === '') {
      item.color = COLORS[index % COLORS.length];
    }
  });

  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-surface-100 mb-4">{title}</h3>}

      <div className="flex gap-6">
        {/* Donut Chart */}
        <div className="relative" style={{ width: height, height }}>
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {(() => {
              let currentAngle = 0;
              return displayData.map((item, index) => {
                const percentage = (item.value / total) * 100;
                const angle = (percentage / 100) * 360;
                const startAngle = currentAngle;
                currentAngle += angle;

                // Calculate arc path
                const radius = 40;
                const innerRadius = 25;
                const centerX = 50;
                const centerY = 50;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = ((startAngle + angle) * Math.PI) / 180;

                const x1 = centerX + radius * Math.cos(startRad);
                const y1 = centerY + radius * Math.sin(startRad);
                const x2 = centerX + radius * Math.cos(endRad);
                const y2 = centerY + radius * Math.sin(endRad);

                const x3 = centerX + innerRadius * Math.cos(endRad);
                const y3 = centerY + innerRadius * Math.sin(endRad);
                const x4 = centerX + innerRadius * Math.cos(startRad);
                const y4 = centerY + innerRadius * Math.sin(startRad);

                const largeArc = angle > 180 ? 1 : 0;

                const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

                return (
                  <path
                    key={index}
                    d={d}
                    fill={item.color}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                  >
                    <title>{`${item.label}: $${item.value.toLocaleString()} (${percentage.toFixed(1)}%)`}</title>
                  </path>
                );
              });
            })()}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl font-bold text-surface-100">
                ${total >= 1000000
                  ? (total / 1000000).toFixed(2) + 'M'
                  : total >= 1000
                  ? (total / 1000).toFixed(1) + 'K'
                  : total.toFixed(0)}
              </p>
              <p className="text-xs text-surface-500">Total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-2 content-start">
          {displayData.map((item, index) => {
            const percentage = (item.value / total) * 100;
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-surface-300 truncate">{item.label}</span>
                <span className="text-surface-500 ml-auto">{percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Category Allocation Chart (CEX vs On-chain vs DeFi)
interface CategoryAllocationProps {
  cexValue: number;
  onchainValue: number;
  defiValue: number;
}

export function CategoryAllocationChart({
  cexValue,
  onchainValue,
  defiValue,
}: CategoryAllocationProps) {
  const data: AllocationData[] = [
    { label: 'CEX', value: cexValue, color: '#7c3aed' },
    { label: 'On-chain', value: onchainValue, color: '#06b6d4' },
    { label: 'DeFi', value: defiValue, color: '#10b981' },
  ].filter((d) => d.value > 0);

  const total = cexValue + onchainValue + defiValue;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-surface-500">
        No allocation data available
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-surface-100 mb-4">Portfolio Distribution</h3>

      {/* Horizontal bar */}
      <div className="h-8 flex rounded-lg overflow-hidden mb-4">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          return (
            <div
              key={index}
              className="transition-all duration-300 hover:opacity-80"
              style={{
                width: `${percentage}%`,
                backgroundColor: item.color,
                minWidth: percentage > 0 ? '24px' : '0',
              }}
              title={`${item.label}: $${item.value.toLocaleString()} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="grid grid-cols-3 gap-4">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          return (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-surface-300">{item.label}</span>
              </div>
              <p className="text-lg font-semibold text-surface-100">
                ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-surface-500">{percentage.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
