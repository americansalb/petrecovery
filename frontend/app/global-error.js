'use client';

/**
 * Root error boundary.
 *
 * app/error.js only catches errors thrown *inside* the root layout's children.
 * If the root layout itself fails there was nothing here at all, so the visitor
 * got the raw Next.js error screen and nobody was told. global-error.js
 * replaces the whole document, which is why it renders its own <html>/<body>.
 *
 * Deliberately plain: this file runs when the app is already broken, so it
 * depends on nothing but React - no design system, no fonts, no icons.
 */

import { useEffect } from 'react';
import { captureException } from '@/app/lib/errorTracking';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    captureException(error, {
      eventType: 'app.global_error',
      resourceType: 'app',
      tags: { boundary: 'global', digest: error?.digest || null },
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#0f172a',
          color: '#e7ebf1',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>
            Something went wrong on our side
          </h1>
          <p style={{ margin: '0 0 1.5rem', color: '#98a3b0', lineHeight: 1.6 }}>
            This is our fault, not yours. If you were reporting a lost pet, your
            details were not lost - try again and it should go through.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.7rem 1.2rem',
                borderRadius: '0.6rem',
                border: 'none',
                background: '#facc15',
                color: '#0f172a',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.7rem 1.2rem',
                borderRadius: '0.6rem',
                border: '1px solid #3a4553',
                color: '#e7ebf1',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Go to the home page
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
