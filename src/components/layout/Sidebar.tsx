import { useNavigationStore, ViewId } from '../../stores/navigationStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'portfolio', label: 'Portfolio', icon: '💼' },
  { id: 'exchanges', label: 'Exchanges', icon: '🏦' },
  { id: 'wallets', label: 'Wallets', icon: '👛' },
  { id: 'defi', label: 'DeFi', icon: '🌐' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'risk', label: 'Risk', icon: '⚠️' },
  { id: 'alerts', label: 'Alerts', icon: '🔔' },
  { id: 'tax', label: 'Tax Report', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { currentView, setView } = useNavigationStore();

  return (
    <aside
      className={`bg-surface-900 border-r border-surface-800 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-surface-800">
        {!collapsed && (
          <span className="text-xl font-bold text-primary-400">ArkFolio</span>
        )}
        <button
          onClick={onToggle}
          className="p-1 hover:bg-surface-800 rounded transition-colors text-surface-400 hover:text-surface-100"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-lg">{item.icon}</span>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-800">
        {!collapsed ? (
          <div className="text-center">
            <p className="text-xs text-surface-500">v0.1.0</p>
            <p className="text-xs text-surface-600 mt-1">
              Press <kbd className="px-1 py-0.5 bg-surface-700 rounded text-[10px]">?</kbd> for shortcuts
            </p>
          </div>
        ) : (
          <button
            className="w-full flex justify-center text-surface-600 hover:text-surface-400"
            title="Keyboard shortcuts (?)"
          >
            <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-xs">?</kbd>
          </button>
        )}
      </div>
    </aside>
  );
}
