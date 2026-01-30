import { useEffect } from 'react';
import { useExchangeStore, ExchangeAccount } from '../../../stores/exchangeStore';
import { formatDistanceToNow } from 'date-fns';

interface ExchangeListProps {
  onAddExchange: () => void;
}

export function ExchangeList({ onAddExchange }: ExchangeListProps) {
  const {
    accounts,
    isLoading,
    loadAccounts,
    syncExchange,
    removeExchange,
  } = useExchangeStore();

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  if (isLoading && accounts.length === 0) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-surface-700 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-16 bg-surface-800 rounded" />
            <div className="h-16 bg-surface-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-surface-100">Connected Exchanges</h2>
        <button onClick={onAddExchange} className="btn-primary text-sm">
          Add Exchange
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-surface-400 mb-4">No exchanges connected yet</p>
          <button onClick={onAddExchange} className="btn-secondary">
            Connect Your First Exchange
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <ExchangeCard
              key={account.id}
              account={account}
              onSync={() => syncExchange(account.id)}
              onRemove={() => removeExchange(account.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ExchangeCardProps {
  account: ExchangeAccount;
  onSync: () => void;
  onRemove: () => void;
}

function ExchangeCard({ account, onSync, onRemove }: ExchangeCardProps) {
  const { allBalances, allPositions } = useExchangeStore();
  const balances = allBalances.get(account.id) || [];
  const positions = allPositions.get(account.id) || [];

  const balanceCount = balances.length;
  const positionCount = positions.length;

  return (
    <div className="bg-surface-800 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-lg font-medium text-primary-400">
            {account.name[0]}
          </div>
          <div>
            <h3 className="font-medium text-surface-100">{account.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  account.isConnected ? 'bg-profit' : 'bg-surface-500'
                }`}
              />
              <span className="text-surface-400">
                {account.isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {account.lastSync && (
                <span className="text-surface-500">
                  &middot; Synced {formatDistanceToNow(account.lastSync, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSync}
            disabled={!account.isConnected}
            className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded transition-colors disabled:opacity-50"
            title="Sync"
          >
            <SyncIcon />
          </button>
          <button
            onClick={onRemove}
            className="p-2 text-surface-400 hover:text-loss hover:bg-surface-700 rounded transition-colors"
            title="Remove"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {account.error && (
        <div className="mt-3 p-2 bg-loss/10 border border-loss/20 rounded text-loss text-sm">
          {account.error}
        </div>
      )}

      {(balanceCount > 0 || positionCount > 0) && (
        <div className="mt-3 pt-3 border-t border-surface-700 flex gap-4 text-sm">
          <div>
            <span className="text-surface-400">Assets: </span>
            <span className="text-surface-200 font-medium">{balanceCount}</span>
          </div>
          {positionCount > 0 && (
            <div>
              <span className="text-surface-400">Positions: </span>
              <span className="text-surface-200 font-medium">{positionCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SyncIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
