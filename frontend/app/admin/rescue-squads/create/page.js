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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [stateName, setStateName] = useState('');
  const [availableCities, setAvailableCities] = useState([]);
  const [zipVerified, setZipVerified] = useState(false);
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCityInput, setCustomCityInput] = useState('');

  // No role restriction - any authenticated user can create a rescue squad
  // Only division creation requires admin role

  // Pre-fill city name from URL if provided
  useEffect(() => {
    const cityParam = searchParams.get('city');
    if (cityParam && !cityName) {
      setCityName(cityParam);
      setIsCustomCity(true);
      setCustomCityInput(cityParam);
    }
  }, [searchParams]);

  const handleVerifyZip = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!zipCode.trim() || zipCode.length !== 5) {
        throw new Error('Valid 5-digit ZIP code is required');
      }

      // Geocode the ZIP to get suggested city/state
      const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (!geoRes.ok) {
        throw new Error('Invalid ZIP code');
      }

      const geoData = await geoRes.json();
      const state = geoData.places[0]['state abbreviation'];

      // Extract all cities served by this ZIP code
      const cities = geoData.places.map(place => place['place name']);

      // Debug: log what the API returned
      console.log(`[ZIP ${zipCode}] API returned ${geoData.places.length} place(s):`, geoData.places.map(p => p['place name']));

      setAvailableCities(cities);
      setCityName(cities[0]); // Pre-fill with first city
      setStateName(state);
      setIsCustomCity(false); // Reset to dropdown mode
      setCustomCityInput('');
      setZipVerified(true);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!cityName.trim()) {
        throw new Error('City name is required');
      }

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityName.trim(), state: stateName, zipCode }),
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
            href="/rescue-squads"
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

        {/* Step 1: ZIP Code Entry */}
        {!zipVerified && (
          <form onSubmit={handleVerifyZip} style={{
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
                maxLength={5}
                pattern="[0-9]{5}"
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
                Enter the ZIP code for the city where you want to create a rescue squad
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <Link
                href="/rescue-squads"
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
                disabled={loading || zipCode.length !== 5}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading || zipCode.length !== 5 ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: loading || zipCode.length !== 5 ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Verifying...' : 'Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: City Name Confirmation/Override */}
        {zipVerified && (
          <form onSubmit={handleSubmit} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            {/* ZIP Info Banner */}
            <div style={{
              background: '#eff6ff',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                ZIP Code: <strong>{zipCode}</strong> • State: <strong>{stateName}</strong>
                {availableCities.length > 1 && (
                  <span> • Cities: <strong>{availableCities.join(', ')}</strong></span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem'
              }}>
                City Name <span style={{ color: '#ef4444' }}>*</span>
              </label>

              {/* Dropdown with detected cities + "Other" option */}
              <select
                value={isCustomCity ? '__custom__' : cityName}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomCity(true);
                    setCityName('');
                    setCustomCityInput('');
                  } else {
                    setIsCustomCity(false);
                    setCityName(e.target.value);
                  }
                }}
                required={!isCustomCity}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  marginBottom: isCustomCity ? '0.75rem' : '0'
                }}
              >
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
                <option value="__custom__">Other (enter manually)</option>
              </select>

              {/* Custom city input - only shown when "Other" is selected */}
              {isCustomCity && (
                <input
                  type="text"
                  value={customCityInput}
                  onChange={(e) => {
                    setCustomCityInput(e.target.value);
                    setCityName(e.target.value);
                  }}
                  placeholder="Enter city name"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              )}

              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginTop: '0.5rem'
              }}>
                {availableCities.length > 1 ? (
                  <>API detected {availableCities.length} cities for this ZIP: <strong>{availableCities.join(', ')}</strong></>
                ) : (
                  <>API detected: <strong>{availableCities[0]}</strong>. Select "Other" if your city is different (some ZIPs serve multiple cities).</>
                )}
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginTop: '0.25rem'
              }}>
                Will create: <strong>{cityName ? `${cityName} Rescue Squad` : '[City] Rescue Squad'}</strong>
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => {
                  setZipVerified(false);
                  setCityName('');
                  setAvailableCities([]);
                  setIsCustomCity(false);
                  setCustomCityInput('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ← Change ZIP
              </button>
              <button
                type="submit"
                disabled={loading || !cityName.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading || !cityName.trim() ? '#cbd5e1' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: loading || !cityName.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Creating...' : 'Create Squad'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
