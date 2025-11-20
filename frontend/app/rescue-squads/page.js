'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RescueSquadsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [searchMode, setSearchMode] = useState('nearby'); // Default to 'nearby' for new users

  useEffect(() => {
    fetchSquads();
  }, [searchMode]);

  const fetchSquads = async () => {
    try {
      setLoading(true);

      // For nearby mode, require ZIP code
      if (searchMode === 'nearby' && !zipCode) {
        setSquads([]);
        setLoading(false);
        return;
      }

      let url = '/api/rescue-squads';

      if (searchMode === 'nearby' && zipCode) {
        url += `?zip=${zipCode}&radius=${radiusMiles}`;
      } else if (searchMode === 'all') {
        // Load all squads only if explicitly requested
        url += '?lat=0&lng=0&radius=999999'; // Hack to get all
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSquads(data.squads || []);
      }
    } catch (error) {
      console.error('Error fetching rescue squads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleZipSearch = (e) => {
    e.preventDefault();
    if (zipCode.length === 5) {
      setSearchMode('nearby');
      fetchSquads();
    }
  };

  // Filter squads by search query
  const filteredSquads = squads.filter(squad => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      squad.name.toLowerCase().includes(query) ||
      (squad.description && squad.description.toLowerCase().includes(query))
    );
  });

  // Filter by user's membership
  const mySquads = filteredSquads.filter(s =>
    s.members?.some(m => m.userId === session?.user?.id && m.isActive)
  );

  const displaySquads = searchMode === 'mine' ? mySquads : filteredSquads;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading Rescue Squads...</div>
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
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              Rescue Squads
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Find and join volunteer rescue squads in your area
            </p>
          </div>

          <Link
            href="/"
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
            ← Home
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
          <form onSubmit={handleZipSearch} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#0f172a',
                fontSize: '0.9rem'
              }}>
                Enter Your ZIP Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 60110"
                maxLength={5}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#0f172a',
                fontSize: '0.9rem'
              }}>
                Within (miles)
              </label>
              <select
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem'
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
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Find Squads
            </button>
          </form>

          {session && mySquads.length > 0 && (
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #f1f5f9'
            }}>
              <button
                onClick={() => setSearchMode('mine')}
                style={{
                  padding: '0.5rem 1rem',
                  background: searchMode === 'mine' ? '#667eea' : '#f1f5f9',
                  color: searchMode === 'mine' ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                View My Squads ({mySquads.length})
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        {zipCode && searchMode === 'nearby' && (
          <div style={{
            marginBottom: '1.5rem',
            fontSize: '0.95rem',
            color: '#64748b',
            fontWeight: '600'
          }}>
            Found {displaySquads.length} rescue squad{displaySquads.length !== 1 ? 's' : ''} within {radiusMiles} miles of {zipCode}
          </div>
        )}
        {searchMode === 'mine' && (
          <div style={{
            marginBottom: '1.5rem',
            fontSize: '0.95rem',
            color: '#64748b',
            fontWeight: '600'
          }}>
            Your Squads ({mySquads.length})
          </div>
        )}

        {/* Squads Grid */}
        {displaySquads.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚁</div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              {!zipCode && searchMode === 'nearby' ? 'Enter Your ZIP Code' : 'No Squads Found'}
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {!zipCode && searchMode === 'nearby'
                ? 'Enter your ZIP code above to find rescue squads in your area.'
                : searchMode === 'mine'
                ? "You haven't joined any rescue squads yet. Search by ZIP to find one near you."
                : zipCode
                ? `No squads within ${radiusMiles} miles of ${zipCode}. Be the first to create one!`
                : "Enter your ZIP code to find rescue squads"}
            </p>
            {session && zipCode && searchMode === 'nearby' && (
              <Link
                href="/rescue-squads/create"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '700'
                }}
              >
                Create Rescue Squad for Your City
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.5rem'
          }}>
            {displaySquads.map(squad => {
              const isMember = squad.members?.some(m =>
                m.userId === session?.user?.id && m.isActive
              );

              return (
                <div
                  key={squad.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    border: '2px solid #f1f5f9',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#f1f5f9';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '1.4rem',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '0.25rem'
                      }}>
                        {squad.name}
                      </h3>
                      {squad.distance && (
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#10b981',
                          fontWeight: '600'
                        }}>
                          📍 {squad.distance.toFixed(1)} miles away
                        </div>
                      )}
                    </div>

                    {isMember && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '700'
                      }}>
                        Joined
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {squad.description && (
                    <p style={{
                      color: '#64748b',
                      marginBottom: '1rem',
                      fontSize: '0.95rem',
                      lineHeight: '1.5'
                    }}>
                      {squad.description.slice(0, 120)}
                      {squad.description.length > 120 && '...'}
                    </p>
                  )}

                  {/* Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    padding: '1rem 0',
                    borderTop: '1px solid #f1f5f9',
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
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

                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {squad.successfulReunions}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Reunions
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {squad._count?.caseAssignments || 0}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Cases
                      </div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    fontSize: '0.85rem'
                  }}>
                    {squad.hasTrackingDogs && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        🦮 Tracking Dogs
                      </span>
                    )}
                    {squad.hasDrones && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        🚁 Drones
                      </span>
                    )}
                    {squad.availability247 && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        ⏰ 24/7
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
