'use client';

/**
 * Error Boundary Component
 *
 * Catches and handles errors gracefully with retry functionality.
 * Per Actions_Guide.md Phase 7 specification.
 */

import { Component } from 'react';

// =============================================================================
// ERROR BOUNDARY CLASS
// =============================================================================

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }

    // Report to error tracking service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
          reload: this.handleReload,
        });
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          retryCount={this.state.retryCount}
          variant={this.props.variant}
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// ERROR FALLBACK COMPONENT
// =============================================================================

function ErrorFallback({ error, errorInfo, onRetry, onReload, retryCount, variant = 'full' }) {
  const isNetworkError =
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Failed to load');

  // Compact inline error
  if (variant === 'inline') {
    return (
      <div style={inlineStyles.container}>
        <span style={inlineStyles.icon}>{isNetworkError ? '\u{1F4E1}' : '\u26A0\uFE0F'}</span>
        <span style={inlineStyles.message}>
          {isNetworkError ? 'Connection error' : 'Something went wrong'}
        </span>
        <button onClick={onRetry} style={inlineStyles.button}>
          Retry
        </button>
      </div>
    );
  }

  // Card error (for sections)
  if (variant === 'card') {
    return (
      <div style={cardStyles.container}>
        <div style={cardStyles.icon}>{isNetworkError ? '\u{1F4E1}' : '\u{1F6A8}'}</div>
        <h3 style={cardStyles.title}>
          {isNetworkError ? 'Connection Lost' : 'Something went wrong'}
        </h3>
        <p style={cardStyles.message}>
          {isNetworkError
            ? "We couldn't connect to the server. Check your internet connection."
            : "We hit an unexpected error. Our team has been notified."}
        </p>
        <div style={cardStyles.actions}>
          <button onClick={onRetry} style={cardStyles.retryButton}>
            Try Again
          </button>
          {retryCount >= 2 && (
            <button onClick={onReload} style={cardStyles.reloadButton}>
              Reload Page
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full page error
  return (
    <div style={fullStyles.container}>
      <div style={fullStyles.content}>
        <div style={fullStyles.icon}>{isNetworkError ? '\u{1F4F4}' : '\u{1F6A8}'}</div>
        <h1 style={fullStyles.title}>
          {isNetworkError ? 'Connection Lost' : 'Oops! Something went wrong'}
        </h1>
        <p style={fullStyles.message}>
          {isNetworkError
            ? "We couldn't reach our servers. Please check your internet connection and try again."
            : "We encountered an unexpected error. Don't worry - your data is safe."}
        </p>

        <div style={fullStyles.actions}>
          <button onClick={onRetry} style={fullStyles.primaryButton}>
            {isNetworkError ? 'Try Again' : 'Retry'}
          </button>
          <button onClick={onReload} style={fullStyles.secondaryButton}>
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details style={fullStyles.details}>
            <summary style={fullStyles.summary}>Error Details</summary>
            <pre style={fullStyles.pre}>
              {error.toString()}
              {'\n\n'}
              {errorInfo?.componentStack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const inlineStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#FEE2E2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
  },
  icon: {
    fontSize: '1rem',
  },
  message: {
    flex: 1,
    color: '#991B1B',
    fontSize: '0.875rem',
  },
  button: {
    padding: '0.375rem 0.75rem',
    background: '#EF4444',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

const cardStyles = {
  container: {
    padding: '2rem',
    background: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '12px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
  },
  title: {
    margin: '0 0 0.5rem',
    color: 'white',
    fontSize: '1.25rem',
    fontWeight: '700',
  },
  message: {
    margin: '0 0 1.5rem',
    color: '#94A3B8',
    fontSize: '0.9rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
  },
  retryButton: {
    padding: '0.625rem 1.25rem',
    background: '#667EEA',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  reloadButton: {
    padding: '0.625rem 1.25rem',
    background: 'transparent',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#94A3B8',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

const fullStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  },
  content: {
    maxWidth: '480px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '4rem',
    marginBottom: '1.5rem',
  },
  title: {
    margin: '0 0 1rem',
    color: 'white',
    fontSize: '1.75rem',
    fontWeight: '700',
  },
  message: {
    margin: '0 0 2rem',
    color: '#94A3B8',
    fontSize: '1rem',
    lineHeight: 1.6,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '280px',
    margin: '0 auto',
  },
  primaryButton: {
    width: '100%',
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    width: '100%',
    padding: '0.875rem 1.5rem',
    background: 'transparent',
    border: '1px solid #475569',
    borderRadius: '10px',
    color: '#94A3B8',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  details: {
    marginTop: '2rem',
    textAlign: 'left',
  },
  summary: {
    color: '#64748B',
    fontSize: '0.875rem',
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  pre: {
    padding: '1rem',
    background: '#0F172A',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#F87171',
    fontSize: '0.75rem',
    overflow: 'auto',
    maxHeight: '200px',
  },
};

export default ErrorBoundary;
