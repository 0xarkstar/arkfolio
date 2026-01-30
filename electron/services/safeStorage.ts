import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

interface StorageIndex {
  keys: string[];
}

export class SafeStorageService {
  private storagePath: string;
  private indexPath: string;
  private initialized: boolean = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = join(userDataPath, 'secure-storage');
    this.indexPath = join(this.storagePath, '.index');

    this.init();
  }

  private init(): void {
    try {
      if (!existsSync(this.storagePath)) {
        mkdirSync(this.storagePath, { recursive: true });
      }

      // Only initialize index if encryption is available
      if (safeStorage.isEncryptionAvailable()) {
        if (!existsSync(this.indexPath)) {
          this.saveIndex({ keys: [] });
        }
        this.initialized = true;
      } else {
        console.warn('Safe storage encryption is not available. Secure storage will not work.');
      }
    } catch (error) {
      console.error('Failed to initialize SafeStorageService:', error);
    }
  }

  private getKeyPath(key: string): string {
    const safeKey = Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
    return join(this.storagePath, safeKey);
  }

  private loadIndex(): StorageIndex {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { keys: [] };
      }

      if (existsSync(this.indexPath)) {
        const encrypted = readFileSync(this.indexPath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      }
    } catch {
      // Index corrupted, reset
    }
    return { keys: [] };
  }

  private saveIndex(index: StorageIndex): void {
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }

    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(index));
      writeFileSync(this.indexPath, encrypted);
    } catch (error) {
      console.error('Failed to save index:', error);
    }
  }

  async store(key: string, value: string): Promise<boolean> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('Safe storage encryption is not available');
        return false;
      }

      const encrypted = safeStorage.encryptString(value);
      const keyPath = this.getKeyPath(key);
      writeFileSync(keyPath, encrypted);

      const index = this.loadIndex();
      if (!index.keys.includes(key)) {
        index.keys.push(key);
        this.saveIndex(index);
      }

      return true;
    } catch (error) {
      console.error('Failed to store secret:', error);
      return false;
    }
  }

  async retrieve(key: string): Promise<string | null> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('Safe storage encryption is not available');
        return null;
      }

      const keyPath = this.getKeyPath(key);
      if (!existsSync(keyPath)) {
        return null;
      }

      const encrypted = readFileSync(keyPath);
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const keyPath = this.getKeyPath(key);
      if (existsSync(keyPath)) {
        unlinkSync(keyPath);
      }

      if (safeStorage.isEncryptionAvailable()) {
        const index = this.loadIndex();
        index.keys = index.keys.filter(k => k !== key);
        this.saveIndex(index);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete secret:', error);
      return false;
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      const index = this.loadIndex();
      return index.keys;
    } catch (error) {
      console.error('Failed to list keys:', error);
      return [];
    }
  }
}
