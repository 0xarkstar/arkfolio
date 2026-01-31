import { useEffect, useState, lazy, Suspense } from 'react';
import { useAppStore } from './stores/appStore';
import { useNavigationStore, ViewId } from './stores/navigationStore';
import { useSettingsStore } from './stores/settingsStore';
import { initDatabase } from './database/init';
import { useAutoSync } from './hooks';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './components/Dashboard';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeyboardShortcuts, useKeyboardNavigation } from './components/KeyboardShortcuts';
import { Onboarding, useOnboarding } from './components/Onboarding';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Card } from './components/Card';
import { Button } from './components/Button';

// Lazy load feature pages for code splitting
const ExchangesPage = lazy(() => import('./features/cex').then(m => ({ default: m.ExchangesPage })));
const PortfolioPage = lazy(() => import('./features/portfolio').then(m => ({ default: m.PortfolioPage })));
const WalletsPage = lazy(() => import('./features/onchain').then(m => ({ default: m.WalletsPage })));
const DefiPage = lazy(() => import('./features/defi').then(m => ({ default: m.DefiPage })));
const NftPage = lazy(() => import('./features/nft').then(m => ({ default: m.NftPage })));
const RebalancePage = lazy(() => import('./features/rebalance').then(m => ({ default: m.RebalancePage })));
const RiskPage = lazy(() => import('./features/risk').then(m => ({ default: m.RiskPage })));
const TaxPage = lazy(() => import('./features/tax').then(m => ({ default: m.TaxPage })));
const SettingsPage = lazy(() => import('./features/settings').then(m => ({ default: m.SettingsPage })));
const AlertsPage = lazy(() => import('./features/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));
const HistoryPage = lazy(() => import('./features/history/HistoryPage').then(m => ({ default: m.HistoryPage })));

// Loading fallback for lazy-loaded pages
function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto mb-3"></div>
        <p className="text-surface-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setDbReady } = useAppStore();
  const { currentView } = useNavigationStore();
  const { loadSettings } = useSettingsStore();
  const { showOnboarding, isChecking, completeOnboarding } = useOnboarding();

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

  if (isLoading || isChecking) {
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
        <Card className="p-6 max-w-md text-center">
          <div className="text-loss text-4xl mb-4">!</div>
          <h1 className="text-xl font-semibold text-surface-100 mb-2">Initialization Error</h1>
          <p className="text-surface-400 mb-4">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <OfflineIndicator />
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
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
  // Dashboard is not lazy-loaded as it's the default landing page
  if (currentView === 'dashboard') {
    return <Dashboard />;
  }

  // All other pages are lazy-loaded with Suspense
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      {(() => {
        switch (currentView) {
          case 'portfolio':
            return <PortfolioPage />;
          case 'exchanges':
            return <ExchangesPage />;
          case 'wallets':
            return <WalletsPage />;
          case 'defi':
            return <DefiPage />;
          case 'nft':
            return <NftPage />;
          case 'rebalance':
            return <RebalancePage />;
          case 'risk':
            return <RiskPage />;
          case 'tax':
            return <TaxPage />;
          case 'history':
            return <HistoryPage />;
          case 'alerts':
            return <AlertsPage />;
          case 'settings':
            return <SettingsPage />;
          default:
            return <Dashboard />;
        }
      })()}
    </Suspense>
  );
}

export default App;
