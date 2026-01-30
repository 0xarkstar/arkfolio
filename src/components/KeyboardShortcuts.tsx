import { useState, useEffect } from 'react';

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open global search' },
  { keys: ['Esc'], description: 'Close modal / Clear search' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['1'], description: 'Go to Dashboard' },
  { keys: ['2'], description: 'Go to Portfolio' },
  { keys: ['3'], description: 'Go to Exchanges' },
  { keys: ['4'], description: 'Go to Wallets' },
  { keys: ['5'], description: 'Go to DeFi' },
  { keys: ['6'], description: 'Go to Risk' },
  { keys: ['7'], description: 'Go to Tax' },
  { keys: ['8'], description: 'Go to Settings' },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Show shortcuts with '?'
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(true);
      }

      // Close with Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-surface-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-surface-400 hover:text-surface-100 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0"
            >
              <span className="text-surface-300">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <kbd
                    key={keyIndex}
                    className="px-2 py-1 bg-surface-700 rounded text-xs text-surface-200 font-mono min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-surface-500 mt-4 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-xs">Esc</kbd> to close
        </p>
      </div>
      <div
        className="absolute inset-0 -z-10"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
}

export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Number keys for navigation (without modifiers)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const { useNavigationStore } = require('../stores/navigationStore');
        const { setView } = useNavigationStore.getState();

        switch (e.key) {
          case '1':
            setView('dashboard');
            break;
          case '2':
            setView('portfolio');
            break;
          case '3':
            setView('exchanges');
            break;
          case '4':
            setView('wallets');
            break;
          case '5':
            setView('defi');
            break;
          case '6':
            setView('risk');
            break;
          case '7':
            setView('tax');
            break;
          case '8':
            setView('settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
