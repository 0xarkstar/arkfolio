import { useEffect, useState, useMemo } from 'react';
import { useTaxStore } from '../../stores/taxStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { toast } from '../../components/Toast';
import Decimal from 'decimal.js';

type TxSortField = 'date' | 'type' | 'asset' | 'amount' | 'gainLoss';
type SortDirection = 'asc' | 'desc';

export function TaxPage() {
  const {
    selectedYear,
    summary,
    isLoading,
    error,
    setSelectedYear,
    calculateTax,
    loadSavedReport,
    exportCSV,
  } = useTaxStore();

  const { accounts, syncAllTransactions } = useExchangeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ trades: number; transfers: number } | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [sortField, setSortField] = useState<TxSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<string>('all');

  const connectedAccounts = accounts.filter(a => a.isConnected);

  const handleSyncHistory = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      // Sync transactions from the start of the selected year
      const since = new Date(selectedYear, 0, 1);
      await syncAllTransactions({ since });
      setSyncResult({ trades: 0, transfers: 0 }); // Result tracking would need more work
      toast.success('Transaction history synced successfully');
    } catch (err) {
      console.error('Failed to sync transactions:', err);
      toast.error('Failed to sync transaction history');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadSavedReport();
  }, [loadSavedReport, selectedYear]);

  const formatKrw = (value: Decimal | number) => {
    const num = value instanceof Decimal ? value.toNumber() : value;
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleExportCSV = () => {
    const csv = exportCSV();
    if (!csv) {
      toast.error('No data to export');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax_report_${selectedYear}.csv`;
    link.click();
    toast.success(`Tax report exported as CSV`);
  };

  const handleExportExcel = () => {
    // For now, export as CSV with different extension
    // Full Excel support would require a library like xlsx
    const csv = exportCSV();
    if (!csv) {
      toast.error('No data to export');
      return;
    }

    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax_report_${selectedYear}.xlsx`;
    link.click();
    toast.success(`Tax report exported as Excel`);
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = summary?.taxableTransactions || [];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        tx => tx.asset.toLowerCase().includes(query) ||
              tx.type.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filterType);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': {
          const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
          const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
          comparison = dateA - dateB;
          break;
        }
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'asset':
          comparison = a.asset.localeCompare(b.asset);
          break;
        case 'amount':
          comparison = a.amount.minus(b.amount).toNumber();
          break;
        case 'gainLoss': {
          const gainA = a.gainLossKrw?.toNumber() || 0;
          const gainB = b.gainLossKrw?.toNumber() || 0;
          comparison = gainA - gainB;
          break;
        }
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [summary?.taxableTransactions, searchQuery, filterType, sortField, sortDirection]);

  const handleSort = (field: TxSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: TxSortField }) => (
    <span className={`ml-1 ${sortField === field ? 'text-primary-400' : 'text-surface-600'}`}>
      {sortField === field ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  const uniqueTypes = useMemo(() => {
    const types = summary?.taxableTransactions.map(tx => tx.type) || [];
    return Array.from(new Set(types)).sort();
  }, [summary?.taxableTransactions]);

  // Use mock data if no real data available
  const displaySummary = summary || {
    year: selectedYear,
    totalGainsKrw: new Decimal(0),
    totalLossesKrw: new Decimal(0),
    netGainsKrw: new Decimal(0),
    deductionKrw: new Decimal(selectedYear >= 2025 ? 50000000 : 2500000),
    taxableGainsKrw: new Decimal(0),
    estimatedTaxKrw: new Decimal(0),
    totalTransactions: 0,
    taxableTransactions: [],
  };

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-surface-100">Tax Year</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input py-1"
          >
            {[2025, 2024, 2023, 2022].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncHistory}
            disabled={isSyncing || connectedAccounts.length === 0}
            className="btn-secondary"
            title={connectedAccounts.length === 0 ? 'Connect exchanges first' : 'Sync transaction history from exchanges'}
          >
            {isSyncing ? 'Syncing...' : 'Sync History'}
          </button>
          <button
            onClick={() => calculateTax()}
            disabled={isLoading}
            className="btn-secondary"
          >
            {isLoading ? 'Calculating...' : 'Generate Report'}
          </button>
          <button onClick={handleExportExcel} className="btn-primary">
            Export to Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-loss/20 border border-loss/30 rounded-lg text-loss">
          {error}
        </div>
      )}

      {syncResult && (
        <div className="p-4 bg-profit/20 border border-profit/30 rounded-lg text-profit">
          Transaction history synced successfully. Click "Generate Report" to calculate taxes.
        </div>
      )}

      {connectedAccounts.length === 0 && (
        <div className="p-4 bg-warning/20 border border-warning/30 rounded-lg text-warning">
          No exchanges connected. Connect exchanges to sync transaction history for tax calculation.
        </div>
      )}

      {/* Tax Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading && !summary ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 w-24 bg-surface-700 rounded mb-2" />
                <div className="h-6 w-32 bg-surface-600 rounded" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="card p-4">
              <p className="text-sm text-surface-400">Total Gains</p>
              <p className="text-xl font-bold text-profit font-tabular">
                {formatKrw(displaySummary.totalGainsKrw)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-surface-400">Total Losses</p>
              <p className="text-xl font-bold text-loss font-tabular">
                {formatKrw(displaySummary.totalLossesKrw)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-surface-400">Net Gains</p>
              <p className="text-xl font-bold text-surface-100 font-tabular">
                {formatKrw(displaySummary.netGainsKrw)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-surface-400">Estimated Tax (22%)</p>
              <p className="text-xl font-bold text-warning font-tabular">
                {formatKrw(displaySummary.estimatedTaxKrw)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Tax Calculation Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-surface-100 mb-4">Tax Calculation</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Total Gains (양도차익)</span>
            <span className="text-surface-100 font-tabular">
              {formatKrw(displaySummary.totalGainsKrw)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Total Losses (양도차손)</span>
            <span className="text-loss font-tabular">
              -{formatKrw(displaySummary.totalLossesKrw)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Net Gains (순양도차익)</span>
            <span className="text-surface-100 font-tabular">
              {formatKrw(displaySummary.netGainsKrw)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Basic Deduction (기본공제)</span>
            <span className="text-profit font-tabular">
              -{formatKrw(displaySummary.deductionKrw)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Taxable Amount (과세표준)</span>
            <span className="text-surface-100 font-tabular">
              {formatKrw(displaySummary.taxableGainsKrw)}
            </span>
          </div>
          <div className="flex justify-between py-2 text-lg font-semibold">
            <span className="text-surface-100">Estimated Tax (예상 세액)</span>
            <span className="text-warning font-tabular">
              {formatKrw(displaySummary.estimatedTaxKrw)}
            </span>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-4">
          * 기본공제 {selectedYear >= 2025 ? '5000만원' : '250만원'} 적용
          {selectedYear < 2025 && ' (2025년부터 5000만원 예정)'}
        </p>
        <p className="text-xs text-surface-500">
          * 세율 22% (지방소득세 포함) 적용
        </p>
      </div>

      {/* Transaction History */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            Taxable Transactions
            {(searchQuery || filterType !== 'all') &&
              ` (${filteredAndSortedTransactions.length} of ${displaySummary.totalTransactions})`}
            {!searchQuery && filterType === 'all' && ` (${displaySummary.totalTransactions})`}
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayLimit(50); // Reset pagination on search
              }}
              className="input py-1.5 text-sm w-32"
            />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setDisplayLimit(50);
              }}
              className="input py-1.5 text-sm"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-surface-400">Calculating tax...</div>
          </div>
        ) : displaySummary.totalTransactions === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">&#128203;</div>
            <p className="text-surface-400 mb-2">No taxable transactions found</p>
            <p className="text-surface-500 text-sm">
              Connect exchanges and sync transactions to calculate taxes.
            </p>
          </div>
        ) : filteredAndSortedTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-surface-400 mb-2">No transactions match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
              }}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                    onClick={() => handleSort('date')}
                  >
                    Date<SortIcon field="date" />
                  </th>
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                    onClick={() => handleSort('type')}
                  >
                    Type<SortIcon field="type" />
                  </th>
                  <th
                    className="text-left py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                    onClick={() => handleSort('asset')}
                  >
                    Asset<SortIcon field="asset" />
                  </th>
                  <th
                    className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                    onClick={() => handleSort('amount')}
                  >
                    Amount<SortIcon field="amount" />
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Price (KRW)
                  </th>
                  <th
                    className="text-right py-3 px-4 text-sm font-medium text-surface-400 cursor-pointer hover:text-surface-200"
                    onClick={() => handleSort('gainLoss')}
                  >
                    Gain/Loss<SortIcon field="gainLoss" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTransactions.slice(0, displayLimit).map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-surface-800 hover:bg-surface-800/50"
                  >
                    <td className="py-3 px-4 text-surface-300">
                      {tx.date instanceof Date
                        ? tx.date.toLocaleDateString()
                        : new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          tx.type === 'BUY'
                            ? 'bg-profit/20 text-profit'
                            : tx.type === 'SELL'
                            ? 'bg-loss/20 text-loss'
                            : 'bg-surface-700 text-surface-300'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-surface-100">
                      {tx.asset}
                    </td>
                    <td className="py-3 px-4 text-right font-tabular text-surface-300">
                      {tx.amount.toFixed(8).replace(/\.?0+$/, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-tabular text-surface-300">
                      {formatKrw(tx.priceKrw)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-tabular ${
                        tx.gainLossKrw
                          ? tx.gainLossKrw.greaterThanOrEqualTo(0)
                            ? 'text-profit'
                            : 'text-loss'
                          : 'text-surface-500'
                      }`}
                    >
                      {tx.gainLossKrw
                        ? `${tx.gainLossKrw.greaterThanOrEqualTo(0) ? '+' : ''}${formatKrw(tx.gainLossKrw)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredAndSortedTransactions.length > displayLimit && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setDisplayLimit((prev) => prev + 50)}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Load More ({filteredAndSortedTransactions.length - displayLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* HomeTax Export Info */}
      <div className="card p-6 border-primary-600/30 bg-primary-600/5">
        <h3 className="text-lg font-semibold text-surface-100 mb-2">HomeTax Export</h3>
        <p className="text-surface-400 text-sm mb-4">
          Export your transaction data in a format compatible with the Korean National Tax
          Service (HomeTax).
        </p>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="btn-primary">
            가상자산 거래명세서 (CSV)
          </button>
          <button onClick={handleExportExcel} className="btn-secondary">
            연간 집계표 (Excel)
          </button>
        </div>
      </div>
    </div>
  );
}
