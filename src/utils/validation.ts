/**
 * Input validation utilities for security
 *
 * Provides validation and sanitization for user inputs
 * to prevent injection attacks and ensure data integrity.
 */

// Common patterns for validation
const PATTERNS = {
  // Asset symbols: 1-20 uppercase letters, numbers, and dots
  assetSymbol: /^[A-Z0-9.]{1,20}$/,
  // Exchange names: alphanumeric with underscores and hyphens
  exchangeName: /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/,
  // Wallet addresses: hex (0x...) or base58 (Solana)
  evmAddress: /^0x[a-fA-F0-9]{40}$/,
  solanaAddress: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  // API keys: alphanumeric with common separators
  apiKey: /^[a-zA-Z0-9_-]{8,128}$/,
  // UUID v4
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  // Email (basic validation)
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // URL (basic validation)
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
};

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validate asset symbol (e.g., BTC, ETH, USDT)
 */
export function validateAssetSymbol(symbol: string): ValidationResult {
  if (!symbol || typeof symbol !== 'string') {
    return { isValid: false, error: 'Asset symbol is required' };
  }

  const trimmed = symbol.trim().toUpperCase();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Asset symbol cannot be empty' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Asset symbol is too long (max 20 characters)' };
  }

  if (!PATTERNS.assetSymbol.test(trimmed)) {
    return { isValid: false, error: 'Asset symbol contains invalid characters' };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate exchange name (e.g., binance, okx, upbit)
 */
export function validateExchangeName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Exchange name is required' };
  }

  const trimmed = name.trim().toLowerCase();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Exchange name cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: 'Exchange name is too long (max 50 characters)' };
  }

  if (!PATTERNS.exchangeName.test(name.trim())) {
    return { isValid: false, error: 'Exchange name contains invalid characters' };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate EVM wallet address (Ethereum, Polygon, BSC, etc.)
 */
export function validateEvmAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Wallet address is required' };
  }

  const trimmed = address.trim();

  if (!PATTERNS.evmAddress.test(trimmed)) {
    return { isValid: false, error: 'Invalid EVM wallet address format' };
  }

  // Normalize to lowercase (checksum validation could be added)
  return { isValid: true, sanitized: trimmed.toLowerCase() };
}

/**
 * Validate Solana wallet address
 */
export function validateSolanaAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Wallet address is required' };
  }

  const trimmed = address.trim();

  if (!PATTERNS.solanaAddress.test(trimmed)) {
    return { isValid: false, error: 'Invalid Solana wallet address format' };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate any wallet address (auto-detect chain)
 */
export function validateWalletAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Wallet address is required' };
  }

  const trimmed = address.trim();

  // Check EVM format first
  if (trimmed.startsWith('0x')) {
    return validateEvmAddress(trimmed);
  }

  // Check Solana format
  if (PATTERNS.solanaAddress.test(trimmed)) {
    return validateSolanaAddress(trimmed);
  }

  return { isValid: false, error: 'Unrecognized wallet address format' };
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: 'API key is required' };
  }

  const trimmed = key.trim();

  if (trimmed.length < 8) {
    return { isValid: false, error: 'API key is too short' };
  }

  if (trimmed.length > 128) {
    return { isValid: false, error: 'API key is too long' };
  }

  // Don't be too strict on API key format as exchanges vary
  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate UUID v4
 */
export function validateUuid(id: string): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: 'ID is required' };
  }

  const trimmed = id.trim().toLowerCase();

  if (!PATTERNS.uuid.test(trimmed)) {
    return { isValid: false, error: 'Invalid ID format' };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  if (!PATTERNS.email.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validate URL
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  if (!PATTERNS.url.test(trimmed)) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  try {
    new URL(trimmed);
    return { isValid: true, sanitized: trimmed };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate numeric string (for amounts, prices)
 */
export function validateNumericString(
  value: string,
  options: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    maxDecimals?: number;
  } = {}
): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Value is required' };
  }

  const trimmed = value.trim();

  // Check for valid number format
  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { isValid: false, error: 'Invalid numeric value' };
  }

  // Check negative
  if (!options.allowNegative && num < 0) {
    return { isValid: false, error: 'Negative values are not allowed' };
  }

  // Check min/max
  if (options.min !== undefined && num < options.min) {
    return { isValid: false, error: `Value must be at least ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { isValid: false, error: `Value must be at most ${options.max}` };
  }

  // Check decimal places
  if (options.maxDecimals !== undefined) {
    const parts = trimmed.split('.');
    if (parts.length === 2 && parts[1].length > options.maxDecimals) {
      return { isValid: false, error: `Maximum ${options.maxDecimals} decimal places allowed` };
    }
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Sanitize user input by removing potentially dangerous characters
 */
export function sanitizeUserInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Trim whitespace
    .trim()
    // Limit length
    .slice(0, maxLength)
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newlines and tabs)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ');
}

/**
 * Sanitize HTML content (basic XSS prevention)
 * For display purposes only - use proper escaping for DOM insertion
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize a search query
 */
export function validateSearchQuery(query: string): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { isValid: true, sanitized: '' }; // Empty search is valid
  }

  const sanitized = sanitizeUserInput(query, 200);

  // Remove potential regex special characters for safety
  const safe = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '');

  return { isValid: true, sanitized: safe };
}

/**
 * Validate alert threshold values
 */
export function validateAlertThreshold(
  value: string,
  type: 'price' | 'percentage' | 'amount'
): ValidationResult {
  const numResult = validateNumericString(value, { allowNegative: type === 'percentage' });
  if (!numResult.isValid) {
    return numResult;
  }

  const num = parseFloat(numResult.sanitized!);

  switch (type) {
    case 'price':
      if (num <= 0) {
        return { isValid: false, error: 'Price must be greater than 0' };
      }
      break;
    case 'percentage':
      if (num < -100 || num > 10000) {
        return { isValid: false, error: 'Percentage must be between -100% and 10000%' };
      }
      break;
    case 'amount':
      if (num < 0) {
        return { isValid: false, error: 'Amount cannot be negative' };
      }
      break;
  }

  return { isValid: true, sanitized: numResult.sanitized };
}

// Export patterns for testing
export const VALIDATION_PATTERNS = PATTERNS;
