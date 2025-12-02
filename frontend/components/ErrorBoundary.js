'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (Sentry, etc.)
      console.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const { fallback, showDetails = false } = this.props;

      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900/80 backdrop-blur-xl border-2 border-red-500/30 rounded-2xl p-8 shadow-2xl">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/20 rounded-full border-2 border-red-500/50">
                <AlertCircle size={48} className="text-red-400" />
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-3xl font-bold text-white text-center mb-3">
              Oops! Something went wrong
            </h1>

            {/* Error Message */}
            <p className="text-slate-300 text-center mb-8">
              We encountered an unexpected error. Don't worry, your data is safe.
            </p>

            {/* Error Details (dev mode only) */}
            {showDetails && error && (
              <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-700">
                <p className="text-sm text-red-400 font-mono mb-2">
                  {error.toString()}
                </p>
                {error.stack && (
                  <pre className="text-xs text-slate-500 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition shadow-lg shadow-cyan-500/30"
              >
                <RefreshCw size={20} />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/80 text-slate-300 font-bold rounded-xl hover:bg-slate-800 hover:text-white transition border-2 border-slate-700"
              >
                <Home size={20} />
                Go Home
              </button>
            </div>

            {/* Help Text */}
            <p className="text-sm text-slate-500 text-center mt-6">
              If this problem persists, please contact support or try refreshing the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Hook-based error boundary for functional components
 * Use this with React.lazy and Suspense
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
