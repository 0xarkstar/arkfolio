import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'portfolio'
  | 'exchanges'
  | 'wallets'
  | 'defi'
  | 'tax'
  | 'settings';

interface NavigationState {
  currentView: ViewId;
  setView: (view: ViewId) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view }),
}));
