import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { useNavigationStore, ViewId } from './stores/navigationStore';
import { useSettingsStore } from './stores/settingsStore';
import { initDatabase } from './database/init';
import { useAutoSync } from './hooks';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './components/Dashboard';
import { ExchangesPage } from './features/cex';
import { PortfolioPage } from './features/portfolio';
import { WalletsPage } from './features/onchain';
import { DefiPage } from './features/defi';
import { RiskPage } from './features/risk';
import { TaxPage } from './features/tax';
import { SettingsPage } from './features/settings';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcuts, useKeyboardNavigation } from './components/KeyboardShortcuts';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setDbReady } = useAppStore();
  const { currentView } = useNavigationStore();
  const { loadSettings } = useSettingsStore();

  // Initialize database and load settings
  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        setDbReady(true);
        await loadSettings();
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
        setIsLoading(false);
      }
    }

    init();
  }, [setDbReady, loadSettings]);

  // Enable auto-sync when database is ready
  useAutoSync();

  // Enable keyboard navigation
  useKeyboardNavigation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-surface-400">Initializing ArkFolio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="card p-6 max-w-md text-center">
          <div className="text-loss text-4xl mb-4">!</div>
          <h1 className="text-xl font-semibold text-surface-100 mb-2">Initialization Error</h1>
          <p className="text-surface-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainLayout>
        <ErrorBoundary>
          <PageRouter currentView={currentView} />
        </ErrorBoundary>
      </MainLayout>
      <ToastContainer />
      <KeyboardShortcuts />
    </>
  );
}

function PageRouter({ currentView }: { currentView: ViewId }) {
  switch (currentView) {
    case 'dashboard':
      return <Dashboard />;
    case 'portfolio':
      return <PortfolioPage />;
    case 'exchanges':
      return <ExchangesPage />;
    case 'wallets':
      return <WalletsPage />;
    case 'defi':
      return <DefiPage />;
    case 'risk':
      return <RiskPage />;
    case 'tax':
      return <TaxPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
}

export default App;
