'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RescueSquadSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [zipCode, setZipCode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!zipCode.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?zipCode=${zipCode}&radiusMiles=${radiusMiles}`);
      const data = await res.json();
      setSquads(data.squads || []);
      setSearched(true);
    } catch (error) {
      console.error('Error searching squads:', error);
      setSquads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSquad = async (squadId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/join`, {
        method: 'POST'
      });

      if (res.ok) {
        router.push(`/rescue-squads/${squadId}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to join squad');
      }
    } catch (error) {
      alert('Error joining squad');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '1rem'
          }}>
            🚑 Find Rescue Squads Near You
          </h1>
          <p style={{
            fontSize: '1.2rem',
            color: '#64748b',
            marginBottom: '2rem'
          }}>
            Join a local rescue squad to help find lost pets in your area
          </p>
          <Link
            href="/rescue-squads/create"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: '#10b981',
              color: 'white',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '1.1rem'
            }}
          >
            + Create New Squad
          </Link>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
          marginBottom: '3rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 200px auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontWeight: '700',
                marginBottom: '0.5rem',
                color: '#0f172a'
              }}>
                Zip Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter your zip code"
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none'
                }}
                required
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontWeight: '700',
                marginBottom: '0.5rem',
                color: '#0f172a'
              }}>
                Radius (miles)
              </label>
              <select
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '1rem 2.5rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1.1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Results */}
        {searched && (
          <div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              {squads.length > 0
                ? `Found ${squads.length} squad${squads.length === 1 ? '' : 's'}`
                : 'No squads found in your area'}
            </h2>

            {squads.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '4rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚑</div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.5rem'
                }}>
                  No rescue squads nearby
                </h3>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                  Be the first to create a rescue squad in your area!
                </p>
                <Link
                  href="/rescue-squads/create"
                  style={{
                    display: 'inline-block',
                    padding: '1rem 2rem',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '700'
                  }}
                >
                  Create First Squad
                </Link>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                {squads.map(squad => (
                  <div
                    key={squad.id}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '2rem',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                      border: '2px solid #f1f5f9'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '2rem',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontSize: '1.75rem',
                          fontWeight: '700',
                          color: '#0f172a',
                          marginBottom: '0.5rem'
                        }}>
                          {squad.name}
                        </h3>
                        <div style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          background: '#ede9fe',
                          color: '#5b21b6',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          marginBottom: '0.75rem'
                        }}>
                          📍 {squad.city}, {squad.state}
                        </div>
                        <div style={{
                          fontSize: '1rem',
                          color: '#64748b',
                          marginBottom: '1rem'
                        }}>
                          📍 {squad.distance.toFixed(1)} miles away
                        </div>

                        {squad.description && (
                          <p style={{
                            color: '#475569',
                            lineHeight: '1.6',
                            marginBottom: '1.5rem'
                          }}>
                            {squad.description}
                          </p>
                        )}

                        <div style={{
                          display: 'flex',
                          gap: '2rem',
                          flexWrap: 'wrap',
                          padding: '1rem 0',
                          borderTop: '1px solid #f1f5f9',
                          fontSize: '0.95rem',
                          color: '#64748b'
                        }}>
                          <div>
                            <strong style={{ color: '#0f172a' }}>{squad.memberCount}</strong> members
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a' }}>{squad.totalCasesAccepted}</strong> cases
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a' }}>{squad.successfulReunions}</strong> reunions
                          </div>
                          <div>
                            Level: <strong style={{ color: '#667eea' }}>{squad.rescueSquadLevel}</strong>
                          </div>
                        </div>

                        <div style={{
                          marginTop: '1rem',
                          fontSize: '0.9rem',
                          color: '#64748b'
                        }}>
                          Specializes in: {squad.specializesInDogs && squad.specializesInCats ? 'Dogs & Cats' : squad.specializesInDogs ? 'Dogs' : 'Cats'}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        {squad.isMember ? (
                          <>
                            <div style={{
                              padding: '1rem 2rem',
                              background: '#d1fae5',
                              color: '#065f46',
                              borderRadius: '8px',
                              fontWeight: '700',
                              textAlign: 'center'
                            }}>
                              ✓ Member
                            </div>
                            <Link
                              href={`/rescue-squads/${squad.id}`}
                              style={{
                                padding: '1rem 2rem',
                                background: '#667eea',
                                color: 'white',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontWeight: '700',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              View Squad →
                            </Link>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleJoinSquad(squad.id)}
                              style={{
                                padding: '1rem 2rem',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Join Squad
                            </button>
                            <Link
                              href={`/rescue-squads/${squad.id}`}
                              style={{
                                padding: '1rem 2rem',
                                background: '#f1f5f9',
                                color: '#64748b',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontWeight: '700',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              View Details
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
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
