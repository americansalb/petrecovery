'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <WifiOff size={36} color="#ef4444" />
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '0.75rem',
        }}>
          You're Offline
        </h1>

        <p style={{
          color: '#64748b',
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}>
          It looks like you've lost your internet connection.
          Some features may not be available until you're back online.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
        }}>
          <button
            onClick={handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={18} />
            Try Again
          </button>

          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Home size={18} />
            Home
          </Link>
        </div>

        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#1e293b',
            marginBottom: '0.75rem',
          }}>
            What you can do offline:
          </h3>
          <ul style={{
            textAlign: 'left',
            color: '#64748b',
            fontSize: '0.85rem',
            margin: 0,
            paddingLeft: '1.25rem',
          }}>
            <li style={{ marginBottom: '0.5rem' }}>View previously loaded cases</li>
            <li style={{ marginBottom: '0.5rem' }}>Draft sighting reports (syncs when online)</li>
            <li style={{ marginBottom: '0.5rem' }}>View cached squad information</li>
            <li>Access saved search areas</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
