import { useState, useEffect, useCallback, useRef } from 'react';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounce?: number;
  size?: 'sm' | 'md' | 'lg';
  autoFocus?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  debounce = 300,
  size = 'md',
  autoFocus = false,
  className = '',
  onFocus,
  onBlur,
  disabled = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with controlled value
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== internalValue) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (debounce > 0) {
        timeoutRef.current = setTimeout(() => {
          onChange(newValue);
        }, debounce);
      } else {
        onChange(newValue);
      }
    },
    [onChange, debounce]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-8 text-xs pl-8 pr-8';
      case 'lg':
        return 'h-12 text-base pl-12 pr-12';
      case 'md':
      default:
        return 'h-10 text-sm pl-10 pr-10';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3.5 h-3.5';
      case 'lg':
        return 'w-5 h-5';
      case 'md':
      default:
        return 'w-4 h-4';
    }
  };

  const getIconPosition = () => {
    switch (size) {
      case 'sm':
        return 'left-2.5';
      case 'lg':
        return 'left-4';
      case 'md':
      default:
        return 'left-3';
    }
  };

  const getClearPosition = () => {
    switch (size) {
      case 'sm':
        return 'right-2';
      case 'lg':
        return 'right-4';
      case 'md':
      default:
        return 'right-3';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Icon */}
      <div className={`absolute ${getIconPosition()} top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none`}>
        <svg className={getIconSize()} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`
          w-full bg-surface-800 border border-surface-700 rounded-lg
          text-surface-100 placeholder-surface-500
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          hover:border-surface-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${getSizeStyles()}
        `}
      />

      {/* Clear Button */}
      {internalValue && !disabled && (
        <button
          onClick={handleClear}
          className={`absolute ${getClearPosition()} top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors`}
          aria-label="Clear search"
        >
          <svg className={getIconSize()} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Filter bar with search and optional filters
interface FilterBarProps {
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode; // Filter dropdowns, buttons, etc.
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  children,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <SearchInput
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="flex-1 min-w-[200px]"
      />
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// Keyboard shortcut enabled search
interface CommandSearchProps extends SearchInputProps {
  shortcut?: string;
  onShortcut?: () => void;
}

export function CommandSearch({
  shortcut = '/',
  onShortcut,
  ...props
}: CommandSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in another input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === shortcut) {
        e.preventDefault();
        inputRef.current?.focus();
        onShortcut?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, onShortcut]);

  return (
    <div className="relative">
      <SearchInput {...props} />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-[10px] text-surface-500 border border-surface-600">
          {shortcut}
        </kbd>
      </div>
    </div>
  );
}
