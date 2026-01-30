import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'bordered' | 'elevated';
}

export function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
  variant = 'default',
}: CardProps) {
  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return '';
      case 'sm':
        return 'p-3';
      case 'lg':
        return 'p-8';
      case 'md':
      default:
        return 'p-6';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'bordered':
        return 'bg-surface-900 border border-surface-700';
      case 'elevated':
        return 'bg-surface-900 shadow-lg shadow-black/20';
      case 'default':
      default:
        return 'bg-surface-900';
    }
  };

  const interactiveStyles = onClick || hover
    ? 'cursor-pointer hover:bg-surface-800/50 transition-colors'
    : '';

  return (
    <div
      className={`rounded-xl ${getVariantStyles()} ${getPaddingStyles()} ${interactiveStyles} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// Card header component
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-surface-100">{title}</h3>
        {subtitle && (
          <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Card footer component
interface CardFooterProps {
  children: ReactNode;
  className?: string;
  border?: boolean;
}

export function CardFooter({ children, className = '', border = true }: CardFooterProps) {
  return (
    <div
      className={`mt-4 pt-4 ${border ? 'border-t border-surface-800' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// Stats card component
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string | number;
    positive?: boolean;
  };
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  onClick,
  className = '',
}: StatsCardProps) {
  return (
    <Card
      padding="md"
      onClick={onClick}
      hover={!!onClick}
      className={className}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-400 mb-1">{title}</p>
          <p className="text-2xl font-semibold font-tabular text-surface-100">{value}</p>
          {change && (
            <p
              className={`text-sm mt-1 font-tabular ${
                change.positive === undefined
                  ? 'text-surface-400'
                  : change.positive
                  ? 'text-profit'
                  : 'text-loss'
              }`}
            >
              {change.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-2xl text-surface-600">{icon}</div>
        )}
      </div>
    </Card>
  );
}
