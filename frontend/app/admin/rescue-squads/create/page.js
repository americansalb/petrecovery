'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCreateRescueSquadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [zipCode, setZipCode] = useState('');

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!zipCode.trim()) {
        throw new Error('ZIP code is required');
      }

      // Geocode the ZIP to get city/state
      const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (!geoRes.ok) {
        throw new Error('Invalid ZIP code');
      }

      const geoData = await geoRes.json();
      const place = geoData.places[0];
      const city = place['place name'];
      const state = place['state abbreviation'];

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, zipCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create rescue squad');
      }

      setSuccess(`Rescue Squad "${data.squad.name}" created successfully!`);

      // Redirect after 1 second
      setTimeout(() => {
        router.push(`/rescue-squads/${data.squad.id}`);
      }, 1000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Create Rescue Squad
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Enter a ZIP code to create a city-level rescue squad
            </p>
          </div>
          <Link
            href="/admin/rescue-squads"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#64748b',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700'
            }}
          >
            ← Back
          </Link>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: '8px',
            marginBottom: '2rem',
            fontWeight: '600',
            border: '2px solid #10b981'
          }}>
            ✓ {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            marginBottom: '2rem',
            fontWeight: '600',
            border: '2px solid #ef4444'
          }}>
            ✗ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              ZIP Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="60601"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              We'll automatically create a rescue squad for this city (e.g., "Chicago Rescue Squad")
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <Link
              href="/admin/rescue-squads"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#64748b',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#cbd5e1' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Squad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
