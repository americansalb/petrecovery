'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CreateRescueSquadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [locationInfo, setLocationInfo] = useState(null);

  // Auto-fill ZIP from URL parameter
  useEffect(() => {
    const zipParam = searchParams.get('zip');
    if (zipParam && zipParam.length === 5) {
      setZipCode(zipParam);
      handleZipLookup(zipParam);
    }
  }, [searchParams]);

  const handleZipLookup = async (zip) => {
    if (zip.length !== 5) return;

    setLookingUp(true);
    setError('');

    try {
      const res = await fetch(`/api/geocode/zip/${zip}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid ZIP code');
      }

      setLocationInfo(data);
    } catch (err) {
      setError(err.message);
      setLocationInfo(null);
    } finally {
      setLookingUp(false);
    }
  };

  const handleZipChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(value);

    if (value.length === 5) {
      handleZipLookup(value);
    } else {
      setLocationInfo(null);
    }
  };

  const handleCreate = async () => {
    if (!locationInfo) {
      setError('Please enter a valid ZIP code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const squadName = `${locationInfo.cityName} Rescue Squad`;

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: squadName,
          description: `Volunteer rescue squad serving ${locationInfo.cityName} and surrounding areas`,
          centerLatitude: locationInfo.latitude,
          centerLongitude: locationInfo.longitude,
          radiusMiles: 10,
          city: locationInfo.cityName,
          state: locationInfo.state,
          zipCodes: JSON.stringify([locationInfo.zipCode]),
          coverageType: 'CITYWIDE',
          specializesInDogs: true,
          specializesInCats: true,
          specializesInBirds: true,
          specializesInOther: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        // If squad already exists, redirect to it
        if (data.existingSquadId) {
          router.push(`/rescue-squads/${data.existingSquadId}`);
          return;
        }
        throw new Error(data.error || 'Failed to create rescue squad');
      }

      // Redirect to the new squad page
      router.push(`/rescue-squads/${data.squad.id}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
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
            color: '#0f172a',
            marginBottom: '1rem'
          }}>
            Sign In Required
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Please sign in to create a rescue squad
          </p>
          <Link
            href="/login?callbackUrl=/rescue-squads/create"
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
            Sign In
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
              Start a volunteer rescue squad in your city
            </p>
          </div>
        </div>

        {/* Form */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '700',
              color: '#0f172a',
              fontSize: '1.1rem'
            }}>
              Your ZIP Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={handleZipChange}
              placeholder="60614"
              maxLength={5}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.2rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <p style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginTop: '0.5rem'
            }}>
              Enter your ZIP code to create a rescue squad for your city
            </p>
          </div>

          {/* Looking up indicator */}
          {lookingUp && (
            <div style={{
              padding: '1rem',
              background: '#f0f9ff',
              borderRadius: '8px',
              color: '#0369a1',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Looking up location...
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              border: '2px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '2rem',
              fontWeight: '600'
            }}>
              {error}
            </div>
          )}

          {/* Location Preview */}
          {locationInfo && (
            <div style={{
              padding: '1.5rem',
              background: '#f0fdf4',
              border: '2px solid #86efac',
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#166534',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                ✓ Location Found
              </div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem'
              }}>
                {locationInfo.cityName} Rescue Squad
              </div>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b'
              }}>
                Serving {locationInfo.cityName} and surrounding areas
              </div>
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={!locationInfo || loading}
            style={{
              width: '100%',
              padding: '1.25rem',
              background: (!locationInfo || loading) ? '#cbd5e1' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: (!locationInfo || loading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Creating Rescue Squad...' : 'Create Rescue Squad & Join as Founder'}
          </button>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#64748b'
          }}>
            <strong>Note:</strong> You'll automatically become the founding member of this rescue squad and can manage its settings.
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link
            href="/rescue-squads"
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            ← Back to Rescue Squads
          </Link>
        </div>
      </div>
    </div>
  );
}
