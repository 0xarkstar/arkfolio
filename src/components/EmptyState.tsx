import { ReactNode } from 'react';

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
            <button
              onClick={action.onClick}
              className={action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-built empty states for common scenarios
export function NoDataEmptyState({
  onAction
}: {
  onAction?: () => void
}) {
  return (
    <EmptyState
      icon="📊"
      title="No Data Available"
      description="There's nothing to display yet. Add some data to get started."
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
      title="No Results Found"
      description={searchTerm
        ? `No items match "${searchTerm}". Try adjusting your search or filters.`
        : "No items match your current filters."
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
      title="No Connections"
      description="Connect an exchange or add a wallet to start tracking your portfolio."
      action={{ label: 'Connect Now', onClick: onConnect }}
    />
  );
}

export function ErrorEmptyState({
  onRetry,
  message
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <EmptyState
      icon="⚠️"
      title="Something Went Wrong"
      description={message || "We couldn't load this data. Please try again."}
      action={onRetry ? { label: 'Try Again', onClick: onRetry, variant: 'secondary' } : undefined}
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
