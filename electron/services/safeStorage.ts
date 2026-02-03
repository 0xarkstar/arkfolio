import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
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

  private async loadIndex(): Promise<StorageIndex> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { keys: [] };
      }

      if (existsSync(this.indexPath)) {
        const encrypted = await readFile(this.indexPath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      }
    } catch {
      // Index corrupted, reset
    }
    return { keys: [] };
  }

  private async saveIndex(index: StorageIndex): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }

    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(index));
      await writeFile(this.indexPath, encrypted);
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
      await writeFile(keyPath, encrypted);

      const index = await this.loadIndex();
      if (!index.keys.includes(key)) {
        index.keys.push(key);
        await this.saveIndex(index);
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

      const encrypted = await readFile(keyPath);
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
        await unlink(keyPath);
      }

      if (safeStorage.isEncryptionAvailable()) {
        const index = await this.loadIndex();
        index.keys = index.keys.filter(k => k !== key);
        await this.saveIndex(index);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete secret:', error);
      return false;
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      const index = await this.loadIndex();
      return index.keys;
    } catch (error) {
      console.error('Failed to list keys:', error);
      return [];
    }
  }
}
