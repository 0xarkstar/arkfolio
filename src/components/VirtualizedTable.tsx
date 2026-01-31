import { useState, useMemo, useRef, useCallback, ReactNode, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SkeletonTableRow } from './Skeleton';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

interface VirtualizedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  sortable?: boolean;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  stickyHeader?: boolean;
  compact?: boolean;
  striped?: boolean;
  className?: string;
  /** Height of the table container. Required for virtualization. */
  height?: number | string;
  /** Estimated row height for virtualization */
  estimatedRowHeight?: number;
  /** Use virtualization only when data exceeds this threshold */
  virtualizationThreshold?: number;
}

// Memoized row component to prevent unnecessary re-renders
const TableRow = memo(function TableRow<T extends Record<string, unknown>>({
  item,
  columns,
  onRowClick,
  striped,
  index,
  cellPadding,
  getAlignmentClass,
}: {
  item: T;
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  striped?: boolean;
  index: number;
  cellPadding: string;
  getAlignmentClass: (align?: 'left' | 'center' | 'right') => string;
}) {
  const handleClick = useCallback(() => {
    onRowClick?.(item);
  }, [item, onRowClick]);

  return (
    <tr
      onClick={onRowClick ? handleClick : undefined}
      className={`
        border-b border-surface-800/50 last:border-0
        ${onRowClick ? 'cursor-pointer hover:bg-surface-800/50' : ''}
        ${striped && index % 2 === 1 ? 'bg-surface-800/30' : ''}
        transition-colors
      `}
      role="row"
      aria-rowindex={index + 2}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          className={`
            ${cellPadding} text-sm text-surface-200
            ${getAlignmentClass(column.align)}
            ${column.className || ''}
          `}
          role="cell"
        >
          {column.render
            ? column.render(item)
            : String(item[column.key] ?? '')}
        </td>
      ))}
    </tr>
  );
});

export function VirtualizedTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  loading = false,
  loadingRows = 5,
  emptyMessage = 'No data available',
  emptyDescription,
  onRowClick,
  sortable = true,
  defaultSortKey,
  defaultSortDirection = 'asc',
  stickyHeader = true,
  compact = false,
  striped = false,
  className = '',
  height = 500,
  estimatedRowHeight = 48,
  virtualizationThreshold = 100,
}: VirtualizedTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const parentRef = useRef<HTMLDivElement>(null);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  // Use virtualization only for large datasets
  const useVirtual = sortedData.length > virtualizationThreshold;

  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10, // Render 10 extra rows for smooth scrolling
    enabled: useVirtual,
  });

  const handleSort = useCallback((key: string, isSortable: boolean) => {
    if (!sortable || !isSortable) return;

    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }, [sortable, sortKey]);

  const getAlignmentClass = useCallback((align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  }, []);

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  const renderHeader = () => (
    <thead className={stickyHeader ? 'sticky top-0 bg-surface-900 z-10' : ''}>
      <tr className="border-b border-surface-800" role="row">
        {columns.map((column) => {
          const isSortable = sortable && column.sortable !== false;
          const isSorted = sortKey === column.key;

          return (
            <th
              key={column.key}
              onClick={() => handleSort(column.key, isSortable)}
              className={`
                ${cellPadding} text-xs font-medium text-surface-400 uppercase tracking-wider
                ${getAlignmentClass(column.align)}
                ${isSortable ? 'cursor-pointer hover:text-surface-200 select-none' : ''}
                ${column.className || ''}
              `}
              style={{ width: column.width }}
              scope="col"
              role="columnheader"
              aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                {column.header}
                {isSortable && (
                  <span className={`transition-colors ${isSorted ? 'text-primary-400' : 'text-surface-600'}`} aria-hidden="true">
                    {isSorted ? (
                      sortDirection === 'asc' ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    )}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );

  if (loading) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full" role="table">
          {renderHeader()}
          <tbody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <SkeletonTableRow key={i} columns={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full" role="table">
          {renderHeader()}
          <tbody>
            <tr>
              <td colSpan={columns.length} className="py-12">
                <EmptyState
                  icon="📊"
                  title={emptyMessage}
                  description={emptyDescription}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Non-virtualized rendering for small datasets
  if (!useVirtual) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full" role="table" aria-rowcount={sortedData.length + 1}>
          {renderHeader()}
          <tbody>
            {sortedData.map((item, index) => (
              <TableRow
                key={keyExtractor(item)}
                item={item}
                columns={columns as Column<Record<string, unknown>>[]}
                onRowClick={onRowClick as ((item: Record<string, unknown>) => void) | undefined}
                striped={striped}
                index={index}
                cellPadding={cellPadding}
                getAlignmentClass={getAlignmentClass}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Virtualized rendering for large datasets
  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      role="region"
      aria-label="Scrollable data table"
    >
      <table className="w-full" role="table" aria-rowcount={sortedData.length + 1}>
        {renderHeader()}
        <tbody
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = sortedData[virtualRow.index];
            return (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                data-index={virtualRow.index}
                className={`
                  border-b border-surface-800/50
                  ${onRowClick ? 'cursor-pointer hover:bg-surface-800/50' : ''}
                  ${striped && virtualRow.index % 2 === 1 ? 'bg-surface-800/30' : ''}
                  transition-colors
                `}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'table-row',
                }}
                role="row"
                aria-rowindex={virtualRow.index + 2}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      ${cellPadding} text-sm text-surface-200
                      ${getAlignmentClass(column.align)}
                      ${column.className || ''}
                    `}
                    role="cell"
                  >
                    {column.render
                      ? column.render(item)
                      : String(item[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Export type for use in other components
export type { Column as VirtualizedTableColumn };
