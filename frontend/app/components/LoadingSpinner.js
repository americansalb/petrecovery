'use client';

/**
 * Loading Spinner Component - Phase 0.3
 *
 * Reusable loading spinner that can be used throughout the app.
 * Supports different sizes and optional text.
 */

export default function LoadingSpinner({
  size = 'medium',  // 'small', 'medium', 'large'
  text = null,
  fullScreen = false,
  color = '#2563eb',
}) {
  const sizes = {
    small: { spinner: 24, border: 2, fontSize: '0.75rem' },
    medium: { spinner: 40, border: 3, fontSize: '0.875rem' },
    large: { spinner: 60, border: 4, fontSize: '1rem' },
  };

  const { spinner, border, fontSize } = sizes[size] || sizes.medium;

  const spinnerElement = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <div style={{
        width: `${spinner}px`,
        height: `${spinner}px`,
        border: `${border}px solid #e5e7eb`,
        borderTop: `${border}px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />

      {text && (
        <span style={{
          color: '#6b7280',
          fontSize,
        }}>
          {text}
        </span>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 9999,
      }}>
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
}

/**
 * Inline loading text component
 */
export function LoadingText({ text = 'Loading...' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#6b7280',
    }}>
      <span style={{
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid #e5e7eb',
        borderTop: '2px solid #2563eb',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      {text}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  );
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '0.25rem',
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      backgroundColor: '#e5e7eb',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
