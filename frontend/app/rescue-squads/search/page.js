'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RescueSquadSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(25);
  const [cities, setCities] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [legalError, setLegalError] = useState(null); // { message, redirectTo }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!zipCode.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?zipCode=${zipCode}&radius=${radius}`);
      const data = await res.json();
      setCities(data.cities || []);
      setSearchLocation(data.searchLocation || null);
      setSearched(true);
    } catch (error) {
      console.error('Error:', error);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (squadId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    setLegalError(null);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        router.push(`/rescue-squads/${squadId}`);
      } else {
        // Check for legal consent requirement (Phase 0: Legal Baseline)
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          // Scroll to top to show banner
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        alert(data.error || 'Failed to join');
      }
    } catch (error) {
      alert('Error joining squad');
    }
  };

  const handleCreate = async (city, state) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    setLegalError(null);
    try {
      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, zipCode }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push(`/rescue-squads/${data.squad.id}`);
      } else {
        // Check for legal consent requirement (Phase 0: Legal Baseline)
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          // Scroll to top to show banner
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        alert(data.error || 'Failed to create squad');
      }
    } catch (error) {
      alert('Error creating squad');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem' }}>
          Find Rescue Squads
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>
          Enter your zip code to find or create a rescue squad in your area
        </p>

        {/* Legal Consent Required Banner */}
        {legalError && (
          <div style={{
            padding: '1.5rem',
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                  Legal Agreement Required
                </div>
                <div style={{ color: '#b45309', fontSize: '0.95rem' }}>
                  {legalError.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(legalError.redirectTo)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Review & Accept Now →
            </button>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: '2rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'end',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Zip Code</label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="Enter zip code"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
              required
            />
          </div>
          <div style={{ minWidth: '120px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Radius</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            >
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results */}
        {searched && (
          <div>
            {searchLocation && (
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
                Rescue Squads near {searchLocation.city}, {searchLocation.state}
              </h2>
            )}

            {cities.length === 0 ? (
              <p style={{ color: '#64748b' }}>No results found</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cities.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        {item.city} Rescue Squad
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        {item.city}, {item.state} - {item.distance.toFixed(1)} miles away
                      </p>
                      {item.exists && item.squad && (
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          {item.squad.memberCount} member{item.squad.memberCount !== 1 ? 's' : ''} | {item.squad.totalCasesAccepted || 0} cases
                        </p>
                      )}
                    </div>

                    {item.exists && item.squad ? (
                      item.squad.isMember ? (
                        <button
                          onClick={() => router.push(`/rescue-squads/${item.squad.id}`)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          View Squad
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoin(item.squad.id)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Join
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleCreate(item.city, item.state)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Create
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
