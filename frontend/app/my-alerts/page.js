'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MyAlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, found, closed
  const [actionLoading, setActionLoading] = useState(null); // Track which alert is being acted on
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null); // For mark as found confirmation

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
      params.set('myOnly', 'true');
      params.set('limit', '50');

      const res = await fetch(`/api/missions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'WAIVER_NOT_ACCEPTED' && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        }
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
  }, [router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlerts();
    }
  }, [status, fetchAlerts]);

  // Filter alerts client-side based on status
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['OPEN', 'ACTIVE_SEARCH'].includes(alert.status);
    if (filter === 'found') return alert.status === 'RESOLVED';
    if (filter === 'closed') return alert.status === 'CLOSED_OTHER';
    return true;
  });

  const handleMarkAsFound = async (alertId, petName) => {
    setConfirmDialog({ id: alertId, petName });
  };

  const confirmMarkAsFound = async () => {
    if (!confirmDialog) return;

    const { id: alertId, petName } = confirmDialog;
    setConfirmDialog(null);
    setActionLoading(alertId);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/missions/${alertId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          statusReason: 'Pet found and reunited with owner',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'PERMISSION_DENIED') {
          setError('You do not have permission to update this case. Please contact support.');
        } else if (data.code === 'WAIVER_NOT_ACCEPTED' && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        } else {
          throw new Error(data.error || 'Failed to update status');
        }
        return;
      }

      setSuccessMessage(`${petName} has been marked as found! We're so happy you're reunited.`);
      // Refresh the list
      await fetchAlerts();
    } catch (err) {
      console.error('Error marking as found:', err);
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

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
      case 'OPEN':
      case 'ACTIVE_SEARCH':
        return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
      case 'RESOLVED':
        return { bg: '#d1fae5', border: '#10b981', text: '#065f46' };
      case 'CLOSED_OTHER':
        return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
      default:
        return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'OPEN': return 'Open';
      case 'ACTIVE_SEARCH': return 'Active Search';
      case 'RESOLVED': return 'Found';
      case 'CLOSED_OTHER': return 'Closed';
      default: return status;
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
    if (!dateString) return 'Recently';
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

  const isActiveStatus = (status) => ['OPEN', 'ACTIVE_SEARCH'].includes(status);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#1f2937' }}>
              Mark as Found?
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Are you sure you want to mark <strong>{confirmDialog.petName}</strong> as found? This will close the alert and notify the community.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkAsFound}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Mark as Found
              </button>
            </div>
          </div>
        </div>
      )}

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
        {/* Success Message */}
        {successMessage && (
          <div style={{
            backgroundColor: '#d1fae5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#065f46',
                cursor: 'pointer',
                fontSize: '1.25rem',
              }}
            >
              ×
            </button>
          </div>
        )}

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
            <button
              onClick={fetchAlerts}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#991b1b',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '3rem 1rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Loading your alerts...</div>
          </div>
        ) : (
          <>
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
                onClick={() => setFilter('all')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: filter === 'all' ? '#2563eb' : 'transparent',
                  color: filter === 'all' ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                All ({alerts.length})
              </button>
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
            {filteredAlerts.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                padding: '3rem 1rem',
                textAlign: 'center',
                color: '#6b7280',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🐾</div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  No {filter === 'all' ? '' : filter} alerts
                </p>
                <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  {filter === 'active' && "You don't have any active missing pet reports"}
                  {filter === 'found' && "No pets marked as found yet"}
                  {filter === 'closed' && "No closed alerts"}
                  {filter === 'all' && "You haven't reported any lost pets yet"}
                </p>
                {(filter === 'active' || filter === 'all') && (
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
                {filteredAlerts.map((alert) => {
                  const colors = getStatusColor(alert.status);
                  const isLoading = actionLoading === alert.id;
                  return (
                    <div
                      key={alert.id}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        opacity: isLoading ? 0.7 : 1,
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
                              {getSpeciesEmoji(alert.petSpecies)}
                            </span>
                            <h3 style={{
                              fontSize: '1.25rem',
                              fontWeight: 'bold',
                              color: '#1f2937',
                            }}>
                              {alert.petName || 'Unknown Pet'}
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
                              {getStatusLabel(alert.status)}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            marginBottom: '0.25rem',
                          }}>
                            {alert.petBreed || alert.petSpecies} • {alert.petColor || 'Unknown color'}
                          </p>
                          <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                          }}>
                            📍 {alert.lastSeenLandmark || `${alert.city}, ${alert.state}`}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
                          <div>{getDaysAgo(alert.createdAt)}</div>
                          <div style={{ fontWeight: '600', color: '#2563eb' }}>{alert.missionNumber}</div>
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
                            {alert._count?.notes || 0}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontWeight: '600',
                          }}>
                            Updates
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: '#8b5cf6',
                          }}>
                            {alert.force?.name ? '1' : '0'}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontWeight: '600',
                          }}>
                            Forces
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
                        gridTemplateColumns: isActiveStatus(alert.status) ? '1fr 1fr' : '1fr',
                        gap: '0.75rem',
                      }}>
                        <Link
                          href={`/alerts/${alert.missionNumber || alert.id}`}
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
                        {isActiveStatus(alert.status) && (
                          <button
                            onClick={() => handleMarkAsFound(alert.id, alert.petName || 'this pet')}
                            disabled={isLoading}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: isLoading ? '#9ca3af' : '#10b981',
                              color: 'white',
                              textAlign: 'center',
                              borderRadius: '0.5rem',
                              fontWeight: '600',
                              border: 'none',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            {isLoading ? 'Updating...' : '✓ Mark as Found'}
                          </button>
                        )}
                      </div>

                      {alert.status === 'RESOLVED' && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem',
                          backgroundColor: '#d1fae5',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          color: '#065f46',
                          textAlign: 'center',
                        }}>
                          🎉 Reunited! {alert.statusReason || ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
