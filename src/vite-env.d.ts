/// <reference types="vite/client" />

export {};

// Electron API exposed via preload
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
