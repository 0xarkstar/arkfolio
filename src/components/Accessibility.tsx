import { ReactNode } from 'react';

/**
 * VisuallyHidden - Content that is visually hidden but accessible to screen readers
 */
interface VisuallyHiddenProps {
  children: ReactNode;
  as?: 'span' | 'div';
}

export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return (
    <Component
      className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
      style={{ clip: 'rect(0, 0, 0, 0)' }}
    >
      {children}
    </Component>
  );
}

/**
 * SkipLink - Allows keyboard users to skip to main content
 */
interface SkipLinkProps {
  targetId?: string;
  children?: ReactNode;
}

export function SkipLink({ targetId = 'main-content', children = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]
        focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg
        focus:outline-none focus:ring-2 focus:ring-primary-500/50
      "
    >
      {children}
    </a>
  );
}

/**
 * LiveRegion - Announces dynamic content changes to screen readers
 */
interface LiveRegionProps {
  children: ReactNode;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-atomic'?: boolean;
  className?: string;
}

export function LiveRegion({
  children,
  'aria-live': ariaLive = 'polite',
  'aria-atomic': ariaAtomic = true,
  className = '',
}: LiveRegionProps) {
  return (
    <div
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * FocusTrap - Traps focus within a container (for modals, dialogs)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      }
    }
  };

  return { handleKeyDown };
}
