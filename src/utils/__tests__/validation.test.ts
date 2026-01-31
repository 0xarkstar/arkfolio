import { describe, it, expect } from 'vitest';
import {
  validateAssetSymbol,
  validateExchangeName,
  validateEvmAddress,
  validateSolanaAddress,
  validateApiKey,
  sanitizeUserInput,
  sanitizeHtml,
  ValidationResult,
} from '../validation';

describe('validation utilities', () => {
  describe('validateAssetSymbol', () => {
    it('should accept valid asset symbols', () => {
      expect(validateAssetSymbol('BTC').isValid).toBe(true);
      expect(validateAssetSymbol('ETH').isValid).toBe(true);
      expect(validateAssetSymbol('USDT').isValid).toBe(true);
      expect(validateAssetSymbol('MATIC').isValid).toBe(true);
      expect(validateAssetSymbol('BTC.D').isValid).toBe(true); // With dot
    });

    it('should reject invalid asset symbols', () => {
      expect(validateAssetSymbol('').isValid).toBe(false);
      expect(validateAssetSymbol('ABCDEFGHIJKLMNOPQRSTUVWXYZ').isValid).toBe(false); // Too long (>20)
      expect(validateAssetSymbol('BTC$').isValid).toBe(false); // Invalid chars
      expect(validateAssetSymbol('<script>').isValid).toBe(false); // XSS attempt
      expect(validateAssetSymbol('BTC-USD').isValid).toBe(false); // Hyphen not allowed
    });

    it('should return sanitized uppercase value', () => {
      const result = validateAssetSymbol('btc');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('BTC'); // Uppercase
    });
  });

  describe('validateExchangeName', () => {
    it('should accept valid exchange names', () => {
      expect(validateExchangeName('binance').isValid).toBe(true);
      expect(validateExchangeName('okx').isValid).toBe(true);
      expect(validateExchangeName('upbit').isValid).toBe(true);
      expect(validateExchangeName('hyperliquid').isValid).toBe(true);
      expect(validateExchangeName('dydx').isValid).toBe(true);
      expect(validateExchangeName('my_exchange').isValid).toBe(true);
      expect(validateExchangeName('exchange-1').isValid).toBe(true);
    });

    it('should reject invalid exchange names', () => {
      expect(validateExchangeName('').isValid).toBe(false);
      expect(validateExchangeName('123exchange').isValid).toBe(false); // Must start with letter
      expect(validateExchangeName('ex$change').isValid).toBe(false); // Invalid char
    });

    it('should return sanitized lowercase value', () => {
      const result = validateExchangeName('Binance');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('binance');
    });
  });

  describe('validateEvmAddress', () => {
    it('should accept valid EVM addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f7c283';
      const result = validateEvmAddress(validAddress);
      expect(result.isValid).toBe(true);
    });

    it('should accept lowercase EVM addresses', () => {
      const lowerAddress = '0x742d35cc6634c0532925a3b844bc9e7595f7c283';
      const result = validateEvmAddress(lowerAddress);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid EVM addresses', () => {
      expect(validateEvmAddress('').isValid).toBe(false);
      expect(validateEvmAddress('0x123').isValid).toBe(false); // Too short
      expect(validateEvmAddress('742d35Cc6634C0532925a3b844Bc9e7595f7c283').isValid).toBe(false); // Missing 0x
      expect(validateEvmAddress('0xZZZd35Cc6634C0532925a3b844Bc9e7595f7c283').isValid).toBe(false); // Invalid hex
    });

    it('should sanitize to lowercase', () => {
      const result = validateEvmAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f7c283');
      expect(result.sanitized).toBe('0x742d35cc6634c0532925a3b844bc9e7595f7c283');
    });
  });

  describe('validateSolanaAddress', () => {
    it('should accept valid Solana addresses', () => {
      const validAddress = '5yBNKxM5wRxqXdqC9fqZJPv7kgWxD4KPmGMGMxJfBaL5';
      const result = validateSolanaAddress(validAddress);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid Solana addresses', () => {
      expect(validateSolanaAddress('').isValid).toBe(false);
      expect(validateSolanaAddress('short').isValid).toBe(false);
      expect(validateSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f7c283').isValid).toBe(false); // EVM address
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API keys', () => {
      expect(validateApiKey('abc123DEF456').isValid).toBe(true);
      expect(validateApiKey('test-api-key-12345').isValid).toBe(true);
      expect(validateApiKey('API_KEY_WITH_UNDERSCORES').isValid).toBe(true);
      expect(validateApiKey('abcd1234').isValid).toBe(true); // Exactly 8 chars
    });

    it('should reject invalid API keys', () => {
      expect(validateApiKey('').isValid).toBe(false);
      expect(validateApiKey('ab').isValid).toBe(false); // Too short (< 8)
      expect(validateApiKey('short').isValid).toBe(false); // Too short (< 8)
    });

    it('should not modify valid API keys', () => {
      const apiKey = 'MyValidAPIKey123';
      const result = validateApiKey(apiKey);
      expect(result.sanitized).toBe(apiKey);
    });
  });

  describe('sanitizeUserInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeUserInput('  hello  ')).toBe('hello');
    });

    it('should remove control characters', () => {
      // Null bytes and control chars are removed (not replaced with space)
      expect(sanitizeUserInput('hello\x00world')).toBe('helloworld');
      expect(sanitizeUserInput('test\x1Fvalue')).toBe('testvalue');
    });

    it('should normalize multiple spaces to single space', () => {
      expect(sanitizeUserInput('hello    world')).toBe('hello world');
    });

    it('should allow normal text', () => {
      expect(sanitizeUserInput('Hello World 123')).toBe('Hello World 123');
    });

    it('should handle empty input', () => {
      expect(sanitizeUserInput('')).toBe('');
      expect(sanitizeUserInput('   ')).toBe('');
    });

    it('should preserve unicode characters', () => {
      expect(sanitizeUserInput('한글 테스트')).toBe('한글 테스트');
      expect(sanitizeUserInput('日本語')).toBe('日本語');
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<script>')).toBe('&lt;script&gt;');
      expect(sanitizeHtml('Hello & World')).toBe('Hello &amp; World');
      expect(sanitizeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(sanitizeHtml("it's")).toBe('it&#x27;s');
    });

    it('should prevent XSS attacks', () => {
      const xssPayload = '<script>alert("xss")</script>';
      const sanitized = sanitizeHtml(xssPayload);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    it('should handle normal text', () => {
      expect(sanitizeHtml('Hello World')).toBe('Hello World');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should escape forward slashes', () => {
      expect(sanitizeHtml('path/to/file')).toBe('path&#x2F;to&#x2F;file');
    });
  });

  describe('ValidationResult type', () => {
    it('should contain all expected fields', () => {
      const result: ValidationResult = {
        isValid: true,
        sanitized: 'test',
        error: undefined,
      };

      expect(result.isValid).toBeDefined();
      expect(result.sanitized).toBeDefined();
    });

    it('should include error message when invalid', () => {
      const result = validateAssetSymbol('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });
});
