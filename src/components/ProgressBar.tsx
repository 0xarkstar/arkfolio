interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return 'bg-profit';
      case 'warning':
        return 'bg-warning';
      case 'danger':
        return 'bg-loss';
      case 'primary':
      default:
        return 'bg-primary-500';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-4';
      case 'md':
      default:
        return 'h-2';
    }
  };

  return (
    <div className={className}>
      <div
        className={`w-full bg-surface-800 rounded-full overflow-hidden ${getSizeClass()}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`${getSizeClass()} ${getVariantColor()} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-surface-400 mt-1 text-right">
          {percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
}

// Indeterminate loading bar
interface IndeterminateProgressProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function IndeterminateProgress({
  variant = 'primary',
  size = 'md',
}: IndeterminateProgressProps) {
  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return 'bg-profit';
      case 'warning':
        return 'bg-warning';
      case 'danger':
        return 'bg-loss';
      case 'primary':
      default:
        return 'bg-primary-500';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-4';
      case 'md':
      default:
        return 'h-2';
    }
  };

  return (
    <div
      className={`w-full bg-surface-800 rounded-full overflow-hidden ${getSizeClass()}`}
      role="progressbar"
      aria-busy="true"
    >
      <div
        className={`${getSizeClass()} ${getVariantColor()} rounded-full animate-indeterminate`}
        style={{ width: '30%' }}
      />
    </div>
  );
}
