import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global error boundary that catches JavaScript errors in the component tree.
 * Provides recovery options including reload, retry, and cache clearing.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <Card className="p-8 max-w-lg text-center">
            <div className="text-5xl mb-4">
              <span role="img" aria-label="error">💥</span>
            </div>
            <h2 className="text-xl font-semibold text-surface-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-surface-400 mb-6">
              The application encountered an unexpected error. This is usually temporary
              and can be fixed by reloading or trying again.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left bg-surface-800 rounded-lg p-3">
                <summary className="cursor-pointer text-sm text-surface-500 hover:text-surface-300">
                  Technical details
                </summary>
                <div className="mt-2 text-xs font-mono text-loss break-all">
                  <p className="font-semibold mb-1">{this.state.error.name}</p>
                  <p className="mb-2">{this.state.error.message}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-surface-500 whitespace-pre-wrap overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="space-y-3">
              <div className="flex gap-3 justify-center">
                <Button onClick={this.handleReset} variant="secondary">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="primary">
                  Reload Page
                </Button>
              </div>
              <Button
                onClick={this.handleClearCacheAndReload}
                variant="ghost"
                size="sm"
                className="text-surface-500"
              >
                Clear cache and reload
              </Button>
            </div>

            <p className="text-xs text-surface-500 mt-6">
              If this keeps happening, please report the issue on{' '}
              <a
                href="https://github.com/arkfolio/arkfolio/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                GitHub
              </a>
            </p>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * A simpler error boundary for sections of the app that can fail independently.
 * Use this to wrap individual features so one failing section doesn't crash the entire app.
 */
export class SectionErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; sectionName?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode; sectionName?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const sectionName = this.props.sectionName || 'Section';
    console.error(`SectionErrorBoundary [${sectionName}] caught an error:`, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 text-center bg-surface-800/50 rounded-lg border border-surface-700">
          <div className="text-2xl mb-2">
            <span role="img" aria-label="warning">⚠️</span>
          </div>
          <p className="text-surface-300 mb-1">
            {this.props.sectionName
              ? `Failed to load ${this.props.sectionName}`
              : 'Failed to load this section'}
          </p>
          <p className="text-sm text-surface-500 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={this.handleRetry} variant="secondary" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
