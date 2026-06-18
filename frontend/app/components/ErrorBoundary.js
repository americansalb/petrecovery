'use client';

/**
 * Error Boundary Component - Phase 0.3
 *
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state to show fallback UI
    console.error('[ERROR-BOUNDARY] Error caught:', error.message);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('========================================');
    console.error('[ERROR-BOUNDARY] Component Error Caught');
    console.error(`[ERROR-BOUNDARY] Error: ${error.message}`);
    console.error(`[ERROR-BOUNDARY] Stack: ${error.stack}`);
    console.error(`[ERROR-BOUNDARY] Component Stack: ${errorInfo.componentStack}`);
    console.error('========================================');

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report to Sentry. The browser loader script installs window.Sentry (and
    // buffers calls until the SDK finishes loading); safe no-op without it.
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        extra: { componentStack: errorInfo?.componentStack },
      });
    }
  }

  handleReload = () => {
    console.log('[ERROR-BOUNDARY] User clicked reload');
    window.location.reload();
  };

  handleGoHome = () => {
    console.log('[ERROR-BOUNDARY] User clicked go home');
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom, #fef2f2, #fee2e2)',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem',
            }}>
              &#128549;
            </div>

            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#991b1b',
              marginBottom: '0.5rem',
            }}>
              Something Went Wrong
            </h1>

            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
            }}>
              We're sorry, but something unexpected happened.
              Our team has been notified.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: '200px',
              }}>
                <strong style={{ color: '#991b1b' }}>Error:</strong>
                <pre style={{
                  margin: '0.5rem 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#7f1d1d',
                }}>
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <>
                    <strong style={{ color: '#991b1b' }}>Component Stack:</strong>
                    <pre style={{
                      margin: '0.5rem 0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#7f1d1d',
                      fontSize: '0.65rem',
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  border: '2px solid #2563eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Go Home
              </button>
            </div>

            <p style={{
              marginTop: '1.5rem',
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}>
              If this problem persists, please{' '}
              <a
                href="mailto:support@petrecovery.org"
                style={{ color: '#2563eb', textDecoration: 'none' }}
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    // No error - render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
