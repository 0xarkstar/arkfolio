import { useState, useEffect, useRef, useCallback } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useNavigationStore } from '../stores/navigationStore';

interface SearchResult {
  type: 'asset' | 'exchange' | 'wallet';
  name: string;
  symbol?: string;
  value?: number;
  detail?: string;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { holdings } = usePortfolioStore();
  const { setView } = useNavigationStore();

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search logic
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search holdings
    holdings.forEach(holding => {
      if (
        holding.symbol.toLowerCase().includes(q) ||
        holding.name.toLowerCase().includes(q)
      ) {
        searchResults.push({
          type: 'asset',
          name: holding.name,
          symbol: holding.symbol,
          value: holding.valueUsd.toNumber(),
          detail: `${holding.totalAmount.toNumber().toFixed(4)} ${holding.symbol}`,
        });
      }
    });

    // Quick navigation options
    const pages = [
      { name: 'Dashboard', keyword: 'dashboard home' },
      { name: 'Portfolio', keyword: 'portfolio assets' },
      { name: 'Exchanges', keyword: 'exchanges cex binance upbit' },
      { name: 'Wallets', keyword: 'wallets onchain' },
      { name: 'DeFi', keyword: 'defi positions lending' },
      { name: 'Risk', keyword: 'risk management' },
      { name: 'Tax', keyword: 'tax report' },
      { name: 'Settings', keyword: 'settings preferences' },
    ];

    pages.forEach(page => {
      if (page.keyword.includes(q) || page.name.toLowerCase().includes(q)) {
        searchResults.push({
          type: 'wallet',
          name: `Go to ${page.name}`,
          detail: 'Navigation',
        });
      }
    });

    setResults(searchResults.slice(0, 10));
  }, [holdings]);

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    if (result.name.startsWith('Go to ')) {
      const page = result.name.replace('Go to ', '').toLowerCase();
      setView(page as any);
    } else if (result.type === 'asset') {
      setView('portfolio');
    }
    setIsOpen(false);
    setQuery('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface-800 rounded-lg text-surface-400 hover:text-surface-300 hover:bg-surface-700 transition-colors text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>Search...</span>
        <kbd className="hidden lg:inline px-1.5 py-0.5 bg-surface-700 rounded text-xs">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60">
      <div
        className="w-full max-w-lg bg-surface-900 rounded-xl shadow-2xl border border-surface-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700">
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
            className="text-surface-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets, pages..."
            className="flex-1 bg-transparent border-none outline-none text-surface-100 placeholder-surface-500"
          />
          <button
            onClick={() => { setIsOpen(false); setQuery(''); }}
            className="text-surface-400 hover:text-surface-100"
          >
            <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-xs">ESC</kbd>
          </button>
        </div>

        {results.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium text-primary-400">
                    {result.symbol?.slice(0, 2) || result.name.slice(0, 2)}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-surface-100">
                      {result.symbol || result.name}
                    </p>
                    <p className="text-xs text-surface-400">
                      {result.symbol ? result.name : result.detail}
                    </p>
                  </div>
                </div>
                {result.value !== undefined && (
                  <span className="text-surface-300 font-tabular">
                    {formatCurrency(result.value)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : query ? (
          <div className="px-4 py-8 text-center text-surface-400">
            No results found for "{query}"
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-surface-500 text-sm">
            Start typing to search assets and navigate pages
          </div>
        )}
      </div>
      <div
        className="absolute inset-0 -z-10"
        onClick={() => { setIsOpen(false); setQuery(''); }}
      />
    </div>
  );
}
