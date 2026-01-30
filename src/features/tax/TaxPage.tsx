import { useEffect, useState } from 'react';
import { useTaxStore } from '../../stores/taxStore';
import Decimal from 'decimal.js';

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

  const [searchQuery, setSearchQuery] = useState('');

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
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax_report_${selectedYear}.csv`;
    link.click();
  };

  const handleExportExcel = () => {
    // For now, export as CSV with different extension
    // Full Excel support would require a library like xlsx
    const csv = exportCSV();
    if (!csv) return;

    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax_report_${selectedYear}.xlsx`;
    link.click();
  };

  const filteredTransactions = summary?.taxableTransactions.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.asset.toLowerCase().includes(query) ||
      tx.type.toLowerCase().includes(query)
    );
  }) || [];

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

      {/* Tax Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            Taxable Transactions ({displaySummary.totalTransactions})
          </h3>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input py-1 w-64"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-surface-400">Calculating tax...</div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">&#128203;</div>
            <p className="text-surface-400 mb-2">No taxable transactions found</p>
            <p className="text-surface-500 text-sm">
              Connect exchanges and sync transactions to calculate taxes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">
                    Asset
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Price (KRW)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">
                    Gain/Loss
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.slice(0, 50).map((tx) => (
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

        {filteredTransactions.length > 50 && (
          <div className="flex justify-center mt-4">
            <button className="text-sm text-primary-400 hover:text-primary-300">
              Load More ({filteredTransactions.length - 50} remaining)
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
