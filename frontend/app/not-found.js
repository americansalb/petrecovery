'use client';

/**
 * 404 Not Found Page - Phase 0.3
 *
 * Displays when users navigate to a page that doesn't exist.
 */

import Link from 'next/link';
import { useEffect } from 'react';

export default function NotFound() {
  useEffect(() => {
    console.log('========================================');
    console.log('[404] Page not found');
    console.log(`[404] Path: ${window.location.pathname}`);
    console.log(`[404] Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
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
          fontSize: '5rem',
          marginBottom: '1rem',
          lineHeight: 1,
        }}>
          &#128062;
        </div>

        <h1 style={{
          fontSize: '6rem',
          fontWeight: 'bold',
          color: '#1e40af',
          marginBottom: '0',
          lineHeight: 1,
        }}>
          404
        </h1>

        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '0.5rem',
        }}>
          Page Not Found
        </h2>

        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6',
        }}>
          Looks like this page wandered off! Don't worry, we'll help you find your way back.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}>
          <Link
            href="/"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Go Home
          </Link>

          <Link
            href="/missions"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: '#2563eb',
              border: '2px solid #2563eb',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Browse Cases
          </Link>
        </div>

        <div style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginTop: '1.5rem',
        }}>
          <p style={{
            fontSize: '0.9rem',
            color: '#4b5563',
            margin: 0,
          }}>
            <strong>Looking for something specific?</strong>
          </p>
          <div style={{
            marginTop: '0.75rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontSize: '0.9rem',
          }}>
            <Link href="/report/new" style={{ color: '#dc2626', textDecoration: 'none' }}>
              Report Lost Pet
            </Link>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href="/rescue-squads" style={{ color: '#2563eb', textDecoration: 'none' }}>
              Find Rescue Forces
            </Link>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
