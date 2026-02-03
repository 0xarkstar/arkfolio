import { drizzle } from 'drizzle-orm/sql-js';
import type { Database } from 'sql.js';
import * as schema from './schema';
import { logger } from '../utils/logger';

// Type alias for sql.js Database
type SqlJsDatabase = Database;

// Database file name for OPFS persistence
const DB_NAME = 'arkfolio.db';

let db: SqlJsDatabase | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

// Check if OPFS is available
async function isOpfsAvailable(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    return !!root;
  } catch {
    return false;
  }
}

// Load database from OPFS
async function loadFromOpfs(): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(DB_NAME);
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

// Save database to OPFS
async function saveToOpfs(data: Uint8Array): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(DB_NAME, { create: true });
    const writable = await fileHandle.createWritable();
    // Create a new ArrayBuffer copy for proper typing
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    await writable.write(buffer);
    await writable.close();
  } catch (error) {
    logger.error('Failed to save database to OPFS:', error);
    throw error;
  }
}

// Initialize the database
export async function initDatabase(): Promise<void> {
  if (db && drizzleDb) {
    return; // Already initialized
  }

  // Initialize sql.js - use dynamic import for Vite compatibility
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  });

  // Try to load existing database from OPFS
  const opfsAvailable = await isOpfsAvailable();
  let existingData: Uint8Array | null = null;

  if (opfsAvailable) {
    existingData = await loadFromOpfs();
    logger.info('OPFS available, existing data:', existingData ? 'found' : 'not found');
  } else {
    logger.info('OPFS not available, using in-memory database');
  }

  // Create database instance
  db = existingData ? new SQL.Database(existingData) : new SQL.Database();

  // Initialize Drizzle ORM
  drizzleDb = drizzle(db, { schema });

  // Create tables if they don't exist
  await createTables();

  // Set up auto-save to OPFS
  if (opfsAvailable) {
    setupAutoSave();
  }

  logger.info('Database initialized successfully');
}

// Create all tables
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  const createTableStatements = `
    -- Exchanges & Accounts
    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('cex', 'dex', 'perp')),
      api_key_ref TEXT,
      api_secret_ref TEXT,
      passphrase_ref TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- Balances
    CREATE TABLE IF NOT EXISTS balances (
      id TEXT PRIMARY KEY,
      exchange_id TEXT REFERENCES exchanges(id) ON DELETE CASCADE,
      asset TEXT NOT NULL,
      balance_type TEXT CHECK(balance_type IN ('spot', 'futures', 'margin', 'earn', 'funding')),
      free REAL DEFAULT 0,
      locked REAL DEFAULT 0,
      updated_at INTEGER
    );

    -- Positions
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      exchange_id TEXT REFERENCES exchanges(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      side TEXT CHECK(side IN ('long', 'short')),
      size REAL DEFAULT 0,
      entry_price REAL,
      mark_price REAL,
      unrealized_pnl REAL,
      leverage REAL DEFAULT 1,
      liquidation_price REAL,
      margin_type TEXT CHECK(margin_type IN ('cross', 'isolated')),
      updated_at INTEGER
    );

    -- Transactions
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      exchange_id TEXT REFERENCES exchanges(id),
      wallet_address TEXT,
      tx_hash TEXT,
      type TEXT NOT NULL,
      asset TEXT NOT NULL,
      amount REAL NOT NULL,
      price_usd REAL,
      price_krw REAL,
      fee REAL,
      fee_asset TEXT,
      timestamp INTEGER NOT NULL,
      raw_data TEXT,
      created_at INTEGER
    );

    -- Wallets
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      label TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- On-chain Assets
    CREATE TABLE IF NOT EXISTS onchain_assets (
      id TEXT PRIMARY KEY,
      wallet_id TEXT REFERENCES wallets(id) ON DELETE CASCADE,
      contract_address TEXT,
      token_symbol TEXT,
      token_name TEXT,
      balance REAL DEFAULT 0,
      decimals INTEGER,
      is_nft INTEGER DEFAULT 0,
      token_id TEXT,
      updated_at INTEGER
    );

    -- DeFi Positions
    CREATE TABLE IF NOT EXISTS defi_positions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT REFERENCES wallets(id) ON DELETE CASCADE,
      protocol TEXT NOT NULL,
      position_type TEXT,
      pool_address TEXT,
      chain TEXT DEFAULT 'Ethereum',
      assets TEXT,
      amounts TEXT,
      cost_basis_usd REAL,
      current_value_usd REAL,
      rewards_earned TEXT,
      apy REAL,
      maturity_date INTEGER,
      health_factor REAL,
      entry_date INTEGER,
      updated_at INTEGER
    );

    -- Points
    CREATE TABLE IF NOT EXISTS points (
      id TEXT PRIMARY KEY,
      protocol TEXT NOT NULL,
      wallet_address TEXT,
      points_balance REAL DEFAULT 0,
      estimated_value_usd REAL,
      last_sync INTEGER
    );

    -- Price History
    CREATE TABLE IF NOT EXISTS price_history (
      asset TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      price_usd REAL,
      price_krw REAL,
      PRIMARY KEY (asset, timestamp)
    );

    -- Tax Reports
    CREATE TABLE IF NOT EXISTS tax_reports (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      total_gains_krw REAL,
      total_losses_krw REAL,
      net_gains_krw REAL,
      taxable_gains_krw REAL,
      estimated_tax_krw REAL,
      generated_at INTEGER,
      report_data TEXT
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    );

    -- Target Allocations for Rebalancing
    CREATE TABLE IF NOT EXISTS target_allocations (
      id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      target_percent REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- Portfolio Snapshots
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      total_value_usd REAL NOT NULL,
      cex_value_usd REAL DEFAULT 0,
      onchain_value_usd REAL DEFAULT 0,
      defi_value_usd REAL DEFAULT 0,
      breakdown TEXT,
      created_at INTEGER
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('price_alert', 'liquidation_warning', 'system', 'sync_error')) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      metadata TEXT,
      created_at INTEGER
    );

    -- Liquidation Alerts
    CREATE TABLE IF NOT EXISTS liquidation_alerts (
      id TEXT PRIMARY KEY,
      position_id TEXT REFERENCES positions(id) ON DELETE CASCADE,
      exchange_id TEXT REFERENCES exchanges(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      liquidation_price REAL NOT NULL,
      warning_threshold REAL DEFAULT 0.1,
      is_active INTEGER DEFAULT 1,
      last_alert_at INTEGER,
      created_at INTEGER
    );

    -- Price Alerts
    CREATE TABLE IF NOT EXISTS price_alerts (
      id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      target_price REAL NOT NULL,
      condition TEXT CHECK(condition IN ('above', 'below')) NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_triggered INTEGER DEFAULT 0,
      triggered_at INTEGER,
      note TEXT,
      created_at INTEGER
    );

    -- Watchlist
    CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      price_alert_type TEXT CHECK(price_alert_type IN ('above', 'below')),
      price_alert_target REAL,
      added_at INTEGER
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_balances_exchange ON balances(exchange_id);
    CREATE INDEX IF NOT EXISTS idx_positions_exchange ON positions(exchange_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_transactions_exchange ON transactions(exchange_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_onchain_assets_wallet ON onchain_assets(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_defi_positions_wallet ON defi_positions(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_asset ON price_history(asset);
    CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_price_alerts_asset ON price_alerts(asset);
  `;

  const statements = createTableStatements.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      db.run(statement);
    }
  }

  // Run migrations for existing databases
  await runMigrations();
}

// Run database migrations
async function runMigrations(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Migration: Add chain and entry_date columns to defi_positions
  try {
    // Check if chain column exists
    const tableInfo = db.exec("PRAGMA table_info(defi_positions)");
    const columns = tableInfo[0]?.values?.map(row => row[1]) || [];

    if (!columns.includes('chain')) {
      logger.info('Migration: Adding chain column to defi_positions');
      db.run("ALTER TABLE defi_positions ADD COLUMN chain TEXT DEFAULT 'Ethereum'");
    }

    if (!columns.includes('entry_date')) {
      logger.info('Migration: Adding entry_date column to defi_positions');
      db.run("ALTER TABLE defi_positions ADD COLUMN entry_date INTEGER");
    }
  } catch (error) {
    logger.error('Migration error:', error);
  }
}

// Auto-save to OPFS periodically
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function setupAutoSave(): void {
  const saveInterval = 5000; // Save every 5 seconds if there are changes

  const scheduleSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      await persistDatabase();
    }, saveInterval);
  };

  // Hook into database changes (simplified - in production use db change hooks)
  window.addEventListener('beforeunload', () => {
    if (db) {
      const data = db.export();
      // Synchronous save attempt before unload - create a copy as ArrayBuffer
      const buffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(buffer).set(data);
      navigator.sendBeacon?.('/api/save-db', new Blob([buffer]));
    }
  });

  // Initial schedule
  scheduleSave();
}

// Persist database to OPFS
export async function persistDatabase(): Promise<void> {
  if (!db) return;

  try {
    const data = db.export();
    await saveToOpfs(data);
    logger.info('Database persisted to OPFS');
  } catch (error) {
    logger.error('Failed to persist database:', error);
  }
}

// Get Drizzle database instance
export function getDb() {
  if (!drizzleDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return drizzleDb;
}

// Get raw sql.js database instance (for direct queries if needed)
export function getRawDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Close database and cleanup
export async function closeDatabase(): Promise<void> {
  if (db) {
    await persistDatabase();
    db.close();
    db = null;
    drizzleDb = null;
  }
}

// Generate UUID for primary keys
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Execute multiple database operations within a transaction
 * Ensures atomicity for multi-table operations
 *
 * @param callback - Function containing database operations to execute
 * @returns The result of the callback function
 * @throws Error if any operation fails (all changes are rolled back)
 *
 * @example
 * await withTransaction(async () => {
 *   await db.insert(exchanges).values(exchange);
 *   await db.insert(balances).values(balanceList);
 * });
 */
export async function withTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    db.run('BEGIN TRANSACTION');
    const result = await callback();
    db.run('COMMIT');
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    logger.error('Transaction failed, rolling back:', error);
    throw error;
  }
}

/**
 * Execute multiple database operations within a transaction (sync version)
 * For use with synchronous operations only
 *
 * @param callback - Function containing database operations to execute
 * @returns The result of the callback function
 */
export function withTransactionSync<T>(callback: () => T): T {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    db.run('BEGIN TRANSACTION');
    const result = callback();
    db.run('COMMIT');
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    logger.error('Transaction failed, rolling back:', error);
    throw error;
  }
}
