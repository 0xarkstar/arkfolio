import { useState, useEffect } from 'react';
import { useExchangeStore } from '../../stores/exchangeStore';
import {
  AddExchangeModal,
  ExchangeList,
  BalancesTable,
  PositionsTable,
} from './components';

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
          <button
            onClick={() => syncAllExchanges()}
            disabled={connectedCount === 0}
            className="btn-secondary"
          >
            Sync All
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary">
            Add Exchange
          </button>
        </div>
      </div>

      {/* Exchange List */}
      <ExchangeList onAddExchange={() => setIsAddModalOpen(true)} />

      {/* Positions (if any) */}
      <PositionsTable />

      {/* Balances */}
      <BalancesTable />

      {/* Add Exchange Modal */}
      <AddExchangeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
