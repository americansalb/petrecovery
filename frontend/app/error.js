'use client';

/**
 * Error Page - Phase 0.3
 *
 * Displays when an error occurs during rendering.
 * This is a Next.js convention for handling runtime errors.
 */

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error to console
    console.error('========================================');
    console.error('[ERROR-PAGE] Runtime error occurred');
    console.error(`[ERROR-PAGE] Error: ${error.message}`);
    console.error(`[ERROR-PAGE] Digest: ${error.digest || 'N/A'}`);
    console.error(`[ERROR-PAGE] Stack: ${error.stack}`);
    console.error(`[ERROR-PAGE] Timestamp: ${new Date().toISOString()}`);
    console.error('========================================');

    // Report to Sentry. The browser loader script installs window.Sentry (and
    // buffers calls until the SDK finishes loading); this is a safe no-op in
    // dev / anywhere the loader isn't present.
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error);
    }
  }, [error]);

  const handleRetry = () => {
    console.log('[ERROR-PAGE] User clicked retry');
    reset();
  };

  const handleGoHome = () => {
    console.log('[ERROR-PAGE] User clicked go home');
    window.location.href = '/';
  };

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
          &#9888;&#65039;
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#991b1b',
          marginBottom: '0.5rem',
        }}>
          Oops! Something Went Wrong
        </h1>

        <p style={{
          color: '#6b7280',
          marginBottom: '1.5rem',
          lineHeight: '1.6',
        }}>
          We encountered an unexpected error. This has been logged and our team will look into it.
        </p>

        {/* Show error details in development */}
        {process.env.NODE_ENV === 'development' && error && (
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
            <strong style={{ color: '#991b1b' }}>Error Details:</strong>
            <pre style={{
              margin: '0.5rem 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#7f1d1d',
            }}>
              {error.message}
            </pre>
            {error.digest && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ color: '#991b1b' }}>Error ID:</strong>
                <code style={{
                  marginLeft: '0.5rem',
                  backgroundColor: '#fee2e2',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                }}>
                  {error.digest}
                </code>
              </div>
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
            onClick={handleRetry}
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
            onClick={handleGoHome}
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
          If this keeps happening, try clearing your browser cache or{' '}
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
