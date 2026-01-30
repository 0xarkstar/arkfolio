import { useEffect, useState } from 'react';
import { useExchangeStore, ExchangeAccount } from '../../../stores/exchangeStore';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '../../../components/Toast';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button, IconButton } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { Alert } from '../../../components/Alert';
import { SkeletonCard } from '../../../components/Skeleton';
import { Badge } from '../../../components/Badge';
import { NoConnectionEmptyState } from '../../../components/EmptyState';

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

  const [confirmRemove, setConfirmRemove] = useState<ExchangeAccount | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  if (isLoading && accounts.length === 0) {
    return <SkeletonCard />;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-surface-100">Connected Exchanges</h2>
        <Button onClick={onAddExchange} size="sm">
          Add Exchange
        </Button>
      </div>

      {accounts.length === 0 ? (
        <NoConnectionEmptyState onConnect={onAddExchange} />
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <ExchangeCard
              key={account.id}
              account={account}
              onSync={async () => {
                try {
                  await syncExchange(account.id);
                  toast.success(`Synced ${account.name}`);
                } catch {
                  toast.error(`Failed to sync ${account.name}`);
                }
              }}
              onRemove={() => setConfirmRemove(account)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmRemove}
        title="Remove Exchange"
        message={`Are you sure you want to remove ${confirmRemove?.name}? This will delete all synced data for this exchange.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (confirmRemove) {
            await removeExchange(confirmRemove.id);
            toast.info(`Removed ${confirmRemove.name}`);
          }
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </Card>
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
          <Avatar name={account.name} size="md" />
          <div>
            <h3 className="font-medium text-surface-100">{account.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                variant={account.isConnected ? 'success' : 'default'}
                size="sm"
              >
                {account.isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {account.lastSync && (
                <span className="text-surface-500">
                  Synced {formatDistanceToNow(account.lastSync, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={onSync}
            disabled={!account.isConnected}
            aria-label="Sync exchange"
            size="sm"
          >
            <SyncIcon />
          </IconButton>
          <IconButton
            onClick={onRemove}
            variant="danger"
            aria-label="Remove exchange"
            size="sm"
          >
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      {account.error && (
        <Alert variant="error" className="mt-3">
          {account.error}
        </Alert>
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
