'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MyAlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('active'); // active, found, closed

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // TODO: Fetch from API
    // Mock data
    const mockAlerts = [
      {
        id: 1,
        petName: 'Max',
        species: 'DOG',
        breed: 'Golden Retriever',
        color: 'Golden',
        lastSeenAddress: '123 Main St, Chicago, IL',
        createdAt: '2025-01-13T14:30:00Z',
        status: 'ACTIVE',
        sightingCount: 3,
        viewCount: 45,
      },
      {
        id: 2,
        petName: 'Luna',
        species: 'CAT',
        breed: 'Tabby',
        color: 'Orange & White',
        lastSeenAddress: 'Oak Ave & 5th St',
        createdAt: '2025-01-10T10:15:00Z',
        status: 'ACTIVE',
        sightingCount: 2,
        viewCount: 32,
      },
      {
        id: 6,
        petName: 'Buddy',
        species: 'DOG',
        breed: 'Beagle',
        color: 'Tricolor',
        lastSeenAddress: 'Lincoln Park',
        createdAt: '2024-12-20T08:00:00Z',
        status: 'FOUND',
        sightingCount: 8,
        viewCount: 156,
        foundDate: '2024-12-28T15:30:00Z',
      },
    ];

    let filtered = mockAlerts;
    if (filter === 'active') {
      filtered = mockAlerts.filter(a => a.status === 'ACTIVE');
    } else if (filter === 'found') {
      filtered = mockAlerts.filter(a => a.status === 'FOUND');
    } else if (filter === 'closed') {
      filtered = mockAlerts.filter(a => a.status === 'CLOSED');
    }

    setAlerts(filtered);
  }, [filter]);

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
      case 'ACTIVE': return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
      case 'FOUND': return { bg: '#d1fae5', border: '#10b981', text: '#065f46' };
      case 'CLOSED': return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
      default: return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
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

  const getDaysAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
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
                My Alerts
              </h1>
              <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                Manage your lost pet reports
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
            + New Report
          </Link>
        </div>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1rem',
      }}>
        {/* Filter Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '0.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          gap: '0.5rem',
        }}>
          <button
            onClick={() => setFilter('active')}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: filter === 'active' ? '#dc2626' : 'transparent',
              color: filter === 'active' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('found')}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: filter === 'found' ? '#10b981' : 'transparent',
              color: filter === 'found' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Found
          </button>
          <button
            onClick={() => setFilter('closed')}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: filter === 'closed' ? '#6b7280' : 'transparent',
              color: filter === 'closed' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Closed
          </button>
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
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              No {filter} alerts
            </p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {filter === 'active' && "You don't have any active missing pet reports"}
              {filter === 'found' && "No pets marked as found yet"}
              {filter === 'closed' && "No closed alerts"}
            </p>
            {filter === 'active' && (
              <Link
                href="/report/new"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }}
              >
                Report a Lost Pet
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {alerts.map((alert) => {
              const colors = getStatusColor(alert.status);
              return (
                <div
                  key={alert.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
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
                          padding: '0.25rem 0.75rem',
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `2px solid ${colors.border}`,
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                        }}>
                          {alert.status}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        marginBottom: '0.25rem',
                      }}>
                        {alert.breed} • {alert.color}
                      </p>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                      }}>
                        📍 {alert.lastSeenAddress}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#2563eb',
                      }}>
                        {alert.sightingCount}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        fontWeight: '600',
                      }}>
                        Sightings
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#8b5cf6',
                      }}>
                        {alert.viewCount}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        fontWeight: '600',
                      }}>
                        Views
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#f59e0b',
                      }}>
                        {getDaysAgo(alert.createdAt).split(' ')[0]}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        fontWeight: '600',
                      }}>
                        Days Active
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: alert.status === 'ACTIVE' ? '1fr 1fr' : '1fr',
                    gap: '0.75rem',
                  }}>
                    <Link
                      href={`/alerts/${alert.id}`}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        textAlign: 'center',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                      }}
                    >
                      View Details
                    </Link>
                    {alert.status === 'ACTIVE' && (
                      <button
                        onClick={() => {
                          // TODO: Implement mark as found
                          if (confirm(`Mark ${alert.petName} as found?`)) {
                            alert('This will be implemented with the API');
                          }
                        }}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          textAlign: 'center',
                          borderRadius: '0.5rem',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        ✓ Mark as Found
                      </button>
                    )}
                  </div>

                  {alert.status === 'FOUND' && alert.foundDate && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#d1fae5',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#065f46',
                      textAlign: 'center',
                    }}>
                      🎉 Reunited {getDaysAgo(alert.foundDate)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
