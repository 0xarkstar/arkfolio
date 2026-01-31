import { useEffect, useState, useMemo } from 'react';
import { useTaxStore } from '../../stores/taxStore';
import { useExchangeStore } from '../../stores/exchangeStore';
import { excelExportService } from '../../services/export';
import { toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Select } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { SkeletonCard, SectionLoading } from '../../components/Skeleton';
import { NoDataEmptyState, NoResultsEmptyState } from '../../components/EmptyState';
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
    if (!summary || summary.taxableTransactions.length === 0) {
      toast.error('No data to export');
      return;
    }

    excelExportService.exportTaxReport({
      year: selectedYear,
      summary: {
        totalGainsKrw: summary.totalGainsKrw,
        totalLossesKrw: summary.totalLossesKrw,
        netGainsKrw: summary.netGainsKrw,
        taxableGainsKrw: summary.taxableGainsKrw,
        estimatedTaxKrw: summary.estimatedTaxKrw,
      },
      transactions: summary.taxableTransactions.map((tx) => ({
        date: tx.date,
        type: tx.type,
        asset: tx.asset,
        amount: tx.amount,
        priceKrw: tx.priceKrw,
        gainLossKrw: tx.gainLossKrw ?? undefined,
      })),
    });

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

  const getTypeVariant = (type: string): 'success' | 'danger' | 'default' => {
    if (type === 'BUY') return 'success';
    if (type === 'SELL') return 'danger';
    return 'default';
  };

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-surface-100">Tax Year</h2>
          <Select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            size="sm"
            className="w-24"
            options={[2025, 2024, 2023, 2022].map(year => ({
              value: year.toString(),
              label: year.toString()
            }))}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncHistory}
            disabled={isSyncing || connectedAccounts.length === 0}
            variant="secondary"
            loading={isSyncing}
            title={connectedAccounts.length === 0 ? 'Connect exchanges first' : 'Sync transaction history from exchanges'}
          >
            Sync History
          </Button>
          <Button
            onClick={() => calculateTax()}
            disabled={isLoading}
            variant="secondary"
            loading={isLoading}
          >
            Generate Report
          </Button>
          <Button onClick={handleExportExcel} variant="primary">
            Export to Excel
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => {}}>
          {error}
        </Alert>
      )}

      {syncResult && (
        <Alert variant="success">
          Transaction history synced successfully. Click "Generate Report" to calculate taxes.
        </Alert>
      )}

      {connectedAccounts.length === 0 && (
        <Alert variant="warning">
          No exchanges connected. Connect exchanges to sync transaction history for tax calculation.
        </Alert>
      )}

      {/* Tax Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading && !summary ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total Gains</p>
              <p className="text-xl font-bold text-profit font-tabular">
                {formatKrw(displaySummary.totalGainsKrw)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Total Losses</p>
              <p className="text-xl font-bold text-loss font-tabular">
                {formatKrw(displaySummary.totalLossesKrw)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Net Gains</p>
              <p className="text-xl font-bold text-surface-100 font-tabular">
                {formatKrw(displaySummary.netGainsKrw)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-surface-400">Estimated Tax (22%)</p>
              <p className="text-xl font-bold text-warning font-tabular">
                {formatKrw(displaySummary.estimatedTaxKrw)}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Tax Calculation Breakdown */}
      <Card className="p-6">
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
      </Card>

      {/* Transaction History */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            Taxable Transactions
            {(searchQuery || filterType !== 'all') &&
              ` (${filteredAndSortedTransactions.length} of ${displaySummary.totalTransactions})`}
            {!searchQuery && filterType === 'all' && ` (${displaySummary.totalTransactions})`}
          </h3>
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search..."
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setDisplayLimit(50);
              }}
              size="sm"
              className="w-32"
            />
            <Select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setDisplayLimit(50);
              }}
              size="sm"
              options={[
                { value: 'all', label: 'All Types' },
                ...uniqueTypes.map(type => ({ value: type, label: type }))
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <SectionLoading message="Calculating tax..." />
        ) : displaySummary.totalTransactions === 0 ? (
          <NoDataEmptyState
            onAction={() => {}}
          />
        ) : filteredAndSortedTransactions.length === 0 ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setFilterType('all');
            }}
          />
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
                      <Badge variant={getTypeVariant(tx.type)} size="sm">
                        {tx.type}
                      </Badge>
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
            <Button
              onClick={() => setDisplayLimit((prev) => prev + 50)}
              variant="ghost"
              size="sm"
            >
              Load More ({filteredAndSortedTransactions.length - displayLimit} remaining)
            </Button>
          </div>
        )}
      </Card>

      {/* HomeTax Export Info */}
      <Card className="p-6 border-primary-600/30 bg-primary-600/5">
        <h3 className="text-lg font-semibold text-surface-100 mb-2">HomeTax Export</h3>
        <p className="text-surface-400 text-sm mb-4">
          Export your transaction data in a format compatible with the Korean National Tax
          Service (HomeTax).
        </p>
        <div className="flex gap-3">
          <Button onClick={handleExportCSV} variant="primary">
            가상자산 거래명세서 (CSV)
          </Button>
          <Button onClick={handleExportExcel} variant="secondary">
            연간 집계표 (Excel)
          </Button>
        </div>
      </Card>
    </div>
  );
}
