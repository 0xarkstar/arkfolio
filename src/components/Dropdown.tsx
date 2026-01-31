import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
  className?: string;
  /** Accessible label for the dropdown menu */
  'aria-label'?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'left',
  className = '',
  'aria-label': ariaLabel = 'Menu',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useRef(`dropdown-trigger-${Math.random().toString(36).slice(2)}`);
  const menuId = useRef(`dropdown-menu-${Math.random().toString(36).slice(2)}`);

  // Get focusable items (excluding dividers and disabled)
  const focusableItems = items.filter(item => !item.divider && !item.disabled);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev + 1;
          return next >= focusableItems.length ? 0 : next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev - 1;
          return next < 0 ? focusableItems.length - 1 : next;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < focusableItems.length) {
          const item = focusableItems[focusedIndex];
          onSelect(item.id);
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(focusableItems.length - 1);
        break;
    }
  }, [isOpen, focusableItems, focusedIndex, onSelect]);

  const handleSelect = (item: DropdownItem) => {
    if (item.disabled || item.divider) return;
    onSelect(item.id);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setFocusedIndex(0);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <div
        id={triggerId.current}
        onClick={handleTriggerClick}
        className="cursor-pointer"
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId.current : undefined}
        tabIndex={0}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId.current}
          role="menu"
          aria-label={ariaLabel}
          aria-labelledby={triggerId.current}
          className={`absolute z-50 mt-1 min-w-[160px] bg-surface-800 rounded-lg shadow-lg border border-surface-700 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${index}`}
                  role="separator"
                  className="my-1 border-t border-surface-700"
                />
              );
            }

            const focusableIndex = focusableItems.findIndex(fi => fi.id === item.id);
            const isFocused = focusableIndex === focusedIndex;

            return (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                tabIndex={-1}
                aria-disabled={item.disabled}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors min-h-[44px]
                  ${item.disabled
                    ? 'opacity-50 cursor-not-allowed text-surface-500'
                    : item.danger
                    ? 'text-loss hover:bg-loss/10'
                    : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                  }
                  ${isFocused ? 'bg-surface-700 text-surface-100' : ''}
                `}
              >
                {item.icon && <span className="text-surface-500" aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Menu button with three dots
interface MenuDropdownProps {
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
}

export function MenuDropdown({ items, onSelect, align = 'right' }: MenuDropdownProps) {
  return (
    <Dropdown
      trigger={
        <button className="p-1 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      }
      items={items}
      onSelect={onSelect}
      align={align}
    />
  );
}

// Select dropdown with selected value display
interface SelectDropdownProps {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className = '',
}: SelectDropdownProps) {
  const selectedOption = options.find(opt => opt.id === value);

  return (
    <Dropdown
      trigger={
        <button
          className={`flex items-center justify-between gap-2 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm hover:border-surface-600 transition-colors ${className}`}
        >
          <span className={selectedOption ? 'text-surface-100' : 'text-surface-500'}>
            {selectedOption?.label || placeholder}
          </span>
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
            className="text-surface-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      }
      items={options.map(opt => ({
        id: opt.id,
        label: opt.label,
      }))}
      onSelect={onChange}
      align="left"
    />
  );
}
