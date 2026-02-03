/**
 * Database Mock for testing
 *
 * Provides mock implementations of the SQLite/Drizzle database
 * operations used throughout the application.
 */
import { vi } from 'vitest';

// In-memory storage for each table
const tables: Record<string, unknown[]> = {
  exchanges: [],
  balances: [],
  positions: [],
  transactions: [],
  wallets: [],
  defi_positions: [],
  nfts: [],
  alerts: [],
  settings: [],
  snapshots: [],
};

// Mock query builder
interface MockQueryBuilder {
  select: () => MockQueryBuilder;
  from: (table: unknown) => MockQueryBuilder;
  where: (condition: unknown) => MockQueryBuilder;
  orderBy: (column: unknown) => MockQueryBuilder;
  limit: (n: number) => MockQueryBuilder;
  offset: (n: number) => MockQueryBuilder;
  innerJoin: (table: unknown, condition: unknown) => MockQueryBuilder;
  leftJoin: (table: unknown, condition: unknown) => MockQueryBuilder;
  insert: (table: unknown) => MockQueryBuilder;
  values: (data: unknown) => MockQueryBuilder;
  update: (table: unknown) => MockQueryBuilder;
  set: (data: unknown) => MockQueryBuilder;
  delete: (table: unknown) => MockQueryBuilder;
  returning: () => MockQueryBuilder;
  execute: () => Promise<unknown[]>;
  then: (resolve: (value: unknown[]) => void) => Promise<unknown[]>;
}

function createMockQueryBuilder(): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: () => builder,
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    innerJoin: () => builder,
    leftJoin: () => builder,
    insert: () => builder,
    values: () => builder,
    update: () => builder,
    set: () => builder,
    delete: () => builder,
    returning: () => builder,
    execute: async () => [],
    then: async (resolve) => {
      const result: unknown[] = [];
      resolve(result);
      return result;
    },
  };
  return builder;
}

/**
 * Mock Drizzle database object
 */
export const mockDb = {
  select: vi.fn(() => createMockQueryBuilder()),
  insert: vi.fn(() => createMockQueryBuilder()),
  update: vi.fn(() => createMockQueryBuilder()),
  delete: vi.fn(() => createMockQueryBuilder()),
  query: {},
  transaction: vi.fn(async (callback: (tx: typeof mockDb) => Promise<unknown>) => {
    return callback(mockDb);
  }),
};

/**
 * Mock getDb function that returns the mock database
 */
export const mockGetDb = vi.fn(() => mockDb);

/**
 * Mock generateId function for creating unique IDs
 */
export const mockGenerateId = vi.fn(() => `test-id-${Math.random().toString(36).substring(7)}`);

/**
 * Mock initDatabase function
 */
export const mockInitDatabase = vi.fn(async (): Promise<void> => {});

/**
 * Install database mocks by mocking the database module
 */
export function setupDatabaseMock(): void {
  vi.mock('../../database/init', () => ({
    getDb: mockGetDb,
    generateId: mockGenerateId,
    initDatabase: mockInitDatabase,
  }));
}

/**
 * Reset all database mock states
 */
export function resetDatabaseMock(): void {
  // Clear all tables
  Object.keys(tables).forEach((key) => {
    tables[key] = [];
  });

  // Reset all mocks
  vi.clearAllMocks();
}

/**
 * Get the mock data for a specific table
 */
export function getTableData(tableName: string): unknown[] {
  return tables[tableName] || [];
}

/**
 * Seed a table with test data
 */
export function seedTable(tableName: string, data: unknown[]): void {
  tables[tableName] = [...data];
}

/**
 * Create a mock query result based on operation type
 */
export function createMockQueryResult(
  operation: 'select' | 'insert' | 'update' | 'delete',
  data: unknown[]
): void {
  const builder = createMockQueryBuilder();

  switch (operation) {
    case 'select':
      builder.execute = vi.fn(async () => data);
      mockDb.select.mockReturnValue(builder);
      break;
    case 'insert':
      builder.execute = vi.fn(async () => data);
      mockDb.insert.mockReturnValue(builder);
      break;
    case 'update':
      builder.execute = vi.fn(async () => data);
      mockDb.update.mockReturnValue(builder);
      break;
    case 'delete':
      builder.execute = vi.fn(async () => data);
      mockDb.delete.mockReturnValue(builder);
      break;
  }
}

/**
 * Mock schema tables for type-safe queries
 */
export const mockSchema = {
  exchanges: { id: 'id', name: 'name', type: 'type' },
  balances: { id: 'id', exchangeId: 'exchangeId', asset: 'asset' },
  positions: { id: 'id', exchangeId: 'exchangeId', symbol: 'symbol' },
  transactions: { id: 'id', exchangeId: 'exchangeId', type: 'type' },
  wallets: { id: 'id', address: 'address', chain: 'chain' },
  defiPositions: { id: 'id', walletId: 'walletId', protocol: 'protocol' },
  nfts: { id: 'id', walletId: 'walletId', contractAddress: 'contractAddress' },
  alerts: { id: 'id', asset: 'asset', type: 'type' },
  settings: { key: 'key', value: 'value' },
  snapshots: { id: 'id', timestamp: 'timestamp', totalValueUsd: 'totalValueUsd' },
};
