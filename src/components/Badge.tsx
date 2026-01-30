import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary-600/20 text-primary-400';
      case 'success':
        return 'bg-profit/20 text-profit';
      case 'warning':
        return 'bg-warning/20 text-warning';
      case 'danger':
        return 'bg-loss/20 text-loss';
      case 'info':
        return 'bg-blue-500/20 text-blue-400';
      case 'default':
      default:
        return 'bg-surface-700 text-surface-300';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-1.5 py-0.5 text-[10px]';
      case 'lg':
        return 'px-3 py-1 text-sm';
      case 'md':
      default:
        return 'px-2 py-0.5 text-xs';
    }
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded ${getVariantStyles()} ${getSizeStyles()} ${className}`}
    >
      {children}
    </span>
  );
}

// Status badge with dot indicator
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'syncing' | 'error' | 'warning';
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'online':
        return { dot: 'bg-profit', text: 'text-profit', label: label || 'Online' };
      case 'offline':
        return { dot: 'bg-surface-500', text: 'text-surface-400', label: label || 'Offline' };
      case 'syncing':
        return { dot: 'bg-primary-400 animate-pulse', text: 'text-primary-400', label: label || 'Syncing' };
      case 'error':
        return { dot: 'bg-loss', text: 'text-loss', label: label || 'Error' };
      case 'warning':
        return { dot: 'bg-warning', text: 'text-warning', label: label || 'Warning' };
    }
  };

  const styles = getStatusStyles();
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 ${styles.text} ${textSize}`}>
      <span className={`${dotSize} rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  );
}

// Count badge (for notifications, etc.)
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'primary' | 'danger';
}

export function CountBadge({ count, max = 99, variant = 'primary' }: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();
  const bgColor = variant === 'danger' ? 'bg-loss' : 'bg-primary-600';

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium text-white rounded-full ${bgColor}`}
    >
      {displayCount}
    </span>
  );
}
