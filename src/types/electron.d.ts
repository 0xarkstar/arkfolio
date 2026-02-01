/**
 * Type declarations for Electron's preload API exposed on window
 */

interface ElectronNetRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface ElectronNetResponse<T = unknown> {
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
}

interface ElectronSafeStorage {
  encrypt: (data: string) => Promise<string>;
  decrypt: (data: string) => Promise<string>;
  isEncryptionAvailable: () => Promise<boolean>;
}

interface ElectronNet {
  request: <T = unknown>(options: ElectronNetRequest) => Promise<ElectronNetResponse<T>>;
}

interface ElectronAPI {
  safeStorage?: ElectronSafeStorage;
  net?: ElectronNet;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
