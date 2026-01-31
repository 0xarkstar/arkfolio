/**
 * Decimal.js utility functions for financial calculations
 *
 * This module provides type-safe utilities for working with Decimal.js,
 * ensuring precision in financial calculations and preventing common
 * pitfalls like mixing Decimal with Number/parseFloat.
 *
 * Guidelines:
 * - Use Decimal for all financial calculations
 * - Only call toNumber() at UI rendering time
 * - Use these utilities instead of parseFloat/new Decimal directly
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 20,
});

/**
 * Type guard to check if a value is a Decimal
 */
export function isDecimal(value: unknown): value is Decimal {
  return value instanceof Decimal;
}

/**
 * Safely convert a value to Decimal
 * Handles string, number, Decimal, null, undefined
 *
 * @param value - Value to convert
 * @param defaultValue - Default if conversion fails (default: 0)
 * @returns Decimal instance
 */
export function toDecimal(
  value: string | number | Decimal | null | undefined,
  defaultValue: Decimal | number = 0
): Decimal {
  if (value === null || value === undefined || value === '') {
    return isDecimal(defaultValue) ? defaultValue : new Decimal(defaultValue);
  }

  if (isDecimal(value)) {
    return value;
  }

  try {
    // Handle string with commas (e.g., "1,000.50")
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').trim();
      if (cleaned === '' || cleaned === '-') {
        return isDecimal(defaultValue) ? defaultValue : new Decimal(defaultValue);
      }
      return new Decimal(cleaned);
    }

    // Handle number (including NaN and Infinity)
    if (typeof value === 'number') {
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        return isDecimal(defaultValue) ? defaultValue : new Decimal(defaultValue);
      }
      return new Decimal(value);
    }

    return isDecimal(defaultValue) ? defaultValue : new Decimal(defaultValue);
  } catch {
    return isDecimal(defaultValue) ? defaultValue : new Decimal(defaultValue);
  }
}

/**
 * Parse a string value to Decimal (replaces parseFloat usage)
 * Use this instead of parseFloat() for financial values
 */
export function parseDecimal(value: string | null | undefined, defaultValue = 0): Decimal {
  return toDecimal(value, defaultValue);
}

/**
 * Convert Decimal to number for UI display
 * Only use this at the final rendering step
 */
export function toDisplayNumber(value: Decimal | null | undefined): number {
  if (!value || !isDecimal(value)) {
    return 0;
  }
  return value.toNumber();
}

/**
 * Format Decimal as currency string
 */
export function formatCurrency(
  value: Decimal | number | null | undefined,
  currency = 'USD',
  locale = 'en-US',
  options: Intl.NumberFormatOptions = {}
): string {
  const num = isDecimal(value) ? value.toNumber() : (value ?? 0);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(num);
}

/**
 * Format Decimal with fixed decimal places
 */
export function formatDecimal(
  value: Decimal | number | null | undefined,
  decimalPlaces = 2
): string {
  if (value === null || value === undefined) {
    return '0';
  }
  const decimal = isDecimal(value) ? value : new Decimal(value);
  return decimal.toFixed(decimalPlaces);
}

/**
 * Format Decimal as percentage
 */
export function formatPercent(
  value: Decimal | number | null | undefined,
  decimalPlaces = 2,
  includeSign = false
): string {
  if (value === null || value === undefined) {
    return '0%';
  }
  const num = isDecimal(value) ? value.toNumber() : value;
  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimalPlaces)}%`;
}

/**
 * Safely add multiple Decimal values
 */
export function sumDecimals(...values: (Decimal | number | string | null | undefined)[]): Decimal {
  return values.reduce<Decimal>(
    (sum, val) => sum.plus(toDecimal(val)),
    new Decimal(0)
  );
}

/**
 * Calculate percentage of total
 */
export function calculatePercent(
  value: Decimal | number,
  total: Decimal | number
): Decimal {
  const valueDecimal = toDecimal(value);
  const totalDecimal = toDecimal(total);

  if (totalDecimal.isZero()) {
    return new Decimal(0);
  }

  return valueDecimal.dividedBy(totalDecimal).times(100);
}

/**
 * Check if two Decimals are approximately equal
 * Useful for comparing floating point results
 */
export function isApproximatelyEqual(
  a: Decimal | number,
  b: Decimal | number,
  tolerance = 0.000001
): boolean {
  const aDecimal = toDecimal(a);
  const bDecimal = toDecimal(b);
  return aDecimal.minus(bDecimal).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Clamp a Decimal between min and max values
 */
export function clampDecimal(
  value: Decimal | number,
  min: Decimal | number,
  max: Decimal | number
): Decimal {
  const valueDecimal = toDecimal(value);
  const minDecimal = toDecimal(min);
  const maxDecimal = toDecimal(max);

  if (valueDecimal.lessThan(minDecimal)) {
    return minDecimal;
  }
  if (valueDecimal.greaterThan(maxDecimal)) {
    return maxDecimal;
  }
  return valueDecimal;
}

/**
 * Calculate the maximum of multiple Decimals
 */
export function maxDecimal(...values: (Decimal | number)[]): Decimal {
  if (values.length === 0) {
    return new Decimal(0);
  }
  return values.reduce<Decimal>(
    (max, val) => {
      const decimal = toDecimal(val);
      return decimal.greaterThan(max) ? decimal : max;
    },
    toDecimal(values[0])
  );
}

/**
 * Calculate the minimum of multiple Decimals
 */
export function minDecimal(...values: (Decimal | number)[]): Decimal {
  if (values.length === 0) {
    return new Decimal(0);
  }
  return values.reduce<Decimal>(
    (min, val) => {
      const decimal = toDecimal(val);
      return decimal.lessThan(min) ? decimal : min;
    },
    toDecimal(values[0])
  );
}

/**
 * Round a Decimal to a specific number of decimal places
 */
export function roundDecimal(
  value: Decimal | number,
  decimalPlaces: number,
  roundingMode: Decimal.Rounding = Decimal.ROUND_HALF_UP
): Decimal {
  const decimal = toDecimal(value);
  return decimal.toDecimalPlaces(decimalPlaces, roundingMode);
}

/**
 * Check if a Decimal is positive
 */
export function isPositive(value: Decimal | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const decimal = toDecimal(value);
  return decimal.greaterThan(0);
}

/**
 * Check if a Decimal is negative
 */
export function isNegative(value: Decimal | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const decimal = toDecimal(value);
  return decimal.lessThan(0);
}

/**
 * Check if a Decimal is zero
 */
export function isZero(value: Decimal | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  const decimal = toDecimal(value);
  return decimal.isZero();
}

// Re-export Decimal for convenience
export { Decimal };
