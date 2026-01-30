import { useState, useCallback } from 'react';
import { toast } from './Toast';

interface CopyButtonProps {
  text: string;
  successMessage?: string;
  errorMessage?: string;
  className?: string;
  iconSize?: number;
  children?: React.ReactNode;
}

export function CopyButton({
  text,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy',
  className = '',
  iconSize = 14,
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error(errorMessage);
    }
  }, [text, successMessage, errorMessage]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {children}
      {copied ? (
        <CheckIcon size={iconSize} />
      ) : (
        <CopyIcon size={iconSize} />
      )}
    </button>
  );
}

// Copy icon
function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Check icon for copied state
function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-profit"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Inline copy text component - text with copy button
interface CopyTextProps {
  text: string;
  displayText?: string;
  truncate?: boolean;
  successMessage?: string;
  className?: string;
}

export function CopyText({
  text,
  displayText,
  truncate = false,
  successMessage = 'Copied to clipboard',
  className = '',
}: CopyTextProps) {
  const display = displayText || text;
  const truncatedDisplay = truncate && display.length > 12
    ? `${display.slice(0, 6)}...${display.slice(-4)}`
    : display;

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      <span title={text}>{truncatedDisplay}</span>
      <CopyButton text={text} successMessage={successMessage} iconSize={12} />
    </span>
  );
}
