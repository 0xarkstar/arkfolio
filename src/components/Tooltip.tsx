import { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionStyles = (): React.CSSProperties => {
    if (!triggerRef.current) return {};

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tooltipWidth = tooltipRect?.width || 100;
    const tooltipHeight = tooltipRect?.height || 30;

    switch (position) {
      case 'top':
        return {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.top - tooltipHeight - 8,
        };
      case 'bottom':
        return {
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
          top: rect.bottom + 8,
        };
      case 'left':
        return {
          left: rect.left - tooltipWidth - 8,
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
        };
      case 'right':
        return {
          left: rect.right + 8,
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
        };
      default:
        return {};
    }
  };

  const getArrowStyles = (): string => {
    switch (position) {
      case 'top':
        return 'bottom-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-surface-700';
      case 'bottom':
        return 'top-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-surface-700';
      case 'left':
        return 'right-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-surface-700';
      case 'right':
        return 'left-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-surface-700';
      default:
        return '';
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] px-2 py-1 bg-surface-700 text-surface-100 text-xs rounded shadow-lg whitespace-nowrap pointer-events-none"
          style={getPositionStyles()}
          role="tooltip"
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 ${getArrowStyles()}`}
          />
        </div>
      )}
    </>
  );
}

// Simple info icon with tooltip
interface InfoTooltipProps {
  content: ReactNode;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-surface-700 text-surface-400 rounded-full cursor-help hover:bg-surface-600 hover:text-surface-300 transition-colors">
        ?
      </span>
    </Tooltip>
  );
}
