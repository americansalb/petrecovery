'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function DivisionDetailPage({ params }) {
  const { data: session } = useSession();
  const [division, setDivision] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDivision();
  }, [params.id, params.divisionId]);

  const loadDivision = async () => {
    try {
      console.log('🔍 [DIVISION] Loading division:', params.divisionId);
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}`);
      const data = await res.json();

      if (!res.ok) {
        console.error('❌ [DIVISION] Failed to load:', data.error);
        throw new Error(data.error || 'Failed to load division');
      }

      console.log('✅ [DIVISION] Loaded successfully:', data.division);
      setDivision(data.division);
      setSquad(data.squad);
    } catch (err) {
      console.error('❌ [DIVISION] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error || !division || !squad) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            Division Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The division you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            href={`/rescue-squads/${params.id}`}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700'
            }}
          >
            ← Back to Squad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Breadcrumb */}
        <div style={{
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.95rem',
          color: '#64748b'
        }}>
          <Link href="/rescue-squads/search" style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}>
            Rescue Squads
          </Link>
          <span>→</span>
          <Link href={`/rescue-squads/${params.id}`} style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}>
            {squad.name}
          </Link>
          <span>→</span>
          <span style={{ fontWeight: '600', color: '#0f172a' }}>
            {division.name}
          </span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '700',
            marginBottom: '1rem',
            textTransform: 'uppercase'
          }}>
            Rescue Squad Division
          </div>

          <h1 style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            {division.name}
          </h1>

          <p style={{
            fontSize: '1.2rem',
            color: '#64748b'
          }}>
            Part of {squad.name}
          </p>
        </div>

        {/* Content area - blank for now */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          textAlign: 'center',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>
              🚧
            </div>
            <p style={{
              fontSize: '1.2rem',
              color: '#64748b',
              fontWeight: '600'
            }}>
              Division detail page under construction
            </p>
            <p style={{
              fontSize: '1rem',
              color: '#94a3b8',
              marginTop: '0.5rem'
            }}>
              We're rebuilding this page from scratch
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
