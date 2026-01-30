import { create } from 'zustand';

interface AppState {
  isDbReady: boolean;
  currentView: string;
  lastSyncTime: number | null;

  // Actions
  setDbReady: (ready: boolean) => void;
  setCurrentView: (view: string) => void;
  setLastSyncTime: (time: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isDbReady: false,
  currentView: 'dashboard',
  lastSyncTime: null,

  setDbReady: (ready) => set({ isDbReady: ready }),
  setCurrentView: (view) => set({ currentView: view }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
}));
