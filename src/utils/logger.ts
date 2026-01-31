/**
 * Environment-based logging utility
 *
 * Provides structured logging that respects environment settings:
 * - DEBUG mode: All logs including debug level
 * - Production: Only warnings and errors
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('Fetching data...', { walletAddress });
 *   logger.info('Data fetched successfully');
 *   logger.warn('Rate limit approaching');
 *   logger.error('Failed to fetch data', error);
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

type LogArgs = unknown[];

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;

  private constructor() {
    this.config = {
      level: this.getDefaultLevel(),
      enableTimestamp: false,
    };
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getDefaultLevel(): LogLevel {
    // Check for debug mode
    if (typeof window !== 'undefined') {
      // Browser environment
      try {
        const isDebug =
          (typeof localStorage !== 'undefined' && localStorage?.getItem?.('arkfolio_debug') === 'true') ||
          import.meta.env?.DEV === true ||
          import.meta.env?.MODE === 'development';
        return isDebug ? LogLevel.DEBUG : LogLevel.WARN;
      } catch {
        // localStorage not available (e.g., in some test environments)
        return import.meta.env?.DEV === true ? LogLevel.DEBUG : LogLevel.WARN;
      }
    }
    // Node environment (tests, etc.)
    return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable debug mode (sets level to DEBUG)
   */
  enableDebug(): void {
    this.config.level = LogLevel.DEBUG;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('arkfolio_debug', 'true');
      } catch {
        // localStorage not available
      }
    }
  }

  /**
   * Disable debug mode (sets level to WARN)
   */
  disableDebug(): void {
    this.config.level = LogLevel.WARN;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('arkfolio_debug');
      } catch {
        // localStorage not available
      }
    }
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.level <= LogLevel.DEBUG;
  }

  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    parts.push(`[${level}]`);
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Debug level - detailed information for debugging
   * Only shown in development/debug mode
   */
  debug(message: string, ...args: LogArgs): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  /**
   * Info level - general information
   * Only shown in development/debug mode
   */
  info(message: string, ...args: LogArgs): void {
    if (this.config.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  /**
   * Warn level - potential issues
   * Shown in all modes
   */
  warn(message: string, ...args: LogArgs): void {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  /**
   * Error level - errors and failures
   * Shown in all modes
   */
  error(message: string, ...args: LogArgs): void {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix);
  }

  /**
   * Group related logs together
   */
  group(label: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.group(label);
    }
  }

  /**
   * End a log group
   */
  groupEnd(): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * Log a table (debug level)
   */
  table(data: unknown): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.table(data);
    }
  }

  /**
   * Measure time for an operation
   */
  time(label: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.time(label);
    }
  }

  /**
   * End time measurement
   */
  timeEnd(label: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.timeEnd(label);
    }
  }
}

/**
 * Child logger with a prefix
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private prefix: string
  ) {}

  debug(message: string, ...args: LogArgs): void {
    this.parent.debug(`[${this.prefix}] ${message}`, ...args);
  }

  info(message: string, ...args: LogArgs): void {
    this.parent.info(`[${this.prefix}] ${message}`, ...args);
  }

  warn(message: string, ...args: LogArgs): void {
    this.parent.warn(`[${this.prefix}] ${message}`, ...args);
  }

  error(message: string, ...args: LogArgs): void {
    this.parent.error(`[${this.prefix}] ${message}`, ...args);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export class for testing
export { Logger, ChildLogger };
