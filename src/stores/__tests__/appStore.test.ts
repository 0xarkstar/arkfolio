import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      isDbReady: false,
      currentView: 'dashboard',
      lastSyncTime: null,
    });
  });

  describe('initial state', () => {
    it('should have isDbReady as false initially', () => {
      const state = useAppStore.getState();
      expect(state.isDbReady).toBe(false);
    });

    it('should have dashboard as initial view', () => {
      const state = useAppStore.getState();
      expect(state.currentView).toBe('dashboard');
    });

    it('should have null lastSyncTime initially', () => {
      const state = useAppStore.getState();
      expect(state.lastSyncTime).toBeNull();
    });
  });

  describe('setDbReady', () => {
    it('should set isDbReady to true', () => {
      const { setDbReady } = useAppStore.getState();
      setDbReady(true);
      expect(useAppStore.getState().isDbReady).toBe(true);
    });

    it('should set isDbReady to false', () => {
      const { setDbReady } = useAppStore.getState();
      setDbReady(true);
      setDbReady(false);
      expect(useAppStore.getState().isDbReady).toBe(false);
    });
  });

  describe('setCurrentView', () => {
    it('should update current view', () => {
      const { setCurrentView } = useAppStore.getState();
      setCurrentView('portfolio');
      expect(useAppStore.getState().currentView).toBe('portfolio');
    });

    it('should handle various view names', () => {
      const { setCurrentView } = useAppStore.getState();
      const views = ['dashboard', 'portfolio', 'exchanges', 'wallets', 'tax', 'settings'];

      views.forEach((view) => {
        setCurrentView(view);
        expect(useAppStore.getState().currentView).toBe(view);
      });
    });
  });

  describe('setLastSyncTime', () => {
    it('should update lastSyncTime', () => {
      const { setLastSyncTime } = useAppStore.getState();
      const timestamp = Date.now();
      setLastSyncTime(timestamp);
      expect(useAppStore.getState().lastSyncTime).toBe(timestamp);
    });

    it('should allow multiple updates', () => {
      const { setLastSyncTime } = useAppStore.getState();
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;

      setLastSyncTime(timestamp1);
      expect(useAppStore.getState().lastSyncTime).toBe(timestamp1);

      setLastSyncTime(timestamp2);
      expect(useAppStore.getState().lastSyncTime).toBe(timestamp2);
    });
  });
});
