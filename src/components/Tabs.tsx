import { useState, createContext, useContext, ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: number | string;
}

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children: ReactNode;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'text-sm py-1.5 px-3';
      case 'lg':
        return 'text-base py-3 px-5';
      case 'md':
      default:
        return 'text-sm py-2 px-4';
    }
  };

  const getVariantStyles = (isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) {
      return 'opacity-50 cursor-not-allowed text-surface-500';
    }

    switch (variant) {
      case 'pills':
        return isActive
          ? 'bg-primary-600 text-white rounded-lg'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg';
      case 'underline':
        return isActive
          ? 'text-primary-400 border-b-2 border-primary-400'
          : 'text-surface-400 hover:text-surface-100 border-b-2 border-transparent';
      case 'default':
      default:
        return isActive
          ? 'bg-surface-800 text-surface-100 rounded-lg'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg';
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>
        <div
          className={`flex gap-1 ${variant === 'underline' ? 'border-b border-surface-800' : ''}`}
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={`
                ${getSizeStyles()}
                ${getVariantStyles(activeTab === tab.id, !!tab.disabled)}
                inline-flex items-center gap-2 font-medium transition-colors
              `}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 bg-surface-700 text-surface-300 text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </TabsContext.Provider>
  );
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className = '' }: TabPanelProps) {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error('TabPanel must be used within a Tabs component');
  }

  if (context.activeTab !== id) {
    return null;
  }

  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
}

// Simple tabs without content - just returns the active tab
interface SimpleTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SimpleTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  className = '',
}: SimpleTabsProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'text-sm py-1.5 px-3';
      case 'lg':
        return 'text-base py-3 px-5';
      case 'md':
      default:
        return 'text-sm py-2 px-4';
    }
  };

  const getVariantStyles = (isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) {
      return 'opacity-50 cursor-not-allowed text-surface-500';
    }

    switch (variant) {
      case 'pills':
        return isActive
          ? 'bg-primary-600 text-white rounded-lg'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg';
      case 'underline':
        return isActive
          ? 'text-primary-400 border-b-2 border-primary-400'
          : 'text-surface-400 hover:text-surface-100 border-b-2 border-transparent';
      case 'default':
      default:
        return isActive
          ? 'bg-surface-800 text-surface-100 rounded-lg'
          : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 rounded-lg';
    }
  };

  return (
    <div
      className={`flex gap-1 ${variant === 'underline' ? 'border-b border-surface-800' : ''} ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={`
            ${getSizeStyles()}
            ${getVariantStyles(activeTab === tab.id, !!tab.disabled)}
            inline-flex items-center gap-2 font-medium transition-colors
          `}
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className="px-1.5 py-0.5 bg-surface-700 text-surface-300 text-xs rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
