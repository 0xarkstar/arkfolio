import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

// Base Input
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, size = 'md', className = '', ...props }, ref) => {
    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return 'px-2.5 py-1.5 text-xs';
        case 'lg':
          return 'px-4 py-3 text-base';
        case 'md':
        default:
          return 'px-3 py-2 text-sm';
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

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 ${getIconSize()}`}>
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full bg-surface-800 border rounded-lg text-surface-100 placeholder-surface-500
              focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${error ? 'border-loss focus:border-loss focus:ring-loss/50' : 'border-surface-700 hover:border-surface-600'}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${getSizeStyles()}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 ${getIconSize()}`}>
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full bg-surface-800 border rounded-lg text-surface-100 placeholder-surface-500
            focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors px-3 py-2 text-sm min-h-[80px] resize-y
            ${error ? 'border-loss focus:border-loss focus:ring-loss/50' : 'border-surface-700 hover:border-surface-600'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Checkbox
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', ...props }, ref) => {
    return (
      <label className={`flex items-start gap-3 cursor-pointer ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="
            w-4 h-4 mt-0.5 rounded border-surface-600 bg-surface-800
            text-primary-500 focus:ring-primary-500/50 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer
          "
          {...props}
        />
        <div>
          {label && <span className="text-sm text-surface-200">{label}</span>}
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// Radio
interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, description, className = '', ...props }, ref) => {
    return (
      <label className={`flex items-start gap-3 cursor-pointer ${className}`}>
        <input
          ref={ref}
          type="radio"
          className="
            w-4 h-4 mt-0.5 border-surface-600 bg-surface-800
            text-primary-500 focus:ring-primary-500/50 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer
          "
          {...props}
        />
        <div>
          {label && <span className="text-sm text-surface-200">{label}</span>}
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
      </label>
    );
  }
);

Radio.displayName = 'Radio';

// Radio Group
interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  className?: string;
}

export function RadioGroup({ name, value, onChange, options, className = '' }: RadioGroupProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {options.map((option) => (
        <Radio
          key={option.value}
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
        />
      ))}
    </div>
  );
}

// Switch/Toggle
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
}: SwitchProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          track: 'w-8 h-4',
          thumb: 'w-3 h-3',
          translate: checked ? 'translate-x-4' : 'translate-x-0.5',
        };
      case 'md':
      default:
        return {
          track: 'w-11 h-6',
          thumb: 'w-5 h-5',
          translate: checked ? 'translate-x-5' : 'translate-x-0.5',
        };
    }
  };

  const styles = getSizeStyles();

  return (
    <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex shrink-0 rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-surface-900
          ${checked ? 'bg-primary-500' : 'bg-surface-700'}
          ${styles.track}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block rounded-full bg-white shadow-lg
            transform transition-transform duration-200 ease-in-out
            ${styles.thumb}
            ${styles.translate}
            mt-0.5
          `}
        />
      </button>
      {(label || description) && (
        <div>
          {label && <span className="text-sm text-surface-200">{label}</span>}
          {description && <p className="text-xs text-surface-500 mt-0.5">{description}</p>}
        </div>
      )}
    </label>
  );
}

// Select (native)
interface SelectProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, size = 'md', className = '', ...props }, ref) => {
    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return 'px-2.5 py-1.5 text-xs';
        case 'lg':
          return 'px-4 py-3 text-base';
        case 'md':
        default:
          return 'px-3 py-2 text-sm';
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full bg-surface-800 border rounded-lg text-surface-100
            focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors appearance-none cursor-pointer
            bg-no-repeat bg-right
            ${error ? 'border-loss focus:border-loss focus:ring-loss/50' : 'border-surface-700 hover:border-surface-600'}
            ${getSizeStyles()}
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundSize: '1.25rem',
            backgroundPosition: 'right 0.5rem center',
            paddingRight: '2.5rem',
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-loss">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Form Group (for layout)
interface FormGroupProps {
  children: ReactNode;
  className?: string;
}

export function FormGroup({ children, className = '' }: FormGroupProps) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

// Form Row (horizontal layout)
interface FormRowProps {
  children: ReactNode;
  className?: string;
}

export function FormRow({ children, className = '' }: FormRowProps) {
  return <div className={`flex gap-4 ${className}`}>{children}</div>;
}
