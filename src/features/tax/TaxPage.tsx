import { useState } from 'react';

const mockTaxSummary = {
  year: 2024,
  totalGains: 15234000, // KRW
  totalLosses: 3456000,
  netGains: 11778000,
  deduction: 2500000, // 250만원
  taxableGains: 9278000,
  estimatedTax: 2041160, // 22%
  transactions: 234,
};

const mockTransactions = [
  { date: '2024-03-15', type: 'SELL', asset: 'BTC', amount: 0.5, priceKrw: 35000000, gainLoss: 5200000 },
  { date: '2024-03-10', type: 'SELL', asset: 'ETH', amount: 5, priceKrw: 20000000, gainLoss: 2100000 },
  { date: '2024-02-28', type: 'SELL', asset: 'SOL', amount: 100, priceKrw: 15000000, gainLoss: -800000 },
  { date: '2024-02-15', type: 'SELL', asset: 'BTC', amount: 0.3, priceKrw: 21000000, gainLoss: 3500000 },
  { date: '2024-01-20', type: 'SELL', asset: 'ETH', amount: 3, priceKrw: 12000000, gainLoss: 1200000 },
];

export function TaxPage() {
  const [selectedYear, setSelectedYear] = useState(2024);

  const formatKrw = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(value);
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
            <option value={2024}>2024</option>
            <option value={2023}>2023</option>
            <option value={2022}>2022</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">
            Generate Report
          </button>
          <button className="btn-primary">
            Export to Excel
          </button>
        </div>
      </div>

      {/* Tax Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total Gains</p>
          <p className="text-xl font-bold text-profit font-tabular">
            {formatKrw(mockTaxSummary.totalGains)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Total Losses</p>
          <p className="text-xl font-bold text-loss font-tabular">
            {formatKrw(mockTaxSummary.totalLosses)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Net Gains</p>
          <p className="text-xl font-bold text-surface-100 font-tabular">
            {formatKrw(mockTaxSummary.netGains)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-400">Estimated Tax (22%)</p>
          <p className="text-xl font-bold text-warning font-tabular">
            {formatKrw(mockTaxSummary.estimatedTax)}
          </p>
        </div>
      </div>

      {/* Tax Calculation Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-surface-100 mb-4">Tax Calculation</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Total Gains (양도차익)</span>
            <span className="text-surface-100 font-tabular">{formatKrw(mockTaxSummary.totalGains)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Total Losses (양도차손)</span>
            <span className="text-loss font-tabular">-{formatKrw(mockTaxSummary.totalLosses)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Net Gains (순양도차익)</span>
            <span className="text-surface-100 font-tabular">{formatKrw(mockTaxSummary.netGains)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Basic Deduction (기본공제)</span>
            <span className="text-profit font-tabular">-{formatKrw(mockTaxSummary.deduction)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-surface-800">
            <span className="text-surface-400">Taxable Amount (과세표준)</span>
            <span className="text-surface-100 font-tabular">{formatKrw(mockTaxSummary.taxableGains)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg font-semibold">
            <span className="text-surface-100">Estimated Tax (예상 세액)</span>
            <span className="text-warning font-tabular">{formatKrw(mockTaxSummary.estimatedTax)}</span>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-4">
          * 기본공제 250만원 적용 (2025년부터 5000만원 예정)
        </p>
        <p className="text-xs text-surface-500">
          * 세율 22% (지방소득세 포함) 적용
        </p>
      </div>

      {/* Transaction History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            Taxable Transactions ({mockTaxSummary.transactions})
          </h3>
          <input
            type="text"
            placeholder="Search transactions..."
            className="input py-1 w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Asset</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Amount</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Price (KRW)</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {mockTransactions.map((tx, index) => (
                <tr key={index} className="border-b border-surface-800 hover:bg-surface-800/50">
                  <td className="py-3 px-4 text-surface-300">{tx.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      tx.type === 'BUY' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-surface-100">{tx.asset}</td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-300">
                    {tx.amount}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-300">
                    {formatKrw(tx.priceKrw)}
                  </td>
                  <td className={`py-3 px-4 text-right font-tabular ${
                    tx.gainLoss >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {tx.gainLoss >= 0 ? '+' : ''}{formatKrw(tx.gainLoss)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4">
          <button className="text-sm text-primary-400 hover:text-primary-300">
            Load More Transactions
          </button>
        </div>
      </div>

      {/* HomeTax Export Info */}
      <div className="card p-6 border-primary-600/30 bg-primary-600/5">
        <h3 className="text-lg font-semibold text-surface-100 mb-2">HomeTax Export</h3>
        <p className="text-surface-400 text-sm mb-4">
          Export your transaction data in a format compatible with the Korean National Tax Service (HomeTax).
        </p>
        <div className="flex gap-3">
          <button className="btn-primary">
            가상자산 거래명세서 (CSV)
          </button>
          <button className="btn-secondary">
            연간 집계표 (Excel)
          </button>
        </div>
      </div>
    </div>
  );
}
