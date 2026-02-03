import { eq } from 'drizzle-orm';
import {
  settings,
  type Setting,
  type NewSetting,
} from '../schema';
import { BaseRepository } from './BaseRepository';
import { logger } from '../../utils/logger';

/**
 * Repository for settings with upsert pattern
 */
class SettingsRepositoryClass extends BaseRepository<typeof settings, Setting, NewSetting> {
  protected readonly table = settings;
  protected readonly tableName = 'Settings';

  /**
   * Get a setting value by key
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (results.length === 0) {
        return defaultValue;
      }

      const value = results[0].value;
      if (value === null || value === undefined) {
        return defaultValue;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        // If not valid JSON, return as string
        return value as unknown as T;
      }
    } catch (error) {
      logger.error(`[SettingsRepository] Failed to get setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set a setting value (upsert)
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = this.getDb();
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      await db
        .insert(settings)
        .values({
          key,
          value: serializedValue,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: serializedValue,
            updatedAt: new Date(),
          },
        });
      logger.debug(`[SettingsRepository] Set setting ${key}`);
    } catch (error) {
      logger.error(`[SettingsRepository] Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a setting by key
   */
  async deleteByKey(key: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.delete(settings).where(eq(settings.key, key));
      logger.debug(`[SettingsRepository] Deleted setting ${key}`);
    } catch (error) {
      logger.error(`[SettingsRepository] Failed to delete setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a setting exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const db = this.getDb();
      const results = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);
      return results.length > 0;
    } catch (error) {
      logger.error(`[SettingsRepository] Failed to check setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all settings as a map
   */
  async getAllAsMap(): Promise<Map<string, unknown>> {
    try {
      const db = this.getDb();
      const results = await db.select().from(settings);
      const map = new Map<string, unknown>();

      for (const setting of results) {
        try {
          map.set(setting.key, setting.value ? JSON.parse(setting.value) : null);
        } catch {
          map.set(setting.key, setting.value);
        }
      }

      return map;
    } catch (error) {
      logger.error('[SettingsRepository] Failed to get all settings:', error);
      throw error;
    }
  }

  /**
   * Set multiple settings at once
   */
  async setMany(settingsMap: Record<string, unknown>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(settingsMap)) {
        await this.set(key, value);
      }
    } catch (error) {
      logger.error('[SettingsRepository] Failed to set many settings:', error);
      throw error;
    }
  }

  /**
   * Get settings by prefix
   */
  async getByPrefix(prefix: string): Promise<Map<string, unknown>> {
    try {
      const allSettings = await this.getAllAsMap();
      const filteredMap = new Map<string, unknown>();

      for (const [key, value] of allSettings) {
        if (key.startsWith(prefix)) {
          filteredMap.set(key, value);
        }
      }

      return filteredMap;
    } catch (error) {
      logger.error(`[SettingsRepository] Failed to get settings by prefix ${prefix}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const SettingsRepository = new SettingsRepositoryClass();
