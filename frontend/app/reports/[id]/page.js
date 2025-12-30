'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { theme } from '../../lib/theme';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${params.id}`);
        if (!res.ok) {
          throw new Error('Report not found');
        }
        const data = await res.json();
        setData(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    if (params.id) {
      fetchReport();
    }
  }, [params.id]);

  // Initialize map
  useEffect(() => {
    if (!data || !mapRef.current || mapInstanceRef.current) return;

    const center = [data.report.lastSeenLatitude, data.report.lastSeenLongitude];

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current).setView(center, 14);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Add marker for last seen location
      L.marker(center).addTo(map)
        .bindPopup(data.report.reportType === 'LOST' ? 'Last Seen Here' : 'Found Here')
        .openPopup();

      // Add circle for search radius
      if (data.report.reportType === 'LOST') {
        L.circle(center, {
          color: '#dc2626',
          fillColor: '#dc2626',
          fillOpacity: 0.1,
          radius: data.report.searchRadius * 1609.34, // Convert miles to meters
        }).addTo(map);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  const handleMarkAsFound = () => {
    setConfirmDialog(true);
  };

  const confirmMarkAsFound = async () => {
    setConfirmDialog(false);
    setActionLoading(true);
    setActionError('');

    try {
      const res = await fetch('/api/reports/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: params.id }),
      });

      if (res.ok) {
        setSuccessMessage(`${data?.pet?.name || 'Pet'} has been marked as found! We're so happy you're reunited.`);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        const errData = await res.json();
        setActionError(errData.error || 'Failed to mark as found. Please try again.');
      }
    } catch (err) {
      setActionError('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #dc2626',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite',
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: theme.colors.gray[600] }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: theme.radius.xl,
          padding: '3rem',
          boxShadow: theme.shadows.lg,
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😕</div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: theme.colors.gray[900],
          }}>
            Report Not Found
          </h1>
          <p style={{
            fontSize: '1.05rem',
            color: theme.colors.gray[600],
            marginBottom: '2rem',
          }}>
            {error || 'This report doesn\'t exist or has been removed.'}
          </p>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: '#dc2626',
              color: 'white',
              borderRadius: theme.radius.lg,
              textDecoration: 'none',
              fontWeight: '700',
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { report, pet, reporter, sightings, potentialMatches, isOwner, missionControl, rescueSquads } = data;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      fontFamily: theme.fonts.sans,
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
            borderRadius: theme.radius.xl,
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: theme.shadows.xl,
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: theme.colors.gray[900] }}>
              Mark as Found?
            </h3>
            <p style={{ color: theme.colors.gray[600], marginBottom: '1.5rem' }}>
              Are you sure you want to mark <strong>{pet?.name || 'this pet'}</strong> as found? This will close the alert and notify the community.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmDialog(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: theme.radius.lg,
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
                  borderRadius: theme.radius.lg,
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

      {/* Success Message */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#d1fae5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '1rem 2rem',
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadows.lg,
          zIndex: 100,
          textAlign: 'center',
        }}>
          🎉 {successMessage}
        </div>
      )}

      {/* Action Error */}
      {actionError && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '1rem 2rem',
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadows.lg,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontSize: '1.25rem',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: '#0f172a',  // midnight-900
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
        borderBottom: '1px solid #1e293b', // midnight-800
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: 'white',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ color: '#fbbf24' }}>←</span> Reunite<span style={{ color: '#fbbf24' }}>Pets</span>
          </Link>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 2rem',
      }}>
        {/* Report Type Badge */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-block',
            padding: '0.5rem 1.5rem',
            background: report.reportType === 'LOST' ? '#dc2626' : '#10b981',
            color: 'white',
            borderRadius: theme.radius.lg,
            fontSize: '0.9rem',
            fontWeight: '700',
          }}>
            {report.reportType === 'LOST' ? '🚨 LOST PET' : '🎉 FOUND PET'}
          </div>
        </div>

        {/* Mission Control Banner */}
        {(missionControl || rescueSquads?.length > 0) && (
          <Link
            href={`/mission-control?caseId=${report.id}`}
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
              borderRadius: theme.radius.xl,
              padding: '1.5rem 2rem',
              marginBottom: '2rem',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              border: '2px solid rgba(255, 206, 71, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(255, 206, 71, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 206, 71, 0.3)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {/* Icon */}
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #FFCE47 0%, #f59e0b 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                flexShrink: 0,
              }}>
                🎯
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  color: 'white',
                  marginBottom: '0.25rem',
                }}>
                  Mission Control Active
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}>
                  {rescueSquads?.length > 0 ? (
                    <>Managed by <strong style={{ color: '#FFCE47' }}>{rescueSquads.map(s => s.name).join(', ')}</strong></>
                  ) : (
                    'Coordinate the search effort'
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div style={{
                fontSize: '1.5rem',
                color: '#FFCE47',
                fontWeight: 'bold',
              }}>
                →
              </div>
            </div>
          </Link>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr',
          }
        }}>
          {/* Left Column - Pet Info */}
          <div>
            {/* Pet Photo */}
            {pet.primaryPhotoUrl && (
              <div style={{
                background: 'white',
                borderRadius: theme.radius.xl,
                padding: '1.5rem',
                marginBottom: '2rem',
                boxShadow: theme.shadows.md,
              }}>
                <img
                  src={pet.primaryPhotoUrl}
                  alt={pet.name}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: theme.radius.lg,
                    maxHeight: '500px',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            {/* Pet Details */}
            <div style={{
              background: 'white',
              borderRadius: theme.radius.xl,
              padding: '2.5rem',
              boxShadow: theme.shadows.md,
              marginBottom: '2rem',
            }}>
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '900',
                marginBottom: '1rem',
                color: theme.colors.gray[900],
              }}>
                {pet.name}
              </h1>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: theme.colors.gray[500],
                    marginBottom: '0.25rem',
                  }}>
                    SPECIES
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: theme.colors.gray[900],
                  }}>
                    {pet.species}
                  </div>
                </div>

                {pet.breed && (
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: theme.colors.gray[500],
                      marginBottom: '0.25rem',
                    }}>
                      BREED
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: theme.colors.gray[900],
                    }}>
                      {pet.breed}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: theme.colors.gray[500],
                    marginBottom: '0.25rem',
                  }}>
                    COLOR
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: theme.colors.gray[900],
                  }}>
                    {pet.color}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: theme.colors.gray[500],
                    marginBottom: '0.25rem',
                  }}>
                    SIZE
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: theme.colors.gray[900],
                  }}>
                    {pet.size}
                  </div>
                </div>

                {pet.distinctiveMarks && (
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: theme.colors.gray[500],
                      marginBottom: '0.25rem',
                    }}>
                      DISTINCTIVE MARKS
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: theme.colors.gray[900],
                    }}>
                      {pet.distinctiveMarks}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div style={{
              background: 'white',
              borderRadius: theme.radius.xl,
              padding: '2.5rem',
              boxShadow: theme.shadows.md,
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                marginBottom: '1.5rem',
                color: theme.colors.gray[900],
              }}>
                Contact Information
              </h2>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: theme.colors.gray[500],
                    marginBottom: '0.25rem',
                  }}>
                    NAME
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: theme.colors.gray[900],
                  }}>
                    {reporter.firstName}
                  </div>
                </div>

                {isOwner && reporter.email && (
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: theme.colors.gray[500],
                      marginBottom: '0.25rem',
                    }}>
                      EMAIL
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: theme.colors.gray[900],
                    }}>
                      <a href={`mailto:${reporter.email}`} style={{ color: '#0ea5e9' }}>
                        {reporter.email}
                      </a>
                    </div>
                  </div>
                )}

                {isOwner && reporter.phone && (
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: theme.colors.gray[500],
                      marginBottom: '0.25rem',
                    }}>
                      PHONE
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: theme.colors.gray[900],
                    }}>
                      <a href={`tel:${reporter.phone}`} style={{ color: '#0ea5e9' }}>
                        {reporter.phone}
                      </a>
                    </div>
                  </div>
                )}

                {!isOwner && (
                  <div style={{
                    background: '#fef2f2',
                    border: '2px solid #fca5a5',
                    borderRadius: theme.radius.md,
                    padding: '1rem',
                    fontSize: '0.9rem',
                    color: '#991b1b',
                  }}>
                    💡 Contact information is only visible to the pet owner
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Location & Actions */}
          <div>
            {/* Location Map */}
            <div style={{
              background: 'white',
              borderRadius: theme.radius.xl,
              padding: '2.5rem',
              boxShadow: theme.shadows.md,
              marginBottom: '2rem',
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                marginBottom: '1rem',
                color: theme.colors.gray[900],
              }}>
                {report.reportType === 'LOST' ? 'Last Seen Location' : 'Found Location'}
              </h2>

              <div style={{
                fontSize: '1.05rem',
                color: theme.colors.gray[600],
                marginBottom: '1.5rem',
              }}>
                📍 {report.lastSeenAddress}
              </div>

              <div style={{
                fontSize: '1rem',
                color: theme.colors.gray[600],
                marginBottom: '1.5rem',
              }}>
                ⏰ {new Date(report.lastSeenAt).toLocaleString()}
              </div>

              <div
                ref={mapRef}
                style={{
                  height: '400px',
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                }}
              />
            </div>

            {/* Actions */}
            {isOwner && report.reportType === 'LOST' && report.status === 'ACTIVE' && (
              <div style={{
                background: 'white',
                borderRadius: theme.radius.xl,
                padding: '2.5rem',
                boxShadow: theme.shadows.md,
                marginBottom: '2rem',
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  marginBottom: '1.5rem',
                  color: theme.colors.gray[900],
                }}>
                  Actions
                </h2>

                <button
                  onClick={handleMarkAsFound}
                  disabled={actionLoading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: actionLoading ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.radius.lg,
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Updating...' : '✓ Mark as Found'}
                </button>
              </div>
            )}

            {/* Sightings */}
            {sightings.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: theme.radius.xl,
                padding: '2.5rem',
                boxShadow: theme.shadows.md,
                marginBottom: '2rem',
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  marginBottom: '1.5rem',
                  color: theme.colors.gray[900],
                }}>
                  Recent Sightings ({sightings.length})
                </h2>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {sightings.map((sighting) => (
                    <div
                      key={sighting.id}
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        borderRadius: theme.radius.md,
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{
                        fontSize: '0.85rem',
                        color: theme.colors.gray[500],
                        marginBottom: '0.5rem',
                      }}>
                        {new Date(sighting.sightedAt).toLocaleString()} • by {sighting.reportedBy}
                      </div>
                      <div style={{
                        fontSize: '1rem',
                        color: theme.colors.gray[900],
                        marginBottom: '0.5rem',
                      }}>
                        📍 {sighting.address}
                      </div>
                      <div style={{
                        fontSize: '0.95rem',
                        color: theme.colors.gray[700],
                      }}>
                        {sighting.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Potential Matches (for FOUND pets) */}
            {potentialMatches && potentialMatches.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: theme.radius.xl,
                padding: '2.5rem',
                boxShadow: theme.shadows.md,
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  marginBottom: '1rem',
                  color: theme.colors.gray[900],
                }}>
                  🔍 Potential Matches - Nearby Lost Pets
                </h2>
                <p style={{
                  fontSize: '1rem',
                  color: theme.colors.gray[600],
                  marginBottom: '2rem',
                }}>
                  These pets were reported lost near where you found this pet. Could this be one of them?
                </p>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {potentialMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/reports/${match.id}`}
                      style={{
                        display: 'block',
                        padding: '1.5rem',
                        background: '#fef2f2',
                        borderRadius: theme.radius.lg,
                        border: '2px solid #fca5a5',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        alignItems: 'flex-start',
                      }}>
                        {match.primaryPhotoUrl && (
                          <img
                            src={match.primaryPhotoUrl}
                            alt={match.petName}
                            style={{
                              width: '120px',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: theme.radius.md,
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            background: '#dc2626',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            marginBottom: '0.75rem',
                          }}>
                            LOST • {match.distance} miles away
                          </div>
                          <h3 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            marginBottom: '0.5rem',
                            color: theme.colors.gray[900],
                          }}>
                            {match.petName}
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                          }}>
                            <div>
                              <span style={{ color: theme.colors.gray[500], fontSize: '0.9rem' }}>Breed: </span>
                              <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>{match.breed || 'Unknown'}</span>
                            </div>
                            <div>
                              <span style={{ color: theme.colors.gray[500], fontSize: '0.9rem' }}>Color: </span>
                              <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>{match.color}</span>
                            </div>
                            <div>
                              <span style={{ color: theme.colors.gray[500], fontSize: '0.9rem' }}>Size: </span>
                              <span style={{ color: theme.colors.gray[900], fontWeight: '600' }}>{match.size}</span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.95rem',
                            color: theme.colors.gray[600],
                            marginBottom: '0.5rem',
                          }}>
                            📍 Last seen: {match.lastSeenAddress}
                          </div>
                          <div style={{
                            fontSize: '0.95rem',
                            color: theme.colors.gray[900],
                            fontWeight: '600',
                          }}>
                            Owner: {match.reporterName} • {match.reporterPhone}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
