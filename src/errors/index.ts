/**
 * Unified Error Handling Module
 *
 * This module provides a consistent error handling system across the application.
 * All error classes follow the same pattern:
 * - Typed error enum for classification
 * - User-friendly message generation
 * - Static factory method for conversion from unknown errors
 */

// Re-export existing error classes and utilities from httpUtils
export {
  HttpError,
  HttpErrorType,
  BlockchainError,
  BlockchainErrorType,
  DefiError,
  DefiErrorType,
  getErrorMessage,
  getUserFriendlyError,
  type ErrorOptions,
} from '../services/utils/httpUtils';

/**
 * Base application error with common functionality
 */
export abstract class AppError extends Error {
  abstract readonly errorType: string;
  readonly originalError?: Error;
  readonly timestamp: Date;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.originalError = originalError;
    this.timestamp = new Date();
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  abstract getUserFriendlyMessage(): string;

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Database error types
 */
export enum DatabaseErrorType {
  NOT_INITIALIZED = 'not_initialized',
  CONNECTION_FAILED = 'connection_failed',
  QUERY_FAILED = 'query_failed',
  TRANSACTION_FAILED = 'transaction_failed',
  MIGRATION_FAILED = 'migration_failed',
  RECORD_NOT_FOUND = 'record_not_found',
  DUPLICATE_RECORD = 'duplicate_record',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  PERSISTENCE_FAILED = 'persistence_failed',
}

/**
 * User-friendly messages for database errors
 */
const DATABASE_USER_MESSAGES: Record<DatabaseErrorType, string> = {
  [DatabaseErrorType.NOT_INITIALIZED]: 'Database is not ready. Please restart the application.',
  [DatabaseErrorType.CONNECTION_FAILED]: 'Unable to connect to the database. Please try again.',
  [DatabaseErrorType.QUERY_FAILED]: 'Database operation failed. Please try again.',
  [DatabaseErrorType.TRANSACTION_FAILED]: 'Transaction failed. Your data has not been changed.',
  [DatabaseErrorType.MIGRATION_FAILED]: 'Database upgrade failed. Please contact support.',
  [DatabaseErrorType.RECORD_NOT_FOUND]: 'The requested record was not found.',
  [DatabaseErrorType.DUPLICATE_RECORD]: 'A record with this information already exists.',
  [DatabaseErrorType.CONSTRAINT_VIOLATION]: 'The operation violates data integrity rules.',
  [DatabaseErrorType.PERSISTENCE_FAILED]: 'Failed to save data. Please try again.',
};

/**
 * Database-specific error class
 */
export class DatabaseError extends Error {
  readonly type: DatabaseErrorType;
  readonly table?: string;
  readonly operation?: string;
  readonly originalError?: Error;

  constructor(
    message: string,
    type: DatabaseErrorType,
    options?: {
      table?: string;
      operation?: string;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.type = type;
    this.table = options?.table;
    this.operation = options?.operation;
    this.originalError = options?.originalError;
  }

  getUserFriendlyMessage(): string {
    return DATABASE_USER_MESSAGES[this.type] || 'A database error occurred. Please try again.';
  }

  static fromError(
    error: unknown,
    type = DatabaseErrorType.QUERY_FAILED,
    options?: { table?: string; operation?: string }
  ): DatabaseError {
    const message = error instanceof Error ? error.message : String(error);
    const msgLower = message.toLowerCase();

    // Detect error type from message
    let detectedType = type;

    if (msgLower.includes('not initialized') || msgLower.includes('not ready')) {
      detectedType = DatabaseErrorType.NOT_INITIALIZED;
    } else if (msgLower.includes('connection') || msgLower.includes('connect')) {
      detectedType = DatabaseErrorType.CONNECTION_FAILED;
    } else if (msgLower.includes('not found') || msgLower.includes('no rows')) {
      detectedType = DatabaseErrorType.RECORD_NOT_FOUND;
    } else if (msgLower.includes('duplicate') || msgLower.includes('unique constraint')) {
      detectedType = DatabaseErrorType.DUPLICATE_RECORD;
    } else if (msgLower.includes('constraint') || msgLower.includes('foreign key')) {
      detectedType = DatabaseErrorType.CONSTRAINT_VIOLATION;
    } else if (msgLower.includes('transaction') || msgLower.includes('rollback')) {
      detectedType = DatabaseErrorType.TRANSACTION_FAILED;
    } else if (msgLower.includes('migration')) {
      detectedType = DatabaseErrorType.MIGRATION_FAILED;
    } else if (msgLower.includes('persist') || msgLower.includes('save') || msgLower.includes('opfs')) {
      detectedType = DatabaseErrorType.PERSISTENCE_FAILED;
    }

    return new DatabaseError(message, detectedType, {
      ...options,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  static notInitialized(): DatabaseError {
    return new DatabaseError(
      'Database not initialized. Call initDatabase() first.',
      DatabaseErrorType.NOT_INITIALIZED
    );
  }

  static recordNotFound(table: string, id?: string): DatabaseError {
    const message = id
      ? `Record with id '${id}' not found in ${table}`
      : `Record not found in ${table}`;
    return new DatabaseError(message, DatabaseErrorType.RECORD_NOT_FOUND, { table });
  }
}

/**
 * Exchange error types
 */
export enum ExchangeErrorType {
  NOT_SUPPORTED = 'not_supported',
  NOT_CONNECTED = 'not_connected',
  ACCOUNT_NOT_FOUND = 'account_not_found',
  INVALID_CREDENTIALS = 'invalid_credentials',
  SYNC_FAILED = 'sync_failed',
  RATE_LIMIT = 'rate_limit',
  API_ERROR = 'api_error',
  BALANCE_FETCH_FAILED = 'balance_fetch_failed',
  POSITION_FETCH_FAILED = 'position_fetch_failed',
  TRANSACTION_FETCH_FAILED = 'transaction_fetch_failed',
}

/**
 * User-friendly messages for exchange errors
 */
const EXCHANGE_USER_MESSAGES: Record<ExchangeErrorType, string> = {
  [ExchangeErrorType.NOT_SUPPORTED]: 'This exchange is not supported.',
  [ExchangeErrorType.NOT_CONNECTED]: 'Exchange is not connected. Please reconnect.',
  [ExchangeErrorType.ACCOUNT_NOT_FOUND]: 'Exchange account not found.',
  [ExchangeErrorType.INVALID_CREDENTIALS]: 'Invalid API credentials. Please check your API key and secret.',
  [ExchangeErrorType.SYNC_FAILED]: 'Failed to sync exchange data. Please try again.',
  [ExchangeErrorType.RATE_LIMIT]: 'Too many requests to exchange. Please wait and try again.',
  [ExchangeErrorType.API_ERROR]: 'Exchange API error. Please try again later.',
  [ExchangeErrorType.BALANCE_FETCH_FAILED]: 'Failed to fetch balances from exchange.',
  [ExchangeErrorType.POSITION_FETCH_FAILED]: 'Failed to fetch positions from exchange.',
  [ExchangeErrorType.TRANSACTION_FETCH_FAILED]: 'Failed to fetch transactions from exchange.',
};

/**
 * Exchange-specific error class
 */
export class ExchangeError extends Error {
  readonly type: ExchangeErrorType;
  readonly exchangeId?: string;
  readonly accountId?: string;
  readonly originalError?: Error;

  constructor(
    message: string,
    type: ExchangeErrorType,
    options?: {
      exchangeId?: string;
      accountId?: string;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'ExchangeError';
    this.type = type;
    this.exchangeId = options?.exchangeId;
    this.accountId = options?.accountId;
    this.originalError = options?.originalError;
  }

  getUserFriendlyMessage(): string {
    return EXCHANGE_USER_MESSAGES[this.type] || 'An exchange error occurred. Please try again.';
  }

  static fromError(
    error: unknown,
    type = ExchangeErrorType.API_ERROR,
    options?: { exchangeId?: string; accountId?: string }
  ): ExchangeError {
    const message = error instanceof Error ? error.message : String(error);
    const msgLower = message.toLowerCase();

    // Detect error type from message
    let detectedType = type;

    if (msgLower.includes('not supported') || msgLower.includes('unsupported')) {
      detectedType = ExchangeErrorType.NOT_SUPPORTED;
    } else if (msgLower.includes('not connected') || msgLower.includes('disconnected')) {
      detectedType = ExchangeErrorType.NOT_CONNECTED;
    } else if (msgLower.includes('not found') || msgLower.includes('account not found')) {
      detectedType = ExchangeErrorType.ACCOUNT_NOT_FOUND;
    } else if (
      msgLower.includes('invalid') ||
      msgLower.includes('authentication') ||
      msgLower.includes('unauthorized') ||
      msgLower.includes('api key')
    ) {
      detectedType = ExchangeErrorType.INVALID_CREDENTIALS;
    } else if (msgLower.includes('rate limit') || msgLower.includes('too many')) {
      detectedType = ExchangeErrorType.RATE_LIMIT;
    } else if (msgLower.includes('balance')) {
      detectedType = ExchangeErrorType.BALANCE_FETCH_FAILED;
    } else if (msgLower.includes('position')) {
      detectedType = ExchangeErrorType.POSITION_FETCH_FAILED;
    } else if (msgLower.includes('transaction') || msgLower.includes('trade') || msgLower.includes('order')) {
      detectedType = ExchangeErrorType.TRANSACTION_FETCH_FAILED;
    }

    return new ExchangeError(message, detectedType, {
      ...options,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  static notSupported(exchangeId: string): ExchangeError {
    return new ExchangeError(
      `Unsupported exchange: ${exchangeId}`,
      ExchangeErrorType.NOT_SUPPORTED,
      { exchangeId }
    );
  }

  static notConnected(exchangeId?: string): ExchangeError {
    return new ExchangeError(
      'Exchange not connected',
      ExchangeErrorType.NOT_CONNECTED,
      { exchangeId }
    );
  }

  static accountNotFound(accountId: string): ExchangeError {
    return new ExchangeError(
      `Account not found: ${accountId}`,
      ExchangeErrorType.ACCOUNT_NOT_FOUND,
      { accountId }
    );
  }
}

/**
 * Validation error types
 */
export enum ValidationErrorType {
  REQUIRED_FIELD = 'required_field',
  INVALID_FORMAT = 'invalid_format',
  OUT_OF_RANGE = 'out_of_range',
  INVALID_TYPE = 'invalid_type',
  SCHEMA_MISMATCH = 'schema_mismatch',
}

/**
 * User-friendly messages for validation errors
 */
const VALIDATION_USER_MESSAGES: Record<ValidationErrorType, string> = {
  [ValidationErrorType.REQUIRED_FIELD]: 'A required field is missing.',
  [ValidationErrorType.INVALID_FORMAT]: 'The input format is invalid.',
  [ValidationErrorType.OUT_OF_RANGE]: 'The value is out of the allowed range.',
  [ValidationErrorType.INVALID_TYPE]: 'The input type is incorrect.',
  [ValidationErrorType.SCHEMA_MISMATCH]: 'The data does not match the expected format.',
};

/**
 * Validation-specific error class
 */
export class ValidationError extends Error {
  readonly type: ValidationErrorType;
  readonly field?: string;
  readonly expectedType?: string;
  readonly receivedValue?: unknown;

  constructor(
    message: string,
    type: ValidationErrorType,
    options?: {
      field?: string;
      expectedType?: string;
      receivedValue?: unknown;
    }
  ) {
    super(message);
    this.name = 'ValidationError';
    this.type = type;
    this.field = options?.field;
    this.expectedType = options?.expectedType;
    this.receivedValue = options?.receivedValue;
  }

  getUserFriendlyMessage(): string {
    if (this.field) {
      return `Invalid ${this.field}: ${VALIDATION_USER_MESSAGES[this.type]}`;
    }
    return VALIDATION_USER_MESSAGES[this.type] || 'Validation failed. Please check your input.';
  }

  static requiredField(field: string): ValidationError {
    return new ValidationError(
      `Required field missing: ${field}`,
      ValidationErrorType.REQUIRED_FIELD,
      { field }
    );
  }

  static invalidFormat(field: string, expectedFormat?: string): ValidationError {
    const message = expectedFormat
      ? `Invalid format for ${field}. Expected: ${expectedFormat}`
      : `Invalid format for ${field}`;
    return new ValidationError(message, ValidationErrorType.INVALID_FORMAT, {
      field,
      expectedType: expectedFormat,
    });
  }
}

/**
 * Type guard to check if error is an application error with getUserFriendlyMessage
 */
export function isAppError(
  error: unknown
): error is { getUserFriendlyMessage: () => string; type: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'getUserFriendlyMessage' in error &&
    typeof (error as Record<string, unknown>).getUserFriendlyMessage === 'function'
  );
}

/**
 * Get user-friendly error message from any error type
 * Unified function that handles all application error types
 */
export function toUserFriendlyMessage(error: unknown): string {
  // Check for application errors with getUserFriendlyMessage method
  if (isAppError(error)) {
    return error.getUserFriendlyMessage();
  }

  // Check for standard Error
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Network-related
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('enotfound')) {
      return 'Network connection issue. Please check your internet connection.';
    }

    // Timeout-related
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
      return 'Request took too long. Please try again.';
    }

    // Auth-related
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('403')) {
      return 'Authentication failed. Please check your credentials.';
    }

    // Rate limit
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    // Return original message if it's short and user-friendly
    if (error.message.length < 100 && !msg.includes('error:') && !msg.includes('exception')) {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Wrap an async function with standardized error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorTransformer?: (error: unknown) => Error
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorTransformer) {
      throw errorTransformer(error);
    }
    throw error;
  }
}

/**
 * Create an error handler that logs and transforms errors
 */
export function createErrorHandler(
  context: string,
  logger: { error: (msg: string, ...args: unknown[]) => void }
) {
  return function handleError<T extends Error>(error: unknown, ErrorClass?: new (...args: unknown[]) => T): never {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${context}] ${message}`, error);

    if (error instanceof Error && isAppError(error)) {
      throw error;
    }

    if (ErrorClass) {
      throw new ErrorClass(message, error);
    }

    throw error;
  };
}
