import { describe, it, expect, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  HttpError,
  HttpErrorType,
  getErrorMessage,
  httpWithRetry,
  RateLimiter,
} from '../httpUtils';

describe('HttpError', () => {
  describe('constructor', () => {
    it('should create an error with type', () => {
      const error = new HttpError('Test error', HttpErrorType.AUTH);
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(HttpErrorType.AUTH);
      expect(error.name).toBe('HttpError');
    });

    it('should set statusCode when provided', () => {
      const error = new HttpError('Test error', HttpErrorType.CLIENT, { statusCode: 400 });
      expect(error.statusCode).toBe(400);
    });

    it('should default retryable to false', () => {
      const error = new HttpError('Test error', HttpErrorType.AUTH);
      expect(error.retryable).toBe(false);
    });

    it('should set retryable when provided', () => {
      const error = new HttpError('Test error', HttpErrorType.RATE_LIMIT, { retryable: true });
      expect(error.retryable).toBe(true);
    });

    it('should set retryAfter when provided', () => {
      const error = new HttpError('Test error', HttpErrorType.RATE_LIMIT, { retryAfter: 60 });
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return friendly message for AUTH', () => {
      const error = new HttpError('Test', HttpErrorType.AUTH);
      expect(error.getUserFriendlyMessage()).toContain('Authentication failed');
    });

    it('should return friendly message for RATE_LIMIT', () => {
      const error = new HttpError('Test', HttpErrorType.RATE_LIMIT);
      expect(error.getUserFriendlyMessage()).toContain('Too many requests');
    });

    it('should return friendly message for NETWORK', () => {
      const error = new HttpError('Test', HttpErrorType.NETWORK);
      expect(error.getUserFriendlyMessage()).toContain('Network');
    });

    it('should return friendly message for TIMEOUT', () => {
      const error = new HttpError('Test', HttpErrorType.TIMEOUT);
      expect(error.getUserFriendlyMessage()).toContain('too long');
    });

    it('should return friendly message for SERVER', () => {
      const error = new HttpError('Test', HttpErrorType.SERVER);
      expect(error.getUserFriendlyMessage()).toContain('temporarily unavailable');
    });

    it('should return friendly message for CLIENT', () => {
      const error = new HttpError('Test', HttpErrorType.CLIENT);
      expect(error.getUserFriendlyMessage()).toContain('Invalid request');
    });

    it('should return friendly message for UNKNOWN', () => {
      const error = new HttpError('Test', HttpErrorType.UNKNOWN);
      expect(error.getUserFriendlyMessage()).toContain('unexpected error');
    });
  });

  describe('fromAxiosError', () => {
    const createAxiosError = (
      status?: number,
      code?: string,
      headers?: Record<string, string>
    ): AxiosError => {
      const error = new AxiosError('Request failed');
      error.code = code;
      if (status) {
        error.response = {
          status,
          statusText: 'Error',
          data: {},
          headers: new AxiosHeaders(headers || {}),
          config: { headers: new AxiosHeaders() },
        };
      }
      return error;
    };

    it('should classify 401 as AUTH', () => {
      const axiosError = createAxiosError(401);
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.AUTH);
      expect(httpError.retryable).toBe(false);
    });

    it('should classify 403 as AUTH', () => {
      const axiosError = createAxiosError(403);
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.AUTH);
    });

    it('should classify 429 as RATE_LIMIT', () => {
      const axiosError = createAxiosError(429, undefined, { 'retry-after': '30' });
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.RATE_LIMIT);
      expect(httpError.retryable).toBe(true);
      expect(httpError.retryAfter).toBe(30);
    });

    it('should classify ECONNABORTED as TIMEOUT', () => {
      const axiosError = createAxiosError(undefined, 'ECONNABORTED');
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.TIMEOUT);
      expect(httpError.retryable).toBe(true);
    });

    it('should classify ETIMEDOUT as TIMEOUT', () => {
      const axiosError = createAxiosError(undefined, 'ETIMEDOUT');
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.TIMEOUT);
    });

    it('should classify ENOTFOUND as NETWORK', () => {
      const axiosError = createAxiosError(undefined, 'ENOTFOUND');
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.NETWORK);
      expect(httpError.retryable).toBe(true);
    });

    it('should classify ECONNREFUSED as NETWORK', () => {
      const axiosError = createAxiosError(undefined, 'ECONNREFUSED');
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.NETWORK);
    });

    it('should classify 5xx as SERVER', () => {
      const axiosError = createAxiosError(500);
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.SERVER);
      expect(httpError.retryable).toBe(true);
    });

    it('should classify 503 as SERVER', () => {
      const axiosError = createAxiosError(503);
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.SERVER);
    });

    it('should classify 4xx as CLIENT', () => {
      const axiosError = createAxiosError(400);
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.CLIENT);
      expect(httpError.retryable).toBe(false);
    });

    it('should classify unknown errors as UNKNOWN', () => {
      const axiosError = new AxiosError('Unknown');
      const httpError = HttpError.fromAxiosError(axiosError);
      expect(httpError.type).toBe(HttpErrorType.UNKNOWN);
    });
  });
});

describe('getErrorMessage', () => {
  it('should return friendly message for HttpError', () => {
    const error = new HttpError('Test', HttpErrorType.NETWORK);
    expect(getErrorMessage(error)).toContain('Network');
  });

  it('should detect network errors in Error messages', () => {
    const error = new Error('Network request failed');
    expect(getErrorMessage(error)).toContain('Network');
  });

  it('should detect timeout errors in Error messages', () => {
    const error = new Error('Request timed out');
    expect(getErrorMessage(error)).toContain('too long');
  });

  it('should detect auth errors in Error messages', () => {
    const error = new Error('401 Unauthorized');
    expect(getErrorMessage(error)).toContain('Authentication');
  });

  it('should detect rate limit errors in Error messages', () => {
    const error = new Error('Too many requests');
    expect(getErrorMessage(error)).toContain('Too many requests');
  });

  it('should return original message for short non-technical errors', () => {
    const error = new Error('Custom error message');
    expect(getErrorMessage(error)).toBe('Custom error message');
  });

  it('should return unknown message for non-Error values', () => {
    expect(getErrorMessage('string error')).toContain('unexpected error');
    expect(getErrorMessage(null)).toContain('unexpected error');
    expect(getErrorMessage(undefined)).toContain('unexpected error');
  });
});

describe('httpWithRetry', () => {
  it('should return result on success', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await httpWithRetry(mockFn, { maxRetries: 3 });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should throw non-retryable error immediately', async () => {
    const error = new HttpError('Auth failed', HttpErrorType.AUTH, { retryable: false });
    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(httpWithRetry(mockFn, { maxRetries: 3 })).rejects.toThrow('Auth failed');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const error = new HttpError('Server error', HttpErrorType.SERVER, { retryable: true });
    const mockFn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await httpWithRetry(mockFn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const error = new HttpError('Server error', HttpErrorType.SERVER, { retryable: true });
    const mockFn = vi.fn().mockRejectedValue(error);

    try {
      await httpWithRetry(mockFn, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 50,
      });
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
    }
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('RateLimiter', () => {
  it('should allow immediate first request', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();

    await limiter.acquire();

    expect(Date.now() - start).toBeLessThan(50);
  });

  it('should enforce minimum interval between requests', async () => {
    const limiter = new RateLimiter(20); // 20ms between requests

    // First request - immediate
    await limiter.acquire();

    // Second request should wait
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    // Should have waited at least the minimum interval (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });
});
