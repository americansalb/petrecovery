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
  const [divisions, setDivisions] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!zipCode.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?zipCode=${zipCode}&radius=${radius}`);
      const data = await res.json();
      setCities(data.cities || []);
      setDivisions(data.divisions || []);
      setSearchLocation(data.searchLocation || null);
      setSearched(true);
    } catch (error) {
      console.error('Error:', error);
      setCities([]);
      setDivisions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (squadId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      if (res.ok) {
        router.push(`/rescue-squads/${squadId}`);
      } else {
        const data = await res.json();
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
        alert(data.error || 'Failed to create squad');
      }
    } catch (error) {
      alert('Error creating squad');
    }
  };

  const handleJoinDivision = async (squadId, divisionId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/join`, {
        method: 'POST'
      });
      if (res.ok) {
        router.push(`/rescue-squads/${squadId}/divisions/${divisionId}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to join division');
      }
    } catch (error) {
      alert('Error joining division');
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

            {/* Divisions Section */}
            {divisions.length > 0 && (
              <div style={{ marginTop: '3rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>
                  📍 Neighborhood Divisions
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {divisions.map((division) => (
                    <div
                      key={division.id}
                      style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        opacity: division.isSquadMember ? 1 : 0.6,
                        border: division.isSquadMember ? '2px solid #e2e8f0' : '2px solid #cbd5e1'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                          {division.name}
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                          {division.squadCity}, {division.squadState} - {division.distance.toFixed(1)} miles away
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                          Part of <strong>{division.squadName}</strong>
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          {division.memberCount} member{division.memberCount !== 1 ? 's' : ''} | {division.activeCases || 0} active cases
                        </p>
                        {division.description && (
                          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                            {division.description}
                          </p>
                        )}
                        {!division.isSquadMember && (
                          <p style={{
                            color: '#f59e0b',
                            fontSize: '0.85rem',
                            marginTop: '0.5rem',
                            fontWeight: '600'
                          }}>
                            ⚠️ Join {division.squadName} first to access this division
                          </p>
                        )}
                      </div>

                      {division.isMember ? (
                        <button
                          onClick={() => router.push(`/rescue-squads/${division.squadId}/divisions/${division.id}`)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          View Division
                        </button>
                      ) : division.isSquadMember ? (
                        <button
                          onClick={() => handleJoinDivision(division.squadId, division.id)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Join Division
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoin(division.squadId)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Join Squad First
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
