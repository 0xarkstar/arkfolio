import { ReactNode, useState } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  action,
  icon,
  className = '',
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          container: 'bg-gain/10 border-gain/30',
          icon: 'text-gain',
          title: 'text-gain',
        };
      case 'warning':
        return {
          container: 'bg-yellow-500/10 border-yellow-500/30',
          icon: 'text-yellow-500',
          title: 'text-yellow-400',
        };
      case 'error':
        return {
          container: 'bg-loss/10 border-loss/30',
          icon: 'text-loss',
          title: 'text-loss',
        };
      case 'info':
      default:
        return {
          container: 'bg-primary-500/10 border-primary-500/30',
          icon: 'text-primary-400',
          title: 'text-primary-400',
        };
    }
  };

  const getDefaultIcon = () => {
    switch (variant) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const styles = getVariantStyles();

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 ${styles.container} ${className}`}
    >
      <div className="flex gap-3">
        <div className={`shrink-0 ${styles.icon}`}>
          {icon || getDefaultIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-sm font-medium mb-1 ${styles.title}`}>
              {title}
            </h4>
          )}
          <div className="text-sm text-surface-300">{children}</div>
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-medium hover:underline ${styles.title}`}
            >
              {action.label}
            </button>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="shrink-0 text-surface-500 hover:text-surface-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Banner (full-width, typically at top of page)
interface BannerProps {
  variant?: AlertVariant;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function Banner({
  variant = 'info',
  children,
  dismissible = false,
  onDismiss,
  action,
  className = '',
}: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-gain/20 text-gain';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'error':
        return 'bg-loss/20 text-loss';
      case 'info':
      default:
        return 'bg-primary-500/20 text-primary-300';
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={`px-4 py-2 text-sm ${getVariantStyles()} ${className}`}
    >
      <div className="flex items-center justify-center gap-4">
        <span>{children}</span>
        {action && (
          <button
            onClick={action.onClick}
            className="font-medium underline hover:no-underline"
          >
            {action.label}
          </button>
        )}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute right-4 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Inline alert (compact, for forms)
interface InlineAlertProps {
  variant?: 'error' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}

export function InlineAlert({ variant = 'error', children, className = '' }: InlineAlertProps) {
  const getStyles = () => {
    switch (variant) {
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-primary-400';
      case 'error':
      default:
        return 'text-loss';
    }
  };

  return (
    <p className={`text-xs flex items-center gap-1 ${getStyles()} ${className}`}>
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
      </svg>
      {children}
    </p>
  );
}
