import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="text-4xl mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-surface-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-surface-400 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant === 'secondary' ? 'secondary' : 'primary'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size="sm"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-built empty states for common scenarios
export function NoDataEmptyState({
  onAction,
  title,
  description,
}: {
  onAction?: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon="📊"
      title={title || "No Data Yet"}
      description={description || "Start by adding your first item to see your data here."}
      action={onAction ? { label: 'Get Started', onClick: onAction } : undefined}
    />
  );
}

export function NoResultsEmptyState({
  onClear,
  searchTerm
}: {
  onClear?: () => void;
  searchTerm?: string;
}) {
  return (
    <EmptyState
      icon="🔍"
      title="No Matches Found"
      description={searchTerm
        ? `Nothing matches "${searchTerm}". Try a different search term or adjust your filters.`
        : "No items match your current filters. Try broadening your search criteria."
      }
      action={onClear ? { label: 'Clear Filters', onClick: onClear, variant: 'secondary' } : undefined}
    />
  );
}

export function NoConnectionEmptyState({
  onConnect
}: {
  onConnect: () => void
}) {
  return (
    <EmptyState
      icon="🔗"
      title="Connect Your First Wallet"
      description="Link an exchange account or add a wallet address to start tracking your crypto portfolio in one place."
      action={{ label: 'Add Wallet', onClick: onConnect }}
    />
  );
}

export function NoExchangeEmptyState({
  onConnect
}: {
  onConnect: () => void
}) {
  return (
    <EmptyState
      icon="🏦"
      title="No Exchanges Connected"
      description="Connect your exchange account with read-only API keys to automatically sync your balances and trading history."
      action={{ label: 'Connect Exchange', onClick: onConnect }}
    />
  );
}

export function NoDefiEmptyState({
  onConnect
}: {
  onConnect: () => void
}) {
  return (
    <EmptyState
      icon="🌾"
      title="No DeFi Positions Found"
      description="Your DeFi positions will appear here once you connect wallets with active positions, or you can add positions manually."
      action={{ label: 'Add Position', onClick: onConnect }}
    />
  );
}

export function NoTransactionsEmptyState({
  onSync
}: {
  onSync?: () => void
}) {
  return (
    <EmptyState
      icon="📋"
      title="No Transactions Yet"
      description="Your trading history will appear here after syncing your exchanges. Transactions are used for tax reporting and P&L tracking."
      action={onSync ? { label: 'Sync Now', onClick: onSync } : undefined}
    />
  );
}

export function NoTaxDataEmptyState({
  onSync
}: {
  onSync?: () => void
}) {
  return (
    <EmptyState
      icon="📑"
      title="No Tax Data Available"
      description="Sync your exchange transactions to calculate capital gains and generate tax reports. We support FIFO, LIFO, and HIFO methods."
      action={onSync ? { label: 'Sync Transactions', onClick: onSync } : undefined}
    />
  );
}

export function ErrorEmptyState({
  onRetry,
  message,
  title
}: {
  onRetry?: () => void;
  message?: string;
  title?: string;
}) {
  return (
    <EmptyState
      icon="⚠️"
      title={title || "Something Went Wrong"}
      description={message || "We couldn't load this data. This might be a temporary issue. Please try again."}
      action={onRetry ? { label: 'Try Again', onClick: onRetry, variant: 'secondary' } : undefined}
    />
  );
}

export function OfflineEmptyState({
  onRetry
}: {
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon="📶"
      title="You're Offline"
      description="Check your internet connection and try again. Your local data is still available."
      action={onRetry ? { label: 'Retry', onClick: onRetry, variant: 'secondary' } : undefined}
    />
  );
}

export function LoadingEmptyState({ message }: { message?: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-surface-400">{message || 'Loading...'}</p>
    </div>
  );
}
