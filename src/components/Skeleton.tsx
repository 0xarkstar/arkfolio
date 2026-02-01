interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return 'rounded';
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
      default:
        return 'rounded-lg';
    }
  };

  const getAnimationStyles = () => {
    switch (animation) {
      case 'wave':
        return 'animate-shimmer bg-gradient-to-r from-surface-700 via-surface-600 to-surface-700 bg-[length:200%_100%]';
      case 'none':
        return 'bg-surface-700';
      case 'pulse':
      default:
        return 'animate-pulse bg-surface-700';
    }
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${getVariantStyles()} ${getAnimationStyles()} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton patterns
export function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse" role="status" aria-label="Loading content">
      <div className="h-4 w-28 bg-surface-700 rounded mb-2" />
      <div className="h-8 w-32 bg-surface-600 rounded" />
    </div>
  );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-surface-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 bg-surface-700 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonList({ count = 3, height = 16 }: { count?: number; height?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-700 rounded"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
    />
  );
}

// Asset row skeleton (common pattern in the app)
export function SkeletonAssetRow() {
  return (
    <div className="flex items-center justify-between py-2 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-surface-700 rounded-full" />
        <div>
          <div className="h-4 w-12 bg-surface-700 rounded" />
          <div className="h-3 w-16 bg-surface-800 rounded mt-1" />
        </div>
      </div>
      <div className="text-right">
        <div className="h-4 w-20 bg-surface-700 rounded" />
        <div className="h-3 w-10 bg-surface-800 rounded mt-1" />
      </div>
    </div>
  );
}

// Loading spinner with optional message
export function LoadingSpinner({
  size = 'md',
  message,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}) {
  const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeStyles[size]} border-surface-600 border-t-primary-500 rounded-full animate-spin`}
      />
      {message && <p className="text-sm text-surface-400">{message}</p>}
    </div>
  );
}

// Full-page loading state
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px] py-12" role="status" aria-label={message}>
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

// Inline loading state for sections
export function SectionLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-label={message}>
      <LoadingSpinner size="md" message={message} />
    </div>
  );
}

// Skeleton grid for dashboard cards
export function SkeletonDashboardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
