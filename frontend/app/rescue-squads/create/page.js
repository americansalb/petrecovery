'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getZipCodeInfo } from '@/lib/zip-city-mapping';

export default function CreateRescueSquadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [zipCode, setZipCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zipLookupLoading, setZipLookupLoading] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/rescue-squads/create');
    }
  }, [status, router]);

  // Look up location when zip code is entered
  useEffect(() => {
    const lookupZip = async () => {
      if (zipCode.length === 5) {
        setZipLookupLoading(true);
        let info = getZipCodeInfo(zipCode);

        // If not in local database, fetch from geocoding API
        if (info && info.needsGeocode) {
          try {
            const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (res.ok) {
              const data = await res.json();
              const place = data.places[0];
              info = {
                zipCode: zipCode,
                city: place['place name'],
                metro: `${place['place name']}, ${place['state abbreviation']}`,
                metroValue: `${place['place name'].toUpperCase().replace(/\s+/g, '_')}_${place['state abbreviation']}`
              };
            } else {
              info = null;
            }
          } catch (error) {
            console.error('Zip lookup error:', error);
            info = null;
          }
        }

        setLocationInfo(info);
        setZipLookupLoading(false);
      } else {
        setLocationInfo(null);
      }
    };

    lookupZip();
  }, [zipCode]);

  const handleJoinSquad = async () => {
    setLoading(true);
    setError('');

    if (!locationInfo) {
      setError('Please enter a valid zip code');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/rescue-squads/join-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join squad');
      }

      // Redirect to dashboard to see the squad
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-block',
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600'
              }}
            >
              ← Dashboard
            </Link>
            <Link
              href="/rescue-squads/search"
              style={{
                display: 'inline-block',
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600'
              }}
            >
              ← Search Squads
            </Link>
          </div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            Join Your Local Rescue Squad
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b'
          }}>
            Enter your zip code to join or create your city's rescue squad
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
        }}>
          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              {error}
            </div>
          )}

          {/* Zip Code */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: '#0f172a',
              fontSize: '1.1rem'
            }}>
              Enter Your Zip Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="60124"
              maxLength={5}
              style={{
                width: '100%',
                padding: '1.25rem',
                fontSize: '1.25rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                textAlign: 'center',
                fontWeight: '600'
              }}
            />
          </div>

          {/* Location Info Display */}
          {zipCode.length === 5 && (
            <div style={{ marginBottom: '1.5rem' }}>
              {zipLookupLoading ? (
                <div style={{
                  padding: '2rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  Looking up location...
                </div>
              ) : locationInfo ? (
                <>
                  <div style={{
                    padding: '2rem',
                    background: '#ede9fe',
                    borderRadius: '12px',
                    border: '2px solid #667eea',
                    marginBottom: '1.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '3rem',
                      marginBottom: '1rem'
                    }}>
                      📍
                    </div>
                    <div style={{
                      fontSize: '1.75rem',
                      fontWeight: '900',
                      color: '#5b21b6',
                      marginBottom: '0.5rem'
                    }}>
                      {locationInfo.city} Rescue Squad
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#7c3aed'
                    }}>
                      Part of {locationInfo.metro}
                    </div>
                  </div>

                  <button
                    onClick={handleJoinSquad}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '1.5rem',
                      background: loading ? '#94a3b8' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '1.25rem',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Joining...' : `Join ${locationInfo.city} Rescue Squad`}
                  </button>
                </>
              ) : (
                <div style={{
                  padding: '2rem',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}>
                  Zip code not found in our database. Please try a different zip code or contact support to add your location.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
