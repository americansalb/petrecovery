/**
 * Global Loading Component - Phase 0.3
 *
 * Shows while page content is loading.
 * This is a Next.js convention for loading states.
 */

export default function Loading() {
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
        {/* Animated paw print */}
        <div style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          &#128062;
        </div>

        {/* Spinner */}
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #2563eb',
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
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}
