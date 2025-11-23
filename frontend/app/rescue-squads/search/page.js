'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getCitySuggestions, isValidCity, getCityFromZip } from '../../lib/cities';

export default function RescueSquadSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(''); // City name or ZIP code
  const [radius, setRadius] = useState(25);
  const [cities, setCities] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedSquads, setExpandedSquads] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputType, setInputType] = useState(null); // 'zip' or 'city'
  const [validationError, setValidationError] = useState('');

  const handleInputChange = (value) => {
    setSearchTerm(value);
    setValidationError('');

    // Detect input type
    const isZip = /^\d{0,5}$/.test(value);
    setInputType(isZip ? 'zip' : 'city');

    // If it's a city name (not numbers) and at least 2 characters, fetch suggestions
    if (!isZip && value.trim().length >= 2) {
      const citySuggestions = getCitySuggestions(value.trim(), 10);
      setSuggestions(citySuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (city) => {
    setSearchTerm(city.city);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Validate input
    const isZip = /^\d{5}$/.test(searchTerm.trim());
    if (!isZip) {
      // Must be a valid city name
      if (!isValidCity(searchTerm.trim())) {
        setValidationError('Please enter a valid US city name or 5-digit ZIP code');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?search=${encodeURIComponent(searchTerm)}&radius=${radius}`);
      const data = await res.json();

      console.log('🎯 [FRONTEND] Received API response:');
      console.log('   Search term:', searchTerm);
      console.log('   Search location:', data.searchLocation);
      console.log('   Cities array length:', data.cities?.length || 0);
      console.log('   Cities:', data.cities?.map(c => `${c.city}, ${c.state}`).join('; '));

      setCities(data.cities || []);
      setSearchLocation(data.searchLocation || null);
      setSearched(true);
      // Auto-expand squads with divisions
      const newExpanded = new Set();
      (data.cities || []).forEach((city, idx) => {
        if (city.divisions && city.divisions.length > 0) {
          newExpanded.add(idx);
        }
      });
      setExpandedSquads(newExpanded);
    } catch (error) {
      console.error('Error:', error);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (idx) => {
    const newExpanded = new Set(expandedSquads);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedSquads(newExpanded);
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

  const handleJoinDivision = async (squadId, divisionId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    try {
      // First join the squad if not already a member
      const squadRes = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      if (!squadRes.ok && squadRes.status !== 400) { // 400 might mean already a member
        throw new Error('Failed to join squad');
      }

      // Then join the division
      const divRes = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/join`, { method: 'POST' });
      if (divRes.ok) {
        router.push(`/rescue-squads/${squadId}/divisions/${divisionId}`);
      } else {
        const data = await divRes.json();
        alert(data.error || 'Failed to join division');
      }
    } catch (error) {
      alert('Error joining division');
    }
  };

  const handleCreate = async (city, state, zipCode = null) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }

    // If we don't have state (city name search with no existing squad), route to create page
    if (!state) {
      router.push(`/admin/rescue-squads/create?city=${encodeURIComponent(city)}`);
      return;
    }

    try {
      // Validate we have a valid ZIP code
      if (!zipCode || !/^\d{5}$/.test(zipCode)) {
        alert('Unable to create squad: valid ZIP code required. Please search by ZIP code instead.');
        return;
      }

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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Back Button */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#64748b',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem' }}>
          Find Rescue Squads
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>
          Enter a city name or ZIP code to find or create a rescue squad
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: validationError || showSuggestions ? '0.5rem' : '0'
          }}>
            {/* City/ZIP Input */}
            <div style={{ position: 'relative', gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                City Name or ZIP Code
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g., Lynwood or 60411"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  border: `2px solid ${validationError ? '#ef4444' : inputType === 'zip' ? '#3b82f6' : inputType === 'city' ? '#10b981' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                required
              />

              {/* Input type indicator */}
              {inputType && searchTerm.trim() && (
                <div style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '2.5rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: inputType === 'zip' ? '#3b82f6' : '#10b981',
                  background: inputType === 'zip' ? '#dbeafe' : '#d1fae5',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  {inputType === 'zip' ? 'ZIP' : 'City'}
                </div>
              )}

              {/* Validation error */}
              {validationError && (
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.85rem',
                  color: '#ef4444',
                  fontWeight: '600'
                }}>
                  {validationError}
                </div>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  marginTop: '0.5rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {suggestions.map((city, idx) => (
                    <div
                      key={`${city.city}-${city.state_id}-${idx}`}
                      onMouseDown={() => selectSuggestion(city)}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: 'white'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>
                        {city.city}, {city.state_id}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {city.state_name} • {city.zips.length > 0 ? `ZIP ${city.zips[0]}` : 'No ZIP'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Radius */}
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>

            {/* Search Button */}
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Results */}
        {searched && (
          <div>
            {searchLocation && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>
                  {searchLocation.cities && searchLocation.cities.length > 1
                    ? `Rescue Squads for ${searchLocation.cities.join(', ')}, ${searchLocation.state}`
                    : `Rescue Squads near ${searchLocation.cities?.[0] || searchLocation.city}, ${searchLocation.state}`
                  }
                </h2>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Found {cities.filter(c => c.exists).length} rescue squad{cities.filter(c => c.exists).length !== 1 ? 's' : ''} within {radius} miles
                  {cities.filter(c => c.exists).length === 0 && ' - try increasing the search radius or create one for your area'}
                </p>
              </div>
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
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}
                  >
                    {/* Squad Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                          {item.city} Rescue Squad
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                          {item.city}, {item.state} - {item.distance.toFixed(1)} miles away
                        </p>
                        {item.exists && item.squad && (
                          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            {item.squad.memberCount} member{item.squad.memberCount !== 1 ? 's' : ''} | {item.squad.totalCasesAccepted || 0} cases
                            {item.divisions && item.divisions.length > 0 && ` | ${item.divisions.length} divisions`}
                          </p>
                        )}
                      </div>

                      {/* Squad Action Button */}
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
                            Join Squad
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleCreate(item.city, item.state, searchLocation?.zipCode)}
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
                          Create Squad
                        </button>
                      )}
                    </div>

                    {/* Divisions List */}
                    {item.exists && item.divisions && item.divisions.length > 0 && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => toggleExpanded(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#667eea',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <span style={{ fontSize: '1rem' }}>{expandedSquads.has(idx) ? '▼' : '▶'}</span>
                            {item.divisions.length} Neighborhood Division{item.divisions.length !== 1 ? 's' : ''}
                          </button>
                        </div>

                        {expandedSquads.has(idx) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginLeft: '1.5rem' }}>
                            {item.divisions.map(division => (
                              <div
                                key={division.id}
                                style={{
                                  background: '#f8fafc',
                                  borderRadius: '8px',
                                  padding: '0.75rem 1rem',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#0f172a' }}>
                                    {division.name}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    {division.distance.toFixed(1)} mi • {division.totalMembers} members
                                  </div>
                                </div>

                                {/* Division Action Button */}
                                {division.isMember ? (
                                  <button
                                    onClick={() => router.push(`/rescue-squads/${item.squad.id}/divisions/${division.id}`)}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: '#667eea',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    View Division
                                  </button>
                                ) : item.squad.isMember ? (
                                  <button
                                    onClick={() => handleJoinDivision(item.squad.id, division.id)}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Join Division
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    title="Join the rescue squad first"
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: '#e2e8f0',
                                      color: '#94a3b8',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      cursor: 'not-allowed'
                                    }}
                                  >
                                    Join Division
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
