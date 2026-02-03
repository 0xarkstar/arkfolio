import { describe, it, expect } from 'vitest';
import {
  DatabaseError,
  DatabaseErrorType,
  ExchangeError,
  ExchangeErrorType,
  ValidationError,
  ValidationErrorType,
  isAppError,
  toUserFriendlyMessage,
} from '../index';

describe('DatabaseError', () => {
  describe('constructor', () => {
    it('creates error with type and message', () => {
      const error = new DatabaseError('Test error', DatabaseErrorType.QUERY_FAILED);

      expect(error.message).toBe('Test error');
      expect(error.type).toBe(DatabaseErrorType.QUERY_FAILED);
      expect(error.name).toBe('DatabaseError');
    });

    it('creates error with options', () => {
      const originalError = new Error('Original');
      const error = new DatabaseError('Test error', DatabaseErrorType.QUERY_FAILED, {
        table: 'users',
        operation: 'SELECT',
        originalError,
      });

      expect(error.table).toBe('users');
      expect(error.operation).toBe('SELECT');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns user-friendly message for NOT_INITIALIZED', () => {
      const error = new DatabaseError('DB error', DatabaseErrorType.NOT_INITIALIZED);
      expect(error.getUserFriendlyMessage()).toBe(
        'Database is not ready. Please restart the application.'
      );
    });

    it('returns user-friendly message for RECORD_NOT_FOUND', () => {
      const error = new DatabaseError('DB error', DatabaseErrorType.RECORD_NOT_FOUND);
      expect(error.getUserFriendlyMessage()).toBe('The requested record was not found.');
    });

    it('returns user-friendly message for DUPLICATE_RECORD', () => {
      const error = new DatabaseError('DB error', DatabaseErrorType.DUPLICATE_RECORD);
      expect(error.getUserFriendlyMessage()).toBe(
        'A record with this information already exists.'
      );
    });
  });

  describe('fromError', () => {
    it('creates from generic Error', () => {
      const original = new Error('Database not initialized');
      const error = DatabaseError.fromError(original);

      expect(error.type).toBe(DatabaseErrorType.NOT_INITIALIZED);
      expect(error.originalError).toBe(original);
    });

    it('detects connection failed from message', () => {
      const error = DatabaseError.fromError(new Error('Connection refused'));
      expect(error.type).toBe(DatabaseErrorType.CONNECTION_FAILED);
    });

    it('detects not found from message', () => {
      const error = DatabaseError.fromError(new Error('Record not found'));
      expect(error.type).toBe(DatabaseErrorType.RECORD_NOT_FOUND);
    });

    it('detects duplicate from message', () => {
      const error = DatabaseError.fromError(new Error('Duplicate entry'));
      expect(error.type).toBe(DatabaseErrorType.DUPLICATE_RECORD);
    });

    it('detects constraint from message', () => {
      const error = DatabaseError.fromError(new Error('Foreign key constraint failed'));
      expect(error.type).toBe(DatabaseErrorType.CONSTRAINT_VIOLATION);
    });

    it('detects transaction from message', () => {
      const error = DatabaseError.fromError(new Error('Transaction rollback'));
      expect(error.type).toBe(DatabaseErrorType.TRANSACTION_FAILED);
    });

    it('detects persistence from message', () => {
      const error = DatabaseError.fromError(new Error('OPFS persist failed'));
      expect(error.type).toBe(DatabaseErrorType.PERSISTENCE_FAILED);
    });

    it('preserves options', () => {
      const error = DatabaseError.fromError(new Error('Query failed'), DatabaseErrorType.QUERY_FAILED, {
        table: 'users',
        operation: 'INSERT',
      });

      expect(error.table).toBe('users');
      expect(error.operation).toBe('INSERT');
    });
  });

  describe('static factory methods', () => {
    it('notInitialized creates correct error', () => {
      const error = DatabaseError.notInitialized();

      expect(error.type).toBe(DatabaseErrorType.NOT_INITIALIZED);
      expect(error.message).toContain('not initialized');
    });

    it('recordNotFound creates error with id', () => {
      const error = DatabaseError.recordNotFound('users', '123');

      expect(error.type).toBe(DatabaseErrorType.RECORD_NOT_FOUND);
      expect(error.table).toBe('users');
      expect(error.message).toContain('123');
    });

    it('recordNotFound creates error without id', () => {
      const error = DatabaseError.recordNotFound('users');

      expect(error.type).toBe(DatabaseErrorType.RECORD_NOT_FOUND);
      expect(error.message).not.toContain('undefined');
    });
  });
});

describe('ExchangeError', () => {
  describe('constructor', () => {
    it('creates error with type and message', () => {
      const error = new ExchangeError('Test error', ExchangeErrorType.API_ERROR);

      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ExchangeErrorType.API_ERROR);
      expect(error.name).toBe('ExchangeError');
    });

    it('creates error with options', () => {
      const error = new ExchangeError('Test error', ExchangeErrorType.API_ERROR, {
        exchangeId: 'binance',
        accountId: 'acc-123',
      });

      expect(error.exchangeId).toBe('binance');
      expect(error.accountId).toBe('acc-123');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns user-friendly message for NOT_SUPPORTED', () => {
      const error = new ExchangeError('Error', ExchangeErrorType.NOT_SUPPORTED);
      expect(error.getUserFriendlyMessage()).toBe('This exchange is not supported.');
    });

    it('returns user-friendly message for INVALID_CREDENTIALS', () => {
      const error = new ExchangeError('Error', ExchangeErrorType.INVALID_CREDENTIALS);
      expect(error.getUserFriendlyMessage()).toBe(
        'Invalid API credentials. Please check your API key and secret.'
      );
    });

    it('returns user-friendly message for RATE_LIMIT', () => {
      const error = new ExchangeError('Error', ExchangeErrorType.RATE_LIMIT);
      expect(error.getUserFriendlyMessage()).toBe(
        'Too many requests to exchange. Please wait and try again.'
      );
    });
  });

  describe('fromError', () => {
    it('creates from generic Error', () => {
      const original = new Error('Unsupported exchange');
      const error = ExchangeError.fromError(original);

      expect(error.type).toBe(ExchangeErrorType.NOT_SUPPORTED);
      expect(error.originalError).toBe(original);
    });

    it('detects not connected from message', () => {
      const error = ExchangeError.fromError(new Error('Exchange not connected'));
      expect(error.type).toBe(ExchangeErrorType.NOT_CONNECTED);
    });

    it('detects account not found from message', () => {
      const error = ExchangeError.fromError(new Error('Account not found'));
      expect(error.type).toBe(ExchangeErrorType.ACCOUNT_NOT_FOUND);
    });

    it('detects invalid credentials from message', () => {
      const error = ExchangeError.fromError(new Error('Invalid API key'));
      expect(error.type).toBe(ExchangeErrorType.INVALID_CREDENTIALS);
    });

    it('detects rate limit from message', () => {
      const error = ExchangeError.fromError(new Error('Rate limit exceeded'));
      expect(error.type).toBe(ExchangeErrorType.RATE_LIMIT);
    });

    it('detects balance fetch failed from message', () => {
      const error = ExchangeError.fromError(new Error('Failed to fetch balance'));
      expect(error.type).toBe(ExchangeErrorType.BALANCE_FETCH_FAILED);
    });

    it('detects position fetch failed from message', () => {
      const error = ExchangeError.fromError(new Error('Error fetching positions'));
      expect(error.type).toBe(ExchangeErrorType.POSITION_FETCH_FAILED);
    });

    it('detects transaction fetch failed from message', () => {
      const error = ExchangeError.fromError(new Error('Failed to get trade history'));
      expect(error.type).toBe(ExchangeErrorType.TRANSACTION_FETCH_FAILED);
    });
  });

  describe('static factory methods', () => {
    it('notSupported creates correct error', () => {
      const error = ExchangeError.notSupported('kraken');

      expect(error.type).toBe(ExchangeErrorType.NOT_SUPPORTED);
      expect(error.exchangeId).toBe('kraken');
      expect(error.message).toContain('kraken');
    });

    it('notConnected creates correct error', () => {
      const error = ExchangeError.notConnected('binance');

      expect(error.type).toBe(ExchangeErrorType.NOT_CONNECTED);
      expect(error.exchangeId).toBe('binance');
    });

    it('accountNotFound creates correct error', () => {
      const error = ExchangeError.accountNotFound('acc-123');

      expect(error.type).toBe(ExchangeErrorType.ACCOUNT_NOT_FOUND);
      expect(error.accountId).toBe('acc-123');
      expect(error.message).toContain('acc-123');
    });
  });
});

describe('ValidationError', () => {
  describe('constructor', () => {
    it('creates error with type and message', () => {
      const error = new ValidationError('Test error', ValidationErrorType.REQUIRED_FIELD);

      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ValidationErrorType.REQUIRED_FIELD);
      expect(error.name).toBe('ValidationError');
    });

    it('creates error with options', () => {
      const error = new ValidationError('Test error', ValidationErrorType.INVALID_TYPE, {
        field: 'email',
        expectedType: 'string',
        receivedValue: 123,
      });

      expect(error.field).toBe('email');
      expect(error.expectedType).toBe('string');
      expect(error.receivedValue).toBe(123);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns message with field name', () => {
      const error = new ValidationError('Error', ValidationErrorType.REQUIRED_FIELD, {
        field: 'email',
      });
      expect(error.getUserFriendlyMessage()).toBe('Invalid email: A required field is missing.');
    });

    it('returns message without field name', () => {
      const error = new ValidationError('Error', ValidationErrorType.REQUIRED_FIELD);
      expect(error.getUserFriendlyMessage()).toBe('A required field is missing.');
    });
  });

  describe('static factory methods', () => {
    it('requiredField creates correct error', () => {
      const error = ValidationError.requiredField('username');

      expect(error.type).toBe(ValidationErrorType.REQUIRED_FIELD);
      expect(error.field).toBe('username');
      expect(error.message).toContain('username');
    });

    it('invalidFormat creates error with expected format', () => {
      const error = ValidationError.invalidFormat('email', 'user@example.com');

      expect(error.type).toBe(ValidationErrorType.INVALID_FORMAT);
      expect(error.field).toBe('email');
      expect(error.expectedType).toBe('user@example.com');
    });

    it('invalidFormat creates error without expected format', () => {
      const error = ValidationError.invalidFormat('email');

      expect(error.type).toBe(ValidationErrorType.INVALID_FORMAT);
      expect(error.field).toBe('email');
    });
  });
});

describe('isAppError', () => {
  it('returns true for DatabaseError', () => {
    const error = new DatabaseError('Test', DatabaseErrorType.QUERY_FAILED);
    expect(isAppError(error)).toBe(true);
  });

  it('returns true for ExchangeError', () => {
    const error = new ExchangeError('Test', ExchangeErrorType.API_ERROR);
    expect(isAppError(error)).toBe(true);
  });

  it('returns true for ValidationError', () => {
    const error = new ValidationError('Test', ValidationErrorType.REQUIRED_FIELD);
    expect(isAppError(error)).toBe(true);
  });

  it('returns false for standard Error', () => {
    const error = new Error('Test');
    expect(isAppError(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isAppError({ message: 'test' })).toBe(false);
  });
});

describe('toUserFriendlyMessage', () => {
  it('returns user-friendly message for DatabaseError', () => {
    const error = new DatabaseError('DB error', DatabaseErrorType.NOT_INITIALIZED);
    expect(toUserFriendlyMessage(error)).toBe(
      'Database is not ready. Please restart the application.'
    );
  });

  it('returns user-friendly message for ExchangeError', () => {
    const error = new ExchangeError('API error', ExchangeErrorType.INVALID_CREDENTIALS);
    expect(toUserFriendlyMessage(error)).toBe(
      'Invalid API credentials. Please check your API key and secret.'
    );
  });

  it('returns user-friendly message for ValidationError', () => {
    const error = new ValidationError('Error', ValidationErrorType.REQUIRED_FIELD, {
      field: 'email',
    });
    expect(toUserFriendlyMessage(error)).toBe('Invalid email: A required field is missing.');
  });

  it('returns network message for network errors', () => {
    const error = new Error('Network request failed');
    expect(toUserFriendlyMessage(error)).toBe(
      'Network connection issue. Please check your internet connection.'
    );
  });

  it('returns timeout message for timeout errors', () => {
    const error = new Error('Request timed out');
    expect(toUserFriendlyMessage(error)).toBe('Request took too long. Please try again.');
  });

  it('returns auth message for auth errors', () => {
    const error = new Error('Unauthorized request 401');
    expect(toUserFriendlyMessage(error)).toBe('Authentication failed. Please check your credentials.');
  });

  it('returns rate limit message for rate limit errors', () => {
    const error = new Error('429 Too Many Requests');
    expect(toUserFriendlyMessage(error)).toBe(
      'Too many requests. Please wait a moment and try again.'
    );
  });

  it('returns original message for short user-friendly messages', () => {
    const error = new Error('File not found');
    expect(toUserFriendlyMessage(error)).toBe('File not found');
  });

  it('returns generic message for unknown errors', () => {
    const error = new Error('Error: some long technical exception error: stack trace follows...');
    expect(toUserFriendlyMessage(error)).toBe('An unexpected error occurred. Please try again.');
  });

  it('returns generic message for non-Error values', () => {
    expect(toUserFriendlyMessage('string error')).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(toUserFriendlyMessage(null)).toBe('An unexpected error occurred. Please try again.');
    expect(toUserFriendlyMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
  });
});
