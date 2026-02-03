import { Decimal, toDecimal, toDisplayNumber } from '../../utils/decimal';

export function formatCurrency(value: number | Decimal): string {
  const num = toDisplayNumber(toDecimal(value));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function getPositionTypeLabel(type: string): string {
  switch (type) {
    case 'lp':
      return 'LP';
    case 'lending':
      return 'Lending';
    case 'borrowing':
      return 'Borrowing';
    case 'pt':
      return 'PT';
    case 'yt':
      return 'YT';
    case 'restaking':
      return 'Restaking';
    case 'staking':
      return 'Staking';
    case 'vault':
      return 'Vault';
    default:
      return type;
  }
}

export function getPositionTypeVariant(type: string): 'info' | 'success' | 'danger' | 'warning' | 'default' {
  switch (type) {
    case 'lp':
      return 'info';
    case 'lending':
      return 'success';
    case 'borrowing':
      return 'danger';
    case 'pt':
    case 'yt':
    case 'restaking':
      return 'warning';
    case 'staking':
    case 'vault':
    default:
      return 'default';
  }
}
