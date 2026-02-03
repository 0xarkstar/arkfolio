/**
 * Test Mocks Index
 *
 * Re-exports all test mocks for convenient importing.
 */

// Electron API Mock
export {
  mockElectronAPI,
  installElectronMock,
  uninstallElectronMock,
  resetElectronMock,
  setMockNetResponse,
  getSecureStorageState,
  seedSecureStorage,
} from './electronMock';

// Database Mock
export {
  mockDb,
  mockGetDb,
  mockGenerateId,
  mockInitDatabase,
  setupDatabaseMock,
  resetDatabaseMock,
  getTableData,
  seedTable,
  createMockQueryResult,
  mockSchema,
} from './databaseMock';

// Exchange Mock
export {
  mockExchangeAdapter,
  mockExchangeManager,
  resetExchangeMock,
  setMockBalances,
  setMockPositions,
  setMockEarnPositions,
  setMockTrades,
  setMockDeposits,
  setMockWithdrawals,
  setMockFundingRates,
  setMockConnectionState,
  createDefaultTestBalances,
  createDefaultTestPositions,
  createDefaultTestEarnPositions,
  setupExchangeMockWithDefaults,
} from './exchangeMock';
