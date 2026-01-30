import { ReactNode } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: ReactNode;
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  className = '',
  fallback,
}: AvatarProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'xs':
        return 'w-6 h-6 text-[10px]';
      case 'sm':
        return 'w-8 h-8 text-xs';
      case 'lg':
        return 'w-12 h-12 text-base';
      case 'xl':
        return 'w-16 h-16 text-lg';
      case 'md':
      default:
        return 'w-10 h-10 text-sm';
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={`${getSizeStyles()} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${getSizeStyles()} rounded-full bg-surface-700 flex items-center justify-center font-medium text-primary-400 ${className}`}
    >
      {fallback || (name ? getInitials(name) : '?')}
    </div>
  );
}

// Asset avatar (for crypto assets)
interface AssetAvatarProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AssetAvatar({ symbol, size = 'md', className = '' }: AssetAvatarProps) {
  return (
    <Avatar
      name={symbol}
      size={size}
      className={className}
      fallback={symbol.slice(0, 2).toUpperCase()}
    />
  );
}

// Avatar group (for showing multiple avatars)
interface AvatarGroupProps {
  avatars: Array<{
    src?: string;
    name?: string;
    alt?: string;
  }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className = '',
}: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  const getOverlapStyles = () => {
    switch (size) {
      case 'xs':
        return '-ml-2';
      case 'sm':
        return '-ml-2.5';
      case 'lg':
        return '-ml-4';
      case 'md':
      default:
        return '-ml-3';
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={`${index > 0 ? getOverlapStyles() : ''} ring-2 ring-surface-900 rounded-full`}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            alt={avatar.alt}
            size={size}
          />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`${getOverlapStyles()} ring-2 ring-surface-900 rounded-full`}
        >
          <Avatar
            size={size}
            fallback={`+${remainingCount}`}
          />
        </div>
      )}
    </div>
  );
}

// Chain avatar (for blockchain networks)
interface ChainAvatarProps {
  chain: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const CHAIN_ICONS: Record<string, string> = {
  ethereum: 'E',
  arbitrum: 'A',
  optimism: 'O',
  base: 'B',
  polygon: 'P',
  bsc: 'B',
  avalanche: 'A',
  solana: 'S',
};

export function ChainAvatar({ chain, size = 'md', className = '' }: ChainAvatarProps) {
  const chainKey = chain.toLowerCase();
  const initial = CHAIN_ICONS[chainKey] || chain[0]?.toUpperCase() || '?';

  return (
    <Avatar
      size={size}
      className={className}
      fallback={initial}
    />
  );
}
