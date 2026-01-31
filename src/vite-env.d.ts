/// <reference types="vite/client" />

export {};

// Electron API exposed via preload
interface ElectronNetRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface ElectronNetResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

interface ElectronAPI {
  safeStorage: {
    isAvailable: () => Promise<boolean>;
    encrypt: (key: string, value: string) => Promise<boolean>;
    decrypt: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<boolean>;
    list: () => Promise<string[]>;
  };
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<NodeJS.Platform>;
    getPath: (name: string) => Promise<string>;
  };
  net?: {
    request: (options: ElectronNetRequestOptions) => Promise<ElectronNetResponse>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
