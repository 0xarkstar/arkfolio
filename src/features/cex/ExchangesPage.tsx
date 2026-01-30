import { useState, useEffect } from 'react';
import { useExchangeStore } from '../../stores/exchangeStore';
import {
  AddExchangeModal,
  ExchangeList,
  BalancesTable,
  PositionsTable,
  TransactionsTable,
} from './components';
import { Button } from '../../components/Button';

export function ExchangesPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { accounts, loadAccounts, syncAllExchanges } = useExchangeStore();

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const connectedCount = accounts.filter(a => a.isConnected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Exchanges</h1>
          <p className="text-surface-400 mt-1">
            Manage your CEX connections and view balances
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => syncAllExchanges()}
            disabled={connectedCount === 0}
            variant="secondary"
          >
            Sync All
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} variant="primary">
            Add Exchange
          </Button>
        </div>
      </div>

      {/* Exchange List */}
      <ExchangeList onAddExchange={() => setIsAddModalOpen(true)} />

      {/* Positions (if any) */}
      <PositionsTable />

      {/* Balances */}
      <BalancesTable />

      {/* Transaction History */}
      <TransactionsTable />

      {/* Add Exchange Modal */}
      <AddExchangeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
