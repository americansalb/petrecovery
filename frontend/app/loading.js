'use client';

/**
 * Global Loading Component
 *
 * Shows while page content is loading.
 * This is a Next.js convention for loading states.
 */

import { usePathname } from 'next/navigation';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

/**
 * The game's routes are another product with its own look and its own
 * domain. This screen is the fallback for every route, so on
 * probablyearth.com a game page first showed the pet site's mascot on a
 * light page for up to two seconds, and because the mascot is an <img>
 * in the first HTML React sends, every game page also preloaded it: a
 * 1.1 MB SVG that is never shown there. The game gets its own dark
 * canvas, the colour every one of its pages has (app/geo/theme.css).
 */
function isGameRoute(pathname) {
  return pathname === '/geo' || pathname.startsWith('/geo/');
}

export default function Loading() {
  const pathname = usePathname() || '';
  if (isGameRoute(pathname)) {
    return <div role="status" aria-label="Loading" style={{ minHeight: '100vh', background: 'rgb(11 15 20)' }} />;
  }
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
      }}>
        {/* Sarama mascot */}
        <img
          src={SARAMA_AVATAR}
          alt="Sarama"
          style={{
            width: '64px',
            height: '64px',
            marginBottom: '1rem',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />

        {/* Spinner */}
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #FFCE47',
          borderRadius: '50%',
          margin: '0 auto 1rem',
          animation: 'spin 1s linear infinite',
        }} />

        <p style={{
          color: '#6b7280',
          fontSize: '1rem',
          margin: 0,
        }}>
          Loading...
        </p>

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.95); }
          }
        `}</style>
      </div>
    </div>
  );
}
