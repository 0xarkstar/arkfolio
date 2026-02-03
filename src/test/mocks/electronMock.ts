/**
 * Electron API Mock for testing
 *
 * Provides mock implementations of Electron IPC and secure storage APIs
 * that are used throughout the application.
 */
import { vi } from 'vitest';

// In-memory storage for secure credentials
const secureStorage = new Map<string, string>();

// Mock net response
interface MockNetResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
}

// Default mock net response
let mockNetResponse: MockNetResponse = {
  status: 200,
  statusText: 'OK',
  data: {},
  headers: {},
};

/**
 * Mock Electron API object that matches the window.electronAPI interface
 */
export const mockElectronAPI = {
  // Secure storage API
  secureStorage: {
    store: vi.fn(async (key: string, value: string): Promise<void> => {
      secureStorage.set(key, value);
    }),
    retrieve: vi.fn(async (key: string): Promise<string | null> => {
      return secureStorage.get(key) || null;
    }),
    delete: vi.fn(async (key: string): Promise<void> => {
      secureStorage.delete(key);
    }),
    has: vi.fn(async (key: string): Promise<boolean> => {
      return secureStorage.has(key);
    }),
  },

  // Net API for HTTP requests (bypasses CORS in Electron)
  net: {
    request: vi.fn(async (_options: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }): Promise<MockNetResponse> => {
      return mockNetResponse;
    }),
  },

  // App info
  app: {
    getVersion: vi.fn(() => '1.0.0-test'),
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    isPackaged: vi.fn(() => false),
  },

  // Shell API
  shell: {
    openExternal: vi.fn(async (_url: string): Promise<void> => {}),
    showItemInFolder: vi.fn((_path: string): void => {}),
  },

  // Clipboard API
  clipboard: {
    writeText: vi.fn((_text: string): void => {}),
    readText: vi.fn((): string => ''),
  },
};

/**
 * Install the mock Electron API on the window object
 */
export function installElectronMock(): void {
  Object.defineProperty(window, 'electronAPI', {
    writable: true,
    value: mockElectronAPI,
  });
}

/**
 * Uninstall the mock Electron API
 */
export function uninstallElectronMock(): void {
  Object.defineProperty(window, 'electronAPI', {
    writable: true,
    value: undefined,
  });
}

/**
 * Reset all Electron mock function calls and clear storage
 */
export function resetElectronMock(): void {
  secureStorage.clear();
  vi.clearAllMocks();
  mockNetResponse = {
    status: 200,
    statusText: 'OK',
    data: {},
    headers: {},
  };
}

/**
 * Set the mock net response for testing
 */
export function setMockNetResponse(response: Partial<MockNetResponse>): void {
  mockNetResponse = {
    ...mockNetResponse,
    ...response,
  };
}

/**
 * Get the current state of secure storage (for test assertions)
 */
export function getSecureStorageState(): Map<string, string> {
  return new Map(secureStorage);
}

/**
 * Pre-populate secure storage with test data
 */
export function seedSecureStorage(data: Record<string, string>): void {
  Object.entries(data).forEach(([key, value]) => {
    secureStorage.set(key, value);
  });
}
