import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

/**
 * Error types for classification
 */
export enum HttpErrorType {
  AUTH = 'auth',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown',
}

/**
 * User-friendly error messages by type
 */
const USER_FRIENDLY_MESSAGES: Record<HttpErrorType, string> = {
  [HttpErrorType.AUTH]: 'Authentication failed. Please check your API key or credentials.',
  [HttpErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [HttpErrorType.NETWORK]: 'Network connection issue. Please check your internet connection.',
  [HttpErrorType.TIMEOUT]: 'Request took too long. Please try again.',
  [HttpErrorType.SERVER]: 'The service is temporarily unavailable. Please try again later.',
  [HttpErrorType.CLIENT]: 'Invalid request. Please check your input and try again.',
  [HttpErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Structured HTTP error with classification
 */
export class HttpError extends Error {
  readonly type: HttpErrorType;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly retryAfter?: number; // seconds
  readonly originalError?: Error;

  constructor(
    message: string,
    type: HttpErrorType,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      retryAfter?: number;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'HttpError';
    this.type = type;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    this.retryAfter = options?.retryAfter;
    this.originalError = options?.originalError;
  }

  /**
   * Get a user-friendly error message suitable for UI display
   */
  getUserFriendlyMessage(): string {
    return USER_FRIENDLY_MESSAGES[this.type] || USER_FRIENDLY_MESSAGES[HttpErrorType.UNKNOWN];
  }

  static fromAxiosError(error: AxiosError): HttpError {
    const statusCode = error.response?.status;
    const message = error.message;

    // Auth errors (401, 403)
    if (statusCode === 401 || statusCode === 403) {
      return new HttpError(
        `Authentication failed: ${message}`,
        HttpErrorType.AUTH,
        { statusCode, retryable: false, originalError: error }
      );
    }

    // Rate limit (429)
    if (statusCode === 429) {
      const retryAfter = parseInt(
        error.response?.headers?.['retry-after'] ||
        error.response?.headers?.['x-ratelimit-reset'] ||
        '60',
        10
      );
      return new HttpError(
        `Rate limit exceeded. Retry after ${retryAfter}s`,
        HttpErrorType.RATE_LIMIT,
        { statusCode, retryable: true, retryAfter, originalError: error }
      );
    }

    // Timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new HttpError(
        `Request timed out: ${message}`,
        HttpErrorType.TIMEOUT,
        { retryable: true, originalError: error }
      );
    }

    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      return new HttpError(
        `Network error: ${message}`,
        HttpErrorType.NETWORK,
        { retryable: true, originalError: error }
      );
    }

    // Server errors (5xx)
    if (statusCode && statusCode >= 500) {
      return new HttpError(
        `Server error: ${message}`,
        HttpErrorType.SERVER,
        { statusCode, retryable: true, originalError: error }
      );
    }

    // Client errors (4xx)
    if (statusCode && statusCode >= 400) {
      return new HttpError(
        `Client error: ${message}`,
        HttpErrorType.CLIENT,
        { statusCode, retryable: false, originalError: error }
      );
    }

    // Unknown
    return new HttpError(
      `Unknown error: ${message}`,
      HttpErrorType.UNKNOWN,
      { statusCode, retryable: false, originalError: error }
    );
  }
}

/**
 * Convert any error to a user-friendly message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.getUserFriendlyMessage();
  }
  if (error instanceof Error) {
    // Check for common patterns and provide friendly messages
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return USER_FRIENDLY_MESSAGES[HttpErrorType.NETWORK];
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return USER_FRIENDLY_MESSAGES[HttpErrorType.TIMEOUT];
    }
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('403')) {
      return USER_FRIENDLY_MESSAGES[HttpErrorType.AUTH];
    }
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
      return USER_FRIENDLY_MESSAGES[HttpErrorType.RATE_LIMIT];
    }
    // Return the original message if it's short and doesn't look like a technical error
    if (error.message.length < 100 && !msg.includes('error:') && !msg.includes('exception')) {
      return error.message;
    }
    return USER_FRIENDLY_MESSAGES[HttpErrorType.UNKNOWN];
  }
  return USER_FRIENDLY_MESSAGES[HttpErrorType.UNKNOWN];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: HttpErrorType[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOn: [HttpErrorType.RATE_LIMIT, HttpErrorType.TIMEOUT, HttpErrorType.NETWORK, HttpErrorType.SERVER],
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfter?: number
): number {
  // If server specified retry-after, use it
  if (retryAfter && retryAfter > 0) {
    return Math.min(retryAfter * 1000, maxDelayMs);
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute HTTP request with retry logic
 */
export async function httpWithRetry<T>(
  requestFn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: HttpError | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      const httpError = error instanceof HttpError
        ? error
        : error instanceof AxiosError
          ? HttpError.fromAxiosError(error)
          : new HttpError(
              error instanceof Error ? error.message : 'Unknown error',
              HttpErrorType.UNKNOWN,
              { originalError: error instanceof Error ? error : undefined }
            );

      lastError = httpError;

      // Check if we should retry
      const shouldRetry =
        attempt < retryConfig.maxRetries &&
        httpError.retryable &&
        retryConfig.retryOn?.includes(httpError.type);

      if (!shouldRetry) {
        throw httpError;
      }

      // Calculate delay
      const delay = calculateBackoffDelay(
        attempt,
        retryConfig.baseDelayMs,
        retryConfig.maxDelayMs,
        httpError.retryAfter
      );

      console.log(
        `[httpWithRetry] Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed: ${httpError.type}. ` +
        `Retrying in ${Math.round(delay / 1000)}s...`
      );

      await sleep(delay);
    }
  }

  throw lastError || new HttpError('Max retries exceeded', HttpErrorType.UNKNOWN);
}

/**
 * Rate limiter class for managing request rates
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private requestQueue: Array<{ resolve: () => void }> = [];
  private processing = false;

  constructor(
    private minIntervalMs: number,
    private maxRequestsPerWindow: number = Infinity,
    private windowMs: number = 60000
  ) {}

  private requestTimestamps: number[] = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.requestQueue.push({ resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();

      // Clean old timestamps
      this.requestTimestamps = this.requestTimestamps.filter(
        t => now - t < this.windowMs
      );

      // Check window limit
      if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
        const oldestInWindow = this.requestTimestamps[0];
        const waitTime = this.windowMs - (now - oldestInWindow);
        if (waitTime > 0) {
          await sleep(waitTime);
          continue;
        }
      }

      // Check minimum interval
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minIntervalMs) {
        await sleep(this.minIntervalMs - timeSinceLastRequest);
      }

      // Process request
      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        this.requestTimestamps.push(this.lastRequestTime);
        request.resolve();
      }
    }

    this.processing = false;
  }
}

/**
 * Create an axios instance with built-in retry and rate limiting
 */
export function createHttpClient(
  baseConfig: AxiosRequestConfig = {},
  retryConfig: Partial<RetryConfig> = {},
  rateLimiter?: RateLimiter
): {
  client: AxiosInstance;
  request: <T>(config: AxiosRequestConfig) => Promise<T>;
  get: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>;
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
} {
  const client = axios.create({
    timeout: 30000,
    ...baseConfig,
  });

  const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
    if (rateLimiter) {
      await rateLimiter.acquire();
    }

    return httpWithRetry(
      async () => {
        const response = await client.request<T>(config);
        return response.data;
      },
      retryConfig
    );
  };

  const get = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return request<T>({ ...config, method: 'GET', url });
  };

  const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return request<T>({ ...config, method: 'POST', url, data });
  };

  return { client, request, get, post };
}
