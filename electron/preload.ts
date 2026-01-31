import { contextBridge, ipcRenderer } from 'electron';

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
}

export interface ElectronAPI {
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
  // Network API for making HTTP requests from main process (bypasses CORS)
  net: {
    request: (options: HttpRequestOptions) => Promise<HttpResponse>;
  };
}

const electronAPI: ElectronAPI = {
  safeStorage: {
    isAvailable: () => ipcRenderer.invoke('safeStorage:isAvailable'),
    encrypt: (key: string, value: string) => ipcRenderer.invoke('safeStorage:encrypt', key, value),
    decrypt: (key: string) => ipcRenderer.invoke('safeStorage:decrypt', key),
    delete: (key: string) => ipcRenderer.invoke('safeStorage:delete', key),
    list: () => ipcRenderer.invoke('safeStorage:list'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },
  net: {
    request: (options: HttpRequestOptions) => ipcRenderer.invoke('net:request', options),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
