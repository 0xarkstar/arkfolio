import { create } from 'zustand';
import { getDb } from '../database/init';
import { settings } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface AppSettings {
  // General
  currency: 'USD' | 'KRW' | 'EUR' | 'BTC';
  language: 'en' | 'ko';
  theme: 'dark' | 'light' | 'system';

  // Sync
  autoSync: boolean;
  syncInterval: number; // minutes

  // Notifications
  notifications: boolean;

  // Tax (Korea)
  taxMethod: 'moving_average' | 'fifo' | 'lifo';
  taxDeduction: number; // KRW
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  language: 'en',
  theme: 'dark',
  autoSync: true,
  syncInterval: 5,
  notifications: true,
  taxMethod: 'moving_average',
  taxDeduction: 2500000,
};

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  isSaving: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });

    try {
      const db = getDb();
      const rows = await db.select().from(settings);

      const loadedSettings: Partial<AppSettings> = {};

      for (const row of rows) {
        if (row.key && row.value !== null) {
          try {
            // Parse JSON values
            const parsed = JSON.parse(row.value);
            (loadedSettings as Record<string, unknown>)[row.key] = parsed;
          } catch {
            // Use raw string value if not JSON
            (loadedSettings as Record<string, unknown>)[row.key] = row.value;
          }
        }
      }

      set({
        settings: { ...DEFAULT_SETTINGS, ...loadedSettings },
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load settings',
        isLoading: false,
      });
    }
  },

  updateSetting: async (key, value) => {
    const { settings: currentSettings } = get();
    set({ isSaving: true, error: null });

    try {
      const db = getDb();
      const stringValue = JSON.stringify(value);

      // Upsert the setting
      await db
        .insert(settings)
        .values({
          key,
          value: stringValue,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: stringValue,
            updatedAt: new Date(),
          },
        });

      set({
        settings: { ...currentSettings, [key]: value },
        isSaving: false,
      });
    } catch (error) {
      console.error('Failed to save setting:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save setting',
        isSaving: false,
      });
    }
  },

  updateSettings: async (updates) => {
    const { settings: currentSettings } = get();
    set({ isSaving: true, error: null });

    try {
      const db = getDb();

      // Save all updates
      for (const [key, value] of Object.entries(updates)) {
        const stringValue = JSON.stringify(value);

        await db
          .insert(settings)
          .values({
            key,
            value: stringValue,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: stringValue,
              updatedAt: new Date(),
            },
          });
      }

      set({
        settings: { ...currentSettings, ...updates },
        isSaving: false,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save settings',
        isSaving: false,
      });
    }
  },

  resetSettings: async () => {
    set({ isSaving: true, error: null });

    try {
      const db = getDb();

      // Delete all settings
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        await db.delete(settings).where(eq(settings.key, key));
      }

      set({
        settings: DEFAULT_SETTINGS,
        isSaving: false,
      });
    } catch (error) {
      console.error('Failed to reset settings:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to reset settings',
        isSaving: false,
      });
    }
  },
}));
