import { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { useExchangeStore } from '../stores/exchangeStore';
import { useWalletsStore } from '../stores/walletsStore';
import { useSettingsStore } from '../stores/settingsStore';

interface OnboardingProps {
  onComplete: () => void;
}

type OnboardingStep = 'welcome' | 'exchanges' | 'wallets' | 'settings' | 'complete';

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const { accounts } = useExchangeStore();
  const { wallets } = useWalletsStore();

  const steps: { id: OnboardingStep; label: string }[] = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'exchanges', label: 'Exchanges' },
    { id: 'wallets', label: 'Wallets' },
    { id: 'settings', label: 'Settings' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as complete in settings
    localStorage.setItem('arkfolio_onboarding_complete', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-surface-950 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl mx-4">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStepIndex
                      ? 'bg-profit text-white'
                      : index === currentStepIndex
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-700 text-surface-400'
                  }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 transition-colors ${
                      index < currentStepIndex ? 'bg-profit' : 'bg-surface-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <span
                key={step.id}
                className={`text-xs ${
                  step.id === currentStep ? 'text-primary-400' : 'text-surface-500'
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="p-8">
          {currentStep === 'welcome' && <WelcomeStep />}
          {currentStep === 'exchanges' && <ExchangesStep />}
          {currentStep === 'wallets' && <WalletsStep />}
          {currentStep === 'settings' && <SettingsStep />}
          {currentStep === 'complete' && <CompleteStep accounts={accounts} wallets={wallets} />}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-surface-700">
            {currentStepIndex > 0 && currentStep !== 'complete' ? (
              <Button variant="ghost" onClick={goPrev}>
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep === 'complete' ? (
              <Button onClick={handleComplete}>Get Started</Button>
            ) : (
              <Button onClick={goNext}>
                {currentStep === 'welcome' ? 'Get Started' : 'Continue'}
              </Button>
            )}
          </div>
        </Card>

        {/* Skip Button */}
        {currentStep !== 'complete' && (
          <div className="text-center mt-4">
            <button
              onClick={handleComplete}
              className="text-sm text-surface-500 hover:text-surface-300 transition-colors"
            >
              Skip setup and explore
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center">
      <div className="text-6xl mb-6">📊</div>
      <h2 className="text-2xl font-bold text-surface-100 mb-4">Welcome to ArkFolio</h2>
      <p className="text-surface-400 max-w-md mx-auto">
        Track your crypto portfolio across exchanges and wallets. Get insights into your DeFi
        positions, manage risk, and prepare tax reports.
      </p>
      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="p-4 bg-surface-800 rounded-lg">
          <div className="text-2xl mb-2">🏦</div>
          <p className="text-sm text-surface-300">CEX Tracking</p>
        </div>
        <div className="p-4 bg-surface-800 rounded-lg">
          <div className="text-2xl mb-2">👛</div>
          <p className="text-sm text-surface-300">On-chain Assets</p>
        </div>
        <div className="p-4 bg-surface-800 rounded-lg">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-sm text-surface-300">Tax Reports</p>
        </div>
      </div>
    </div>
  );
}

function ExchangesStep() {
  const { accounts } = useExchangeStore();
  const connectedCount = accounts.filter((a) => a.isConnected).length;

  return (
    <div>
      <h2 className="text-xl font-bold text-surface-100 mb-2">Connect Your Exchanges</h2>
      <p className="text-surface-400 mb-6">
        Connect your exchange accounts to automatically sync your balances and positions.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {['Binance', 'Upbit', 'OKX', 'Hyperliquid'].map((exchange) => (
            <div
              key={exchange}
              className="p-4 bg-surface-800 rounded-lg flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center">
                <span className="text-lg">🏦</span>
              </div>
              <div>
                <p className="font-medium text-surface-200">{exchange}</p>
                <p className="text-xs text-surface-500">API Key Required</p>
              </div>
            </div>
          ))}
        </div>

        {connectedCount > 0 && (
          <div className="p-4 bg-profit/10 border border-profit/20 rounded-lg">
            <p className="text-profit text-sm">
              ✓ {connectedCount} exchange{connectedCount > 1 ? 's' : ''} connected
            </p>
          </div>
        )}

        <p className="text-sm text-surface-500">
          You can connect exchanges later from the Exchanges page. Your API keys are encrypted and
          stored securely on your device.
        </p>
      </div>
    </div>
  );
}

function WalletsStep() {
  const { wallets } = useWalletsStore();

  return (
    <div>
      <h2 className="text-xl font-bold text-surface-100 mb-2">Add Your Wallets</h2>
      <p className="text-surface-400 mb-6">
        Track your on-chain assets by adding wallet addresses or connecting your browser wallet.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'Ethereum', icon: '⟠', chains: 'ETH, ARB, OP, BASE' },
            { name: 'Solana', icon: '◎', chains: 'SOL' },
            { name: 'SUI', icon: '💧', chains: 'SUI' },
          ].map((chain) => (
            <div key={chain.name} className="p-4 bg-surface-800 rounded-lg text-center">
              <div className="text-2xl mb-2">{chain.icon}</div>
              <p className="font-medium text-surface-200">{chain.name}</p>
              <p className="text-xs text-surface-500">{chain.chains}</p>
            </div>
          ))}
        </div>

        {wallets.length > 0 && (
          <div className="p-4 bg-profit/10 border border-profit/20 rounded-lg">
            <p className="text-profit text-sm">
              ✓ {wallets.length} wallet{wallets.length > 1 ? 's' : ''} added
            </p>
          </div>
        )}

        <p className="text-sm text-surface-500">
          Wallet addresses are public information. ArkFolio reads balances but never has access to
          your private keys.
        </p>
      </div>
    </div>
  );
}

function SettingsStep() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div>
      <h2 className="text-xl font-bold text-surface-100 mb-2">Quick Settings</h2>
      <p className="text-surface-400 mb-6">Customize your ArkFolio experience.</p>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-surface-200">Display Currency</p>
            <p className="text-sm text-surface-500">Choose your preferred currency</p>
          </div>
          <select
            value={settings.currency}
            onChange={(e) => updateSetting('currency', e.target.value as 'USD' | 'KRW' | 'EUR' | 'BTC')}
            className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-surface-100"
          >
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
            <option value="EUR">EUR</option>
            <option value="BTC">BTC</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-surface-200">Auto Sync</p>
            <p className="text-sm text-surface-500">Automatically sync data periodically</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => updateSetting('autoSync', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500" />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-surface-200">Theme</p>
            <p className="text-sm text-surface-500">Choose appearance</p>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value as 'dark' | 'light' | 'system')}
            className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-surface-100"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </div>
  );
}

interface CompleteStepProps {
  accounts: { isConnected: boolean }[];
  wallets: unknown[];
}

function CompleteStep({ accounts, wallets }: CompleteStepProps) {
  const connectedExchanges = accounts.filter((a) => a.isConnected).length;

  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-2xl font-bold text-surface-100 mb-4">You're All Set!</h2>
      <p className="text-surface-400 max-w-md mx-auto mb-8">
        ArkFolio is ready to help you track and manage your crypto portfolio.
      </p>

      <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
        <div className="p-4 bg-surface-800 rounded-lg">
          <p className="text-2xl font-bold text-primary-400">{connectedExchanges}</p>
          <p className="text-sm text-surface-400">Exchanges</p>
        </div>
        <div className="p-4 bg-surface-800 rounded-lg">
          <p className="text-2xl font-bold text-primary-400">{wallets.length}</p>
          <p className="text-sm text-surface-400">Wallets</p>
        </div>
      </div>

      {connectedExchanges === 0 && wallets.length === 0 && (
        <p className="text-sm text-surface-500 mt-6">
          No accounts connected yet. You can add them anytime from the sidebar.
        </p>
      )}
    </div>
  );
}

// Hook to check if onboarding should be shown
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const isComplete = localStorage.getItem('arkfolio_onboarding_complete') === 'true';
    setShowOnboarding(!isComplete);
    setIsChecking(false);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('arkfolio_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  return { showOnboarding, isChecking, completeOnboarding };
}
