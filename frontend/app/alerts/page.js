'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchRadius, setSearchRadius] = useState(25);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('status', 'OPEN');
      params.set('limit', '50');
      if (filter !== 'all') {
        params.set('species', filter.toUpperCase());
      }

      const res = await fetch(`/api/public/missions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.cases || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err.message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlerts();
    }
  }, [status, fetchAlerts]);

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div>Loading alerts...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': return '#dc2626';
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
            <Link href="/dashboard" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem' }}>
              ←
            </Link>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Community Alerts</h1>
              <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>{alerts.length} active in your area</p>
            </div>
          </div>
          <Link href="/report/new" style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc2626',
            borderRadius: '0.5rem',
            color: 'white',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '600',
          }}>
            + Report
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button onClick={fetchAlerts} style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#991b1b',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}>
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Pet Type
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
              Search Radius: {searchRadius} miles
            </label>
            <input type="range" min="1" max="50" value={searchRadius} onChange={(e) => setSearchRadius(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 && !loading ? (
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
              {filter !== 'all' ? 'Try selecting "All" to see more results' : 'No lost pets reported yet'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/alerts/${alert.missionNumber || alert.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  border: '2px solid transparent',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{getSpeciesEmoji(alert.petSpecies)}</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                        {alert.petName || 'Unknown Pet'}
                      </h3>
                      {alert.isUrgent && (
                        <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '600' }}>
                          URGENT
                        </span>
                      )}
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: alert.status === 'OPEN' ? '#fee2e2' : '#d1fae5',
                        color: getStatusColor(alert.status),
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {alert.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {alert.petBreed || alert.petSpecies} • {alert.petColor || 'Unknown color'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
                    <div>{getTimeAgo(alert.lastSeenAt || alert.createdAt)}</div>
                    <div style={{ fontWeight: '600', color: '#2563eb' }}>{alert.missionNumber}</div>
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
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>Last Seen</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {alert.lastSeenLandmark || `${alert.city}, ${alert.state}`}{alert.zipCode && ` (${alert.zipCode})`}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {alert.petDescription && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    <strong style={{ color: '#1f2937' }}>Description:</strong> {alert.petDescription.substring(0, 150)}{alert.petDescription.length > 150 ? '...' : ''}
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
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Case #{alert.missionNumber}</div>
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
