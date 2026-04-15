import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary — catches any uncaught React render errors and shows a
 * graceful fallback UI instead of a blank white screen.
 *
 * Wrap at the top level in App.jsx to catch the entire tree.
 * Can also wrap individual sections for partial error isolation.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Something broke here.</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, forward to your monitoring service (Sentry, LogRocket, etc.)
    if (import.meta.env.PROD) {
      // window.Sentry?.captureException(error, { extra: info });
      console.error('[ErrorBoundary]', error, info);
    } else {
      console.error('[ErrorBoundary]', error.message, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Custom fallback if provided
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg-primary)] px-6 text-center">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle size={36} className="text-red-400" />
        </div>

        {/* Message */}
        <div className="max-w-md">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Something went wrong</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            An unexpected error occurred. This has been logged and will be looked into.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[var(--surface-2)] p-3 text-left text-xs text-red-300">
              {this.state.error.message}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500"
          >
            <RefreshCw size={14} /> Try again
          </button>
          <a
            href="/"
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
