import { ReactNode } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  priority?: number; // Lower = more important, shown first on mobile
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
  mobileCardRender?: (item: T) => ReactNode;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'No data',
  className = '',
  onRowClick,
  mobileCardRender,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-surface-500">
        {emptyMessage}
      </div>
    );
  }

  // Sort columns by priority for mobile
  const mobileColumns = [...columns]
    .filter(col => !col.hideOnMobile)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  return (
    <div className={className}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-sm font-medium text-surface-400 ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`
                  hover:bg-surface-800/50 transition-colors
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-sm ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(item)
                      : String(item[col.key as keyof T] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className={`
              bg-surface-800 rounded-lg p-4
              ${onRowClick ? 'cursor-pointer active:bg-surface-700' : ''}
            `}
            onClick={() => onRowClick?.(item)}
          >
            {mobileCardRender ? (
              mobileCardRender(item)
            ) : (
              <div className="space-y-2">
                {mobileColumns.map((col, index) => (
                  <div
                    key={String(col.key)}
                    className={`
                      flex items-center justify-between
                      ${index === 0 ? 'text-base font-medium' : 'text-sm'}
                    `}
                  >
                    <span className="text-surface-400">{col.header}</span>
                    <span className={index === 0 ? 'text-surface-100' : 'text-surface-300'}>
                      {col.render
                        ? col.render(item)
                        : String(item[col.key as keyof T] ?? '-')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper component for mobile-first data display
interface DataRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function DataRow({ label, value, className = '' }: DataRowProps) {
  return (
    <div className={`flex items-center justify-between py-2 ${className}`}>
      <span className="text-sm text-surface-400">{label}</span>
      <span className="text-sm text-surface-100">{value}</span>
    </div>
  );
}

// Mobile-optimized stat card
interface MobileStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  onClick?: () => void;
}

export function MobileStatCard({ title, value, subtitle, trend, icon, onClick }: MobileStatCardProps) {
  return (
    <div
      className={`
        bg-surface-900 rounded-lg p-4 min-w-[140px]
        ${onClick ? 'cursor-pointer active:bg-surface-800' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-surface-400 uppercase tracking-wider">{title}</span>
        {icon && <span className="text-surface-500">{icon}</span>}
      </div>
      <div className="text-xl font-semibold text-surface-100 font-tabular">{value}</div>
      {subtitle && (
        <div
          className={`text-xs mt-1 ${
            trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-loss' : 'text-surface-400'
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

// Horizontal scroll container for mobile stat cards
interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

export function HorizontalScroll({ children, className = '' }: HorizontalScrollProps) {
  return (
    <div
      className={`
        flex gap-3 overflow-x-auto pb-2 -mx-4 px-4
        scrollbar-hide snap-x snap-mandatory
        md:mx-0 md:px-0 md:overflow-visible md:flex-wrap
        ${className}
      `}
    >
      {children}
    </div>
  );
}
