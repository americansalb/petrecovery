'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all'); // all, dogs, cats, birds, other
  const [sortBy, setSortBy] = useState('recent'); // recent, distance
  const [searchRadius, setSearchRadius] = useState(5);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // TODO: Fetch from API
    // Mock data for now
    const mockAlerts = [
      {
        id: 1,
        petName: 'Max',
        species: 'DOG',
        breed: 'Golden Retriever',
        color: 'Golden',
        lastSeenAddress: '123 Main St, Chicago, IL',
        timeAgo: '2 hours ago',
        distance: '0.3 mi',
        status: 'ACTIVE',
        sightingCount: 3,
        reporterName: 'Sarah M.',
        distinctiveMarks: 'White patch on chest',
      },
      {
        id: 2,
        petName: 'Luna',
        species: 'CAT',
        breed: 'Tabby',
        color: 'Orange & White',
        lastSeenAddress: 'Oak Ave & 5th St',
        timeAgo: '5 hours ago',
        distance: '0.8 mi',
        status: 'ACTIVE',
        sightingCount: 2,
        reporterName: 'John D.',
        distinctiveMarks: 'Green collar with bell',
      },
      {
        id: 3,
        petName: 'Buddy',
        species: 'DOG',
        breed: 'Beagle',
        color: 'Tricolor',
        lastSeenAddress: 'Lincoln Park',
        timeAgo: '1 day ago',
        distance: '1.2 mi',
        status: 'ACTIVE',
        sightingCount: 5,
        reporterName: 'Mike R.',
        distinctiveMarks: 'Floppy ears, very friendly',
      },
      {
        id: 4,
        petName: 'Whiskers',
        species: 'CAT',
        breed: 'Siamese',
        color: 'Cream & Brown',
        lastSeenAddress: 'Elm St near park',
        timeAgo: '2 days ago',
        distance: '1.8 mi',
        status: 'ACTIVE',
        sightingCount: 1,
        reporterName: 'Emily W.',
        distinctiveMarks: 'Blue eyes, loud meow',
      },
      {
        id: 5,
        petName: 'Rocky',
        species: 'DOG',
        breed: 'German Shepherd',
        color: 'Black & Tan',
        lastSeenAddress: 'Downtown area',
        timeAgo: '3 days ago',
        distance: '2.3 mi',
        status: 'ACTIVE',
        sightingCount: 7,
        reporterName: 'David L.',
        distinctiveMarks: 'Missing part of left ear',
      },
    ];

    let filtered = mockAlerts;

    // Filter by species
    if (filter !== 'all') {
      filtered = filtered.filter(alert => alert.species === filter.toUpperCase());
    }

    setAlerts(filtered);
  }, [filter, sortBy, searchRadius]);

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#dc2626';
      case 'FOUND': return '#10b981';
      case 'CLOSED': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getSpeciesEmoji = (species) => {
    switch (species) {
      case 'DOG': return '🐕';
      case 'CAT': return '🐈';
      case 'BIRD': return '🦜';
      default: return '🐾';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/dashboard"
              style={{
                color: 'white',
                textDecoration: 'none',
                fontSize: '1.5rem',
              }}
            >
              ←
            </Link>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                Community Alerts
              </h1>
              <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                {alerts.length} active in your area
              </p>
            </div>
          </div>
          <Link
            href="/report/new"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              borderRadius: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            + Report
          </Link>
        </div>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1rem',
      }}>
        {/* Filters */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Pet Type
            </label>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}>
              {['all', 'dog', 'cat', 'bird', 'other'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: filter === type ? '#2563eb' : '#e5e7eb',
                    color: filter === type ? 'white' : '#1f2937',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Search Radius: {searchRadius} miles
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              style={{
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '3rem 1rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🐾</div>
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>No alerts found</p>
            <p style={{ fontSize: '0.875rem' }}>
              Try adjusting your filters or search radius
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/alerts/${alert.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  border: '2px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem',
                }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>
                        {getSpeciesEmoji(alert.species)}
                      </span>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#1f2937',
                      }}>
                        {alert.petName}
                      </h3>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fee2e2',
                        color: getStatusColor(alert.status),
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {alert.status}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                    }}>
                      {alert.breed} • {alert.color}
                    </p>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                  }}>
                    <div>{alert.timeAgo}</div>
                    <div style={{ fontWeight: '600', color: '#2563eb' }}>
                      {alert.distance}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                }}>
                  <span style={{ fontSize: '1rem' }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '0.25rem',
                    }}>
                      Last Seen
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                    }}>
                      {alert.lastSeenAddress}
                    </div>
                  </div>
                </div>

                {/* Distinctive Marks */}
                {alert.distinctiveMarks && (
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0.75rem',
                  }}>
                    <strong style={{ color: '#1f2937' }}>Distinctive marks:</strong> {alert.distinctiveMarks}
                  </div>
                )}

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb',
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                  }}>
                    Reported by {alert.reporterName}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    {alert.sightingCount > 0 && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                      }}>
                        👁️ {alert.sightingCount} sighting{alert.sightingCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}>
                      View Details →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
