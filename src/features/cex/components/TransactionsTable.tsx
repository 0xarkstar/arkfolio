import { useEffect, useState, useMemo } from 'react';
import { getDb } from '../../../database/init';
import { transactions } from '../../../database/schema';
import { desc } from 'drizzle-orm';
import { useExchangeStore } from '../../../stores/exchangeStore';
import { toast } from '../../../components/Toast';
import { Card } from '../../../components/Card';
import { SearchInput } from '../../../components/SearchInput';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { AssetAvatar } from '../../../components/Avatar';
import { NoDataEmptyState, NoResultsEmptyState } from '../../../components/EmptyState';
import { SkeletonTableRow } from '../../../components/Skeleton';

interface Transaction {
  id: string;
  exchangeId: string | null;
  type: string;
  asset: string;
  amount: number;
  priceUsd: number | null;
  priceKrw: number | null;
  fee: number | null;
  feeAsset: string | null;
  timestamp: Date;
}

export function TransactionsTable() {
  const { accounts } = useExchangeStore();
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadTransactions() {
      setIsLoading(true);
      try {
        const db = getDb();
        const rows = await db
          .select()
          .from(transactions)
          .orderBy(desc(transactions.timestamp))
          .limit(100);

        setTxList(rows.map(row => ({
          id: row.id,
          exchangeId: row.exchangeId,
          type: row.type,
          asset: row.asset,
          amount: row.amount,
          priceUsd: row.priceUsd,
          priceKrw: row.priceKrw,
          fee: row.fee,
          feeAsset: row.feeAsset,
          timestamp: row.timestamp as Date,
        })));
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadTransactions();
  }, []);

  const getExchangeName = (exchangeId: string | null) => {
    if (!exchangeId) return 'Unknown';
    const account = accounts.find(a => a.id === exchangeId);
    return account?.name || exchangeId;
  };

  const getTypeVariant = (type: string): 'success' | 'danger' | 'info' | 'warning' | 'default' => {
    switch (type.toLowerCase()) {
      case 'buy':
        return 'success';
      case 'sell':
        return 'danger';
      case 'transfer_in':
        return 'info';
      case 'transfer_out':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatType = (type: string) => {
    return type.replace('_', ' ').toUpperCase();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatAmount = (value: number) => {
    if (value >= 1000) return value.toFixed(2);
    if (value >= 1) return value.toFixed(4);
    if (value >= 0.0001) return value.toFixed(6);
    return value.toFixed(8);
  };

  const filteredTx = useMemo(() => {
    const getExchangeNameLocal = (exchangeId: string | null) => {
      if (!exchangeId) return 'Unknown';
      const account = accounts.find(a => a.id === exchangeId);
      return account?.name || exchangeId;
    };

    let filtered = txList;

    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'buy') filtered = filtered.filter(tx => tx.type.toLowerCase() === 'buy');
      else if (filter === 'sell') filtered = filtered.filter(tx => tx.type.toLowerCase() === 'sell');
      else if (filter === 'transfer') filtered = filtered.filter(tx => tx.type.toLowerCase().includes('transfer'));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.asset.toLowerCase().includes(query) ||
        getExchangeNameLocal(tx.exchangeId).toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [txList, filter, searchQuery, accounts]);

  const handleExportCSV = () => {
    if (txList.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Asset', 'Amount', 'Price (USD)', 'Value (USD)', 'Fee', 'Fee Asset', 'Exchange'];
    const rows = filteredTx.map(tx => [
      tx.timestamp instanceof Date ? tx.timestamp.toISOString() : new Date(tx.timestamp).toISOString(),
      tx.type,
      tx.asset,
      tx.amount.toString(),
      tx.priceUsd?.toString() || '',
      tx.priceUsd ? (tx.amount * tx.priceUsd).toFixed(2) : '',
      tx.fee?.toString() || '',
      tx.feeAsset || '',
      getExchangeName(tx.exchangeId),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Transactions exported to CSV');
  };

  if (txList.length === 0 && !isLoading) {
    return null; // Don't show section if no transactions
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-surface-100">
          Transaction History
          {(searchQuery || filter !== 'all') && (
            <span className="text-surface-400 font-normal text-sm ml-2">
              ({filteredTx.length} of {txList.length})
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search..."
            size="sm"
            className="w-32"
          />
          <div className="flex gap-1">
            {(['all', 'buy', 'sell', 'transfer'] as const).map(f => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                variant={filter === f ? 'primary' : 'secondary'}
                size="xs"
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          {txList.length > 0 && (
            <Button
              onClick={handleExportCSV}
              variant="ghost"
              size="xs"
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Asset</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Amount</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Value</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={7} />
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredTx.length === 0 ? (
        searchQuery || filter !== 'all' ? (
          <NoResultsEmptyState
            searchTerm={searchQuery}
            onClear={() => {
              setSearchQuery('');
              setFilter('all');
            }}
          />
        ) : (
          <NoDataEmptyState />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Asset</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Amount</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-surface-400">Value</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-surface-400">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.map(tx => (
                <tr
                  key={tx.id}
                  className="border-b border-surface-800 hover:bg-surface-800/50"
                >
                  <td className="py-3 px-4 text-surface-300 text-sm">
                    {tx.timestamp instanceof Date
                      ? tx.timestamp.toLocaleDateString()
                      : new Date(tx.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={getTypeVariant(tx.type)} size="sm">
                      {formatType(tx.type)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <AssetAvatar symbol={tx.asset} size="xs" />
                      <span className="font-medium text-surface-100">{tx.asset}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-300">
                    {formatAmount(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-300">
                    {formatCurrency(tx.priceUsd)}
                  </td>
                  <td className="py-3 px-4 text-right font-tabular text-surface-100">
                    {tx.priceUsd ? formatCurrency(tx.amount * tx.priceUsd) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <Badge size="sm">{getExchangeName(tx.exchangeId)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredTx.length >= 100 && (
        <div className="text-center mt-4">
          <p className="text-surface-500 text-sm">
            Showing latest 100 transactions. View all in Tax Report.
          </p>
        </div>
      )}
    </Card>
  );
}
