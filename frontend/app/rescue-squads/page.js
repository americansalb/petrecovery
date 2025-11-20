'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RescueSquadsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (zipCode.length !== 5) return;

    try {
      setLoading(true);
      setSearched(true);

      const url = `/api/rescue-squads?zip=${zipCode}&radius=${radiusMiles}&sortBy=distance`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        setSquads(data.squads || []);

        // Extract city name from first squad or geocode result
        if (data.squads && data.squads.length > 0 && data.squads[0].city) {
          setCityName(data.squads[0].city);
        } else {
          // Geocode to get city name
          const geocodeRes = await fetch(`/api/geocode/zip/${zipCode}`);
          if (geocodeRes.ok) {
            const geocodeData = await geocodeRes.json();
            setCityName(geocodeData.cityName || 'Your Area');
          } else {
            setCityName('Your Area');
          }
        }
      }
    } catch (error) {
      console.error('Error searching rescue squads:', error);
      setSquads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (squadId) => {
    if (!session) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        // Refresh the list
        handleSearch({ preventDefault: () => {} });
      } else {
        alert('Failed to join squad. Please try again.');
      }
    } catch (error) {
      alert('Error joining squad: ' + error.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            Find Your Rescue Squad
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            marginBottom: '1rem'
          }}>
            Search by ZIP code to find or create a rescue squad in your community
          </p>
          <Link
            href="/"
            style={{
              fontSize: '0.9rem',
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            ← Back to Home
          </Link>
        </div>

        {/* Search Box */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <form onSubmit={handleSearch} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a',
                fontSize: '1rem'
              }}>
                Enter Your ZIP Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 60110"
                maxLength={5}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1.2rem',
                  fontWeight: '600'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '700',
                color: '#0f172a',
                fontSize: '1rem'
              }}>
                Radius
              </label>
              <select
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
                <option value={100}>100 miles</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '1rem 2rem',
                background: loading ? '#cbd5e1' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <>
            {squads.length === 0 ? (
              /* No Results - Show Create Option */
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '3rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚁</div>
                <h2 style={{
                  fontSize: '1.8rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.75rem'
                }}>
                  No Rescue Squads Found
                </h2>
                <p style={{
                  color: '#64748b',
                  fontSize: '1.1rem',
                  marginBottom: '2rem'
                }}>
                  No squads within {radiusMiles} miles of ZIP {zipCode}.
                  <br />
                  Be the first to create <strong>{cityName} Rescue Squad</strong>!
                </p>
                {session ? (
                  <Link
                    href={`/rescue-squads/create?zip=${zipCode}`}
                    style={{
                      display: 'inline-block',
                      padding: '1rem 2.5rem',
                      background: '#10b981',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      fontSize: '1.1rem'
                    }}
                  >
                    Create {cityName} Rescue Squad
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    style={{
                      display: 'inline-block',
                      padding: '1rem 2.5rem',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: '700',
                      fontSize: '1.1rem'
                    }}
                  >
                    Sign In to Create Squad
                  </Link>
                )}
              </div>
            ) : (
              /* Show Results */
              <>
                <div style={{
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    {squads.length} Squad{squads.length !== 1 ? 's' : ''} Found
                  </h2>
                  {session && (
                    <Link
                      href={`/rescue-squads/create?zip=${zipCode}`}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '0.9rem'
                      }}
                    >
                      + Create New Squad
                    </Link>
                  )}
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {squads.map(squad => {
                    const isMember = squad.members?.some(m =>
                      m.userId === session?.user?.id && m.isActive
                    );

                    return (
                      <div
                        key={squad.id}
                        style={{
                          background: 'white',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                          border: '2px solid #f1f5f9'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          gap: '1rem'
                        }}>
                          {/* Squad Info */}
                          <div style={{ flex: 1 }}>
                            <h3 style={{
                              fontSize: '1.4rem',
                              fontWeight: '700',
                              color: '#0f172a',
                              marginBottom: '0.5rem'
                            }}>
                              {squad.name}
                            </h3>
                            {squad.distance && (
                              <div style={{
                                fontSize: '0.9rem',
                                color: '#10b981',
                                fontWeight: '600',
                                marginBottom: '0.75rem'
                              }}>
                                📍 {squad.distance.toFixed(1)} miles away
                              </div>
                            )}

                            {/* Stats */}
                            <div style={{
                              display: 'flex',
                              gap: '2rem',
                              marginTop: '1rem'
                            }}>
                              <div>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: '700',
                                  color: '#0f172a'
                                }}>
                                  {squad._count?.members || 0}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  Members
                                </div>
                              </div>
                              <div>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: '700',
                                  color: '#0f172a'
                                }}>
                                  {squad.successfulReunions || 0}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  Reunions
                                </div>
                              </div>
                              <div>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: '700',
                                  color: '#0f172a'
                                }}>
                                  {squad._count?.caseAssignments || 0}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  Active Cases
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            alignItems: 'flex-end'
                          }}>
                            {isMember ? (
                              <>
                                <span style={{
                                  padding: '0.5rem 1rem',
                                  background: '#d1fae5',
                                  color: '#065f46',
                                  borderRadius: '8px',
                                  fontSize: '0.9rem',
                                  fontWeight: '700'
                                }}>
                                  ✓ Joined
                                </span>
                                <button
                                  onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                                  style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                  }}
                                >
                                  View Squad →
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleJoin(squad.id)}
                                  style={{
                                    padding: '1rem 2rem',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Join Squad
                                </button>
                                <button
                                  onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: 'white',
                                    color: '#667eea',
                                    border: '2px solid #667eea',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  View Details
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
