import { useState, useMemo, ReactNode } from 'react';
import { SkeletonTableRow } from './Skeleton';
import { EmptyState, NoDataEmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
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
}

export function DataTable<T extends Record<string, unknown>>({
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
  stickyHeader = false,
  compact = false,
  striped = false,
  className = '',
}: DataTableProps<T>): JSX.Element {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

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

  const handleSort = (key: string, isSortable: boolean) => {
    if (!sortable || !isSortable) return;

    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full" role="table" aria-rowcount={data.length + 1}>
        <thead className={stickyHeader ? 'sticky top-0 bg-surface-900 z-10' : ''}>
          <tr className="border-b border-surface-800">
            {columns.map((column) => {
              const isSortable = sortable && column.sortable !== false;
              const isSorted = sortKey === column.key;

              return (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key, isSortable)}
                  scope="col"
                  role="columnheader"
                  aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`
                    ${cellPadding} text-xs font-medium text-surface-400 uppercase tracking-wider
                    ${getAlignmentClass(column.align)}
                    ${isSortable ? 'cursor-pointer hover:text-surface-200 select-none' : ''}
                    ${column.className || ''}
                  `}
                  style={{ width: column.width }}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                    {column.header}
                    {isSortable && (
                      <span className={`transition-colors ${isSorted ? 'text-primary-400' : 'text-surface-600'}`}>
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
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <SkeletonTableRow key={i} columns={columns.length} />
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                <EmptyState
                  icon="📊"
                  title={emptyMessage}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            sortedData.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                role="row"
                aria-rowindex={index + 2}
                className={`
                  border-b border-surface-800/50 last:border-0
                  ${onRowClick ? 'cursor-pointer hover:bg-surface-800/50' : ''}
                  ${striped && index % 2 === 1 ? 'bg-surface-800/30' : ''}
                  transition-colors
                `}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    role="cell"
                    className={`
                      ${cellPadding} text-sm text-surface-200
                      ${getAlignmentClass(column.align)}
                      ${column.className || ''}
                    `}
                  >
                    {column.render
                      ? column.render(item)
                      : String(item[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Simple table for basic use cases
interface SimpleTableProps {
  headers: string[];
  rows: ReactNode[][];
  loading?: boolean;
  loadingRows?: number;
  className?: string;
}

export function SimpleTable({
  headers,
  rows,
  loading = false,
  loadingRows = 5,
  className = '',
}: SimpleTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-800">
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <SkeletonTableRow key={i} columns={headers.length} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-12">
                <NoDataEmptyState />
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-surface-800/50 last:border-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-3 text-sm text-surface-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
