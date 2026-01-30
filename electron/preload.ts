import { contextBridge, ipcRenderer } from 'electron';

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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
