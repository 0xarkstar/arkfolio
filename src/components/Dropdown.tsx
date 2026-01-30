import { useState, useRef, useEffect, ReactNode } from 'react';

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
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'left',
  className = '',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (item: DropdownItem) => {
    if (item.disabled || item.divider) return;
    onSelect(item.id);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1 min-w-[160px] bg-surface-800 rounded-lg shadow-lg border border-surface-700 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${index}`}
                  className="my-1 border-t border-surface-700"
                />
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                  ${item.disabled
                    ? 'opacity-50 cursor-not-allowed text-surface-500'
                    : item.danger
                    ? 'text-loss hover:bg-loss/10'
                    : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                  }
                `}
              >
                {item.icon && <span className="text-surface-500">{item.icon}</span>}
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
