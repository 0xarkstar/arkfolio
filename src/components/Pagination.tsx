import { useState } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  maxVisiblePages = 5,
  size = 'md',
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(currentPage - half, 1);
    const end = Math.min(start + maxVisiblePages - 1, totalPages);

    if (end - start < maxVisiblePages - 1) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('ellipsis');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const buttonSize = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`
          ${buttonSize} flex items-center justify-center rounded-lg
          text-surface-400 hover:text-surface-100 hover:bg-surface-800
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
          transition-colors
        `}
        aria-label="Previous page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className={`${buttonSize} flex items-center justify-center text-surface-500`}
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  ${buttonSize} flex items-center justify-center rounded-lg
                  font-medium transition-colors
                  ${currentPage === page
                    ? 'bg-primary-500 text-white'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
                  }
                `}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`
          ${buttonSize} flex items-center justify-center rounded-lg
          text-surface-400 hover:text-surface-100 hover:bg-surface-800
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
          transition-colors
        `}
        aria-label="Next page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}

// Simple pagination with page info
interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SimplePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}: SimplePaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-sm text-surface-400">
        Showing <span className="font-medium text-surface-200">{startItem}</span> to{' '}
        <span className="font-medium text-surface-200">{endItem}</span> of{' '}
        <span className="font-medium text-surface-200">{totalItems}</span> results
      </p>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        showPageNumbers={false}
        size="sm"
      />
    </div>
  );
}

// Load more button (alternative to pagination)
interface LoadMoreProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  loadedCount?: number;
  totalCount?: number;
  className?: string;
}

export function LoadMore({
  hasMore,
  loading = false,
  onLoadMore,
  loadedCount,
  totalCount,
  className = '',
}: LoadMoreProps) {
  if (!hasMore && !loading) return null;

  return (
    <div className={`text-center ${className}`}>
      {loadedCount !== undefined && totalCount !== undefined && (
        <p className="text-xs text-surface-500 mb-2">
          Showing {loadedCount} of {totalCount}
        </p>
      )}
      <button
        onClick={onLoadMore}
        disabled={loading || !hasMore}
        className="px-4 py-2 text-sm font-medium text-primary-400 hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </span>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  );
}

// Hook for pagination state
export function usePagination<T>(items: T[], pageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);

  // Reset to page 1 when items change significantly
  const resetPage = () => setCurrentPage(1);

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems: items.length,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    resetPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
