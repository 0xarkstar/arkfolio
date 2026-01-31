import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'secondary':
          return 'bg-surface-700 hover:bg-surface-600 text-surface-100 border border-surface-600';
        case 'ghost':
          return 'bg-transparent hover:bg-surface-800 text-surface-300 hover:text-surface-100';
        case 'danger':
          return 'bg-loss hover:bg-loss/90 text-white';
        case 'success':
          return 'bg-gain hover:bg-gain/90 text-white';
        case 'primary':
        default:
          return 'bg-primary-500 hover:bg-primary-600 text-white';
      }
    };

    const getSizeStyles = () => {
      switch (size) {
        case 'xs':
          return 'px-2 py-1 text-xs gap-1';
        case 'sm':
          return 'px-3 py-1.5 text-sm gap-1.5';
        case 'lg':
          return 'px-6 py-3 text-base gap-2';
        case 'md':
        default:
          return 'px-4 py-2 text-sm gap-2';
      }
    };

    const getIconSize = () => {
      switch (size) {
        case 'xs':
          return 'w-3 h-3';
        case 'sm':
          return 'w-3.5 h-3.5';
        case 'lg':
          return 'w-5 h-5';
        case 'md':
        default:
          return 'w-4 h-4';
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        className={`
          inline-flex items-center justify-center font-medium rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-surface-900
          disabled:opacity-50 disabled:cursor-not-allowed
          ${getVariantStyles()}
          ${getSizeStyles()}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <svg
            className={`animate-spin ${getIconSize()}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className={getIconSize()} aria-hidden="true">{leftIcon}</span>
        )}
        {children}
        {rightIcon && !loading && <span className={getIconSize()} aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button (square, icon only)
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { variant = 'ghost', size = 'md', loading = false, disabled, children, className = '', ...props },
    ref
  ) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return 'bg-primary-500 hover:bg-primary-600 text-white';
        case 'secondary':
          return 'bg-surface-700 hover:bg-surface-600 text-surface-100 border border-surface-600';
        case 'danger':
          return 'bg-transparent hover:bg-loss/10 text-loss';
        case 'ghost':
        default:
          return 'bg-transparent hover:bg-surface-800 text-surface-400 hover:text-surface-100';
      }
    };

    const getSizeStyles = () => {
      switch (size) {
        case 'xs':
          return 'w-6 h-6 text-xs';
        case 'sm':
          return 'w-8 h-8 text-sm';
        case 'lg':
          return 'w-12 h-12 text-lg';
        case 'md':
        default:
          return 'w-10 h-10 text-base';
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          ${getVariantStyles()}
          ${getSizeStyles()}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          children
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Button Group
interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function ButtonGroup({ children, className = '', 'aria-label': ariaLabel }: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex rounded-lg overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
