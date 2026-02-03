import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore, ViewId } from '../navigationStore';

describe('navigationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNavigationStore.setState({ currentView: 'dashboard' });
  });

  describe('initial state', () => {
    it('should have dashboard as initial view', () => {
      const state = useNavigationStore.getState();
      expect(state.currentView).toBe('dashboard');
    });
  });

  describe('setView', () => {
    it('should set view to portfolio', () => {
      const { setView } = useNavigationStore.getState();
      setView('portfolio');
      expect(useNavigationStore.getState().currentView).toBe('portfolio');
    });

    it('should set view to exchanges', () => {
      const { setView } = useNavigationStore.getState();
      setView('exchanges');
      expect(useNavigationStore.getState().currentView).toBe('exchanges');
    });

    it('should set view to wallets', () => {
      const { setView } = useNavigationStore.getState();
      setView('wallets');
      expect(useNavigationStore.getState().currentView).toBe('wallets');
    });

    it('should set view to defi', () => {
      const { setView } = useNavigationStore.getState();
      setView('defi');
      expect(useNavigationStore.getState().currentView).toBe('defi');
    });

    it('should set view to nft', () => {
      const { setView } = useNavigationStore.getState();
      setView('nft');
      expect(useNavigationStore.getState().currentView).toBe('nft');
    });

    it('should set view to rebalance', () => {
      const { setView } = useNavigationStore.getState();
      setView('rebalance');
      expect(useNavigationStore.getState().currentView).toBe('rebalance');
    });

    it('should set view to risk', () => {
      const { setView } = useNavigationStore.getState();
      setView('risk');
      expect(useNavigationStore.getState().currentView).toBe('risk');
    });

    it('should set view to tax', () => {
      const { setView } = useNavigationStore.getState();
      setView('tax');
      expect(useNavigationStore.getState().currentView).toBe('tax');
    });

    it('should set view to history', () => {
      const { setView } = useNavigationStore.getState();
      setView('history');
      expect(useNavigationStore.getState().currentView).toBe('history');
    });

    it('should set view to alerts', () => {
      const { setView } = useNavigationStore.getState();
      setView('alerts');
      expect(useNavigationStore.getState().currentView).toBe('alerts');
    });

    it('should set view to settings', () => {
      const { setView } = useNavigationStore.getState();
      setView('settings');
      expect(useNavigationStore.getState().currentView).toBe('settings');
    });

    it('should handle all valid view IDs', () => {
      const { setView } = useNavigationStore.getState();
      const allViews: ViewId[] = [
        'dashboard',
        'portfolio',
        'exchanges',
        'wallets',
        'defi',
        'nft',
        'rebalance',
        'risk',
        'tax',
        'history',
        'alerts',
        'settings',
      ];

      allViews.forEach((view) => {
        setView(view);
        expect(useNavigationStore.getState().currentView).toBe(view);
      });
    });

    it('should allow changing between views', () => {
      const { setView } = useNavigationStore.getState();

      setView('portfolio');
      expect(useNavigationStore.getState().currentView).toBe('portfolio');

      setView('settings');
      expect(useNavigationStore.getState().currentView).toBe('settings');

      setView('dashboard');
      expect(useNavigationStore.getState().currentView).toBe('dashboard');
    });
  });
});
