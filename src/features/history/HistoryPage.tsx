import { useEffect, useState, useCallback, memo } from 'react';
import { getDb } from '../../database/init';
import { Transaction } from '../../database/schema';
import { desc, eq, like, and, gte, lte } from 'drizzle-orm';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCard } from '../../components/Skeleton';
import { format } from 'date-fns';
import { logger } from '../../utils/logger';

type TransactionType = 'all' | 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'swap' | 'reward' | 'airdrop';

interface FilterState {
  type: TransactionType;
  asset: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

const ITEMS_PER_PAGE = 25;

// Memoized helper functions
const getTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'buy':
      return 'bg-profit/20 text-profit';
    case 'sell':
      return 'bg-loss/20 text-loss';
    case 'transfer_in':
    case 'reward':
    case 'airdrop':
      return 'bg-primary-500/20 text-primary-400';
    case 'transfer_out':
      return 'bg-warning/20 text-warning';
    case 'swap':
      return 'bg-surface-600 text-surface-300';
    default:
      return 'bg-surface-700 text-surface-400';
  }
};

const getTypeLabel = (type: string) => {
  switch (type.toLowerCase()) {
    case 'buy':
      return 'Buy';
    case 'sell':
      return 'Sell';
    case 'transfer_in':
      return 'Deposit';
    case 'transfer_out':
      return 'Withdraw';
    case 'swap':
      return 'Swap';
    case 'reward':
      return 'Reward';
    case 'airdrop':
      return 'Airdrop';
    default:
      return type;
  }
};

// Memoized transaction row component
const TransactionRow = memo(function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncoming = tx.type === 'buy' || tx.type === 'transfer_in' || tx.type === 'reward' || tx.type === 'airdrop';
  const isOutgoing = tx.type === 'sell' || tx.type === 'transfer_out';

  return (
    <div
      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-surface-800/50 transition-colors items-center"
      role="row"
    >
      <div className="col-span-2 text-surface-300 text-sm">
        {tx.timestamp && format(new Date(tx.timestamp), 'MMM dd, yyyy HH:mm')}
      </div>
      <div className="col-span-1">
        <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(tx.type)}`}>
          {getTypeLabel(tx.type)}
        </span>
      </div>
      <div className="col-span-2">
        <span className="font-medium text-surface-100">{tx.asset}</span>
      </div>
      <div className="col-span-2 text-right">
        <span
          className={`font-mono ${
            isIncoming ? 'text-profit' : isOutgoing ? 'text-loss' : 'text-surface-100'
          }`}
        >
          {isIncoming ? '+' : isOutgoing ? '-' : ''}
          {tx.amount?.toLocaleString(undefined, { maximumFractionDigits: 8 })}
        </span>
      </div>
      <div className="col-span-2 text-right text-surface-300 font-mono">
        {tx.priceUsd ? `$${tx.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
      </div>
      <div className="col-span-2 text-right text-surface-100 font-mono">
        {tx.priceUsd && tx.amount
          ? `$${(tx.priceUsd * tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : '-'}
      </div>
      <div className="col-span-1 text-right text-surface-500 text-sm truncate" title={tx.exchangeId || tx.walletAddress || ''}>
        {tx.exchangeId || (tx.walletAddress ? `${tx.walletAddress.slice(0, 6)}...` : '-')}
      </div>
    </div>
  );
});

export function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    asset: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = getDb();
      const { transactions: txTable } = await import('../../database/schema');

      // Build query conditions
      const conditions = [];

      if (filters.type !== 'all') {
        conditions.push(eq(txTable.type, filters.type));
      }

      if (filters.asset) {
        conditions.push(like(txTable.asset, `%${filters.asset.toUpperCase()}%`));
      }

      if (filters.dateFrom) {
        conditions.push(gte(txTable.timestamp, new Date(filters.dateFrom)));
      }

      if (filters.dateTo) {
        conditions.push(lte(txTable.timestamp, new Date(filters.dateTo + 'T23:59:59')));
      }

      // Get total count
      const allTxs = await db
        .select()
        .from(txTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      setTotalCount(allTxs.length);

      // Get paginated data
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const txs = await db
        .select()
        .from(txTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(txTable.timestamp))
        .limit(ITEMS_PER_PAGE)
        .offset(offset);

      setTransactions(txs);
    } catch (error) {
      logger.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      type: 'all',
      asset: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
    setCurrentPage(1);
  }, []);

  const handleFirstPage = useCallback(() => setCurrentPage(1), []);
  const handlePrevPage = useCallback(() => setCurrentPage((p) => p - 1), []);
  const handleNextPage = useCallback(() => setCurrentPage((p) => p + 1), []);
  const handleLastPage = useCallback(() => setCurrentPage(totalPages), [totalPages]);

  const hasActiveFilters = filters.type !== 'all' || filters.asset || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Transaction History</h1>
          <p className="text-surface-400 mt-1">
            {totalCount.toLocaleString()} transactions found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500 rounded-full">
                {[filters.type !== 'all', filters.asset, filters.dateFrom, filters.dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={loadTransactions}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Type</label>
              <Select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'buy', label: 'Buy' },
                  { value: 'sell', label: 'Sell' },
                  { value: 'transfer_in', label: 'Deposit' },
                  { value: 'transfer_out', label: 'Withdraw' },
                  { value: 'swap', label: 'Swap' },
                  { value: 'reward', label: 'Reward' },
                  { value: 'airdrop', label: 'Airdrop' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Asset</label>
              <Input
                value={filters.asset}
                onChange={(e) => handleFilterChange('asset', e.target.value)}
                placeholder="BTC, ETH..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} fullWidth>
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon="📜"
              title="No transactions found"
              description={hasActiveFilters ? 'Try adjusting your filters' : 'Transaction history will appear here'}
            />
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-surface-800 text-sm font-medium text-surface-400">
              <div className="col-span-2">Date</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-2">Asset</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Price (USD)</div>
              <div className="col-span-2 text-right">Total (USD)</div>
              <div className="col-span-1 text-right">Source</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-surface-800" role="rowgroup">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-surface-800">
                <div className="text-sm text-surface-400">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </div>
                <nav className="flex items-center gap-2" aria-label="Pagination">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={handleFirstPage}
                    aria-label="Go to first page"
                  >
                    First
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={handlePrevPage}
                    aria-label="Go to previous page"
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm text-surface-300" aria-current="page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={handleNextPage}
                    aria-label="Go to next page"
                  >
                    Next
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={handleLastPage}
                    aria-label="Go to last page"
                  >
                    Last
                  </Button>
                </nav>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
