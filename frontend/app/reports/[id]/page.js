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

  const handleMarkAsFound = async () => {
    if (!confirm('Mark this pet as found?')) return;

    try {
      const res = await fetch('/api/reports/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: params.id }),
      });

      if (res.ok) {
        alert('Pet marked as found! 🎉');
        router.push('/dashboard');
      } else {
        alert('Failed to mark as found. Please try again.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
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

  const { report, pet, reporter, sightings, isOwner } = data;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
      fontFamily: theme.fonts.sans,
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.5rem 2rem',
        boxShadow: theme.shadows.sm,
        borderBottom: '1px solid #f1f5f9',
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
              color: '#1e293b',
              textDecoration: 'none',
            }}
          >
            ← PetRecovery
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
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.radius.lg,
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Mark as Found
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
          </div>
        </div>
      </div>
    </div>
  );
}
