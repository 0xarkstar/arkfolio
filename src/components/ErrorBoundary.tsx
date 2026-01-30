import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

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
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <Card className="p-8 max-w-lg text-center">
            <div className="text-4xl mb-4 text-loss">!</div>
            <h2 className="text-xl font-semibold text-surface-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-surface-400 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-surface-500 hover:text-surface-300">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-surface-800 rounded text-xs text-loss overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack && (
                    <>{'\n\nComponent Stack:'}{this.state.errorInfo.componentStack}</>
                  )}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="secondary">
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="primary">
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
