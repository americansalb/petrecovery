'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function AlertDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const alertId = params.id;

  const [alert, setAlert] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [activeTab, setActiveTab] = useState('details'); // details, sightings, updates

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchAlert = async () => {
      try {
        const res = await fetch(`/api/public/cases/${alertId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch alert');
        }
        const data = await res.json();
        const caseData = data.case;

        // Calculate time ago
        const createdDate = new Date(caseData.lastSeenAt || caseData.createdAt);
        const now = new Date();
        const diffMs = now - createdDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        let timeAgo = diffHours < 1 ? 'Less than an hour ago' :
                      diffHours < 24 ? `${diffHours} hour${diffHours > 1 ? 's' : ''} ago` :
                      `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        setAlert({
          id: caseData.id,
          caseNumber: caseData.caseNumber,
          petName: caseData.petName || 'Unknown',
          species: caseData.petSpecies || 'UNKNOWN',
          breed: caseData.petBreed || 'Unknown breed',
          color: caseData.petColor || 'Unknown color',
          size: caseData.petSize || 'MEDIUM',
          age: caseData.petAge || null,
          sex: caseData.petSex || 'UNKNOWN',
          lastSeenAddress: `${caseData.city}, ${caseData.state}${caseData.zipCode ? ' ' + caseData.zipCode : ''}`,
          lastSeenDetails: caseData.petDescription || caseData.lastSeenLandmark || '',
          timeAgo,
          status: caseData.status === 'RESOLVED' || caseData.status === 'CLOSED_OTHER' ? 'FOUND' : 'ACTIVE',
          reporterName: caseData.contactName || 'Unknown',
          reporterPhone: caseData.contactPhone || '',
          reporterEmail: caseData.contactEmail || '',
          distinctiveMarks: caseData.petDistinctiveMarks || '',
          microchipId: caseData.petMicrochipId || '',
          hasReward: caseData.rewardAmount > 0,
          rewardAmount: caseData.rewardAmount || 0,
          createdAt: caseData.createdAt,
          userId: caseData.createdById,
        });

        // Set sightings if available (would need to be added to API)
        setSightings([]);
      } catch (err) {
        console.error('Error fetching alert:', err);
        // Fallback to redirect if not found
        router.push('/alerts');
      }
    };

    if (alertId) {
      fetchAlert();
    }
  }, [alertId, router]);

  if (status === 'loading' || !alert) {
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

  const isOwner = session.user?.id === alert.userId;

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: '0.75rem',
    backgroundColor: isActive ? '#2563eb' : 'transparent',
    color: isActive ? 'white' : '#6b7280',
    border: 'none',
    borderBottom: isActive ? 'none' : '2px solid #e5e7eb',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.875rem',
  });

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
              href="/alerts"
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
                Alert Details
              </h1>
            </div>
          </div>
          {isOwner && (
            <Link
              href={`/alerts/${alertId}/edit`}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '0.5rem',
                color: 'white',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1rem',
      }}>
        {/* Status Banner */}
        <div style={{
          backgroundColor: alert.status === 'ACTIVE' ? '#fee2e2' : '#d1fae5',
          border: `2px solid ${alert.status === 'ACTIVE' ? '#dc2626' : '#10b981'}`,
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: alert.status === 'ACTIVE' ? '#991b1b' : '#065f46',
            marginBottom: '0.25rem',
          }}>
            {alert.status === 'ACTIVE' ? '🚨 STILL MISSING' : '✅ FOUND'}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: alert.status === 'ACTIVE' ? '#7f1d1d' : '#047857',
          }}>
            Last seen {alert.timeAgo} • {alert.distance} away
          </div>
        </div>

        {/* Pet Info Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
          }}>
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '0.5rem',
              }}>
                {alert.petName}
              </h2>
              <div style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                {alert.breed} • {alert.color}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>{alert.age} years old</span>
                <span>•</span>
                <span>{alert.size} size</span>
                <span>•</span>
                <span>{alert.sex}</span>
              </div>
            </div>
            {alert.hasReward && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e' }}>
                  ${alert.rewardAmount}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: '600' }}>
                  REWARD
                </div>
              </div>
            )}
          </div>

          {alert.distinctiveMarks && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
            }}>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                Distinctive Marks:
              </div>
              <div style={{ color: '#78350f' }}>
                {alert.distinctiveMarks}
              </div>
            </div>
          )}

          {alert.microchipId && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#dbeafe',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}>
              <strong style={{ color: '#1e40af' }}>Microchip ID:</strong>{' '}
              <span style={{ color: '#1e3a8a' }}>{alert.microchipId}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
            <button
              onClick={() => setActiveTab('details')}
              style={tabStyle(activeTab === 'details')}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('sightings')}
              style={tabStyle(activeTab === 'sightings')}
            >
              Sightings ({sightings.length})
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              style={tabStyle(activeTab === 'contact')}
            >
              Contact
            </button>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                    📍 Last Seen Location
                  </h3>
                  <p style={{ color: '#4b5563', marginBottom: '0.5rem' }}>
                    {alert.lastSeenAddress}
                  </p>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                  }}>
                    {alert.lastSeenDetails}
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#dbeafe',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                }}>
                  <strong style={{ color: '#1e40af' }}>💡 Tip:</strong>{' '}
                  <span style={{ color: '#1e3a8a' }}>
                    If you spot this pet, please report a sighting immediately and try to keep visual contact without chasing.
                  </span>
                </div>
              </div>
            )}

            {/* Sightings Tab */}
            {activeTab === 'sightings' && (
              <div>
                {sightings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👁️</div>
                    <p>No sightings reported yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {sightings.map((sighting) => (
                      <div
                        key={sighting.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: sighting.verified ? '#d1fae5' : '#f3f4f6',
                          border: `2px solid ${sighting.verified ? '#10b981' : '#e5e7eb'}`,
                          borderRadius: '0.5rem',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem',
                        }}>
                          <div>
                            <div style={{ fontWeight: '600', color: '#1f2937' }}>
                              {sighting.reporterName}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {sighting.timeAgo}
                            </div>
                          </div>
                          {sighting.verified && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#1f2937', marginBottom: '0.5rem' }}>
                          <strong>Location:</strong> {sighting.location}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                          {sighting.details}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href={`/sightings/report?alertId=${alertId}`}
                  style={{
                    display: 'block',
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    textAlign: 'center',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                  }}
                >
                  👁️ Report a Sighting
                </Link>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                    Contact Owner
                  </h3>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Name
                      </div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>
                        {alert.reporterName}
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Phone
                      </div>
                      <a
                        href={`tel:${alert.reporterPhone}`}
                        style={{
                          fontWeight: '600',
                          color: '#2563eb',
                          textDecoration: 'none',
                        }}
                      >
                        {alert.reporterPhone}
                      </a>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Email
                      </div>
                      <a
                        href={`mailto:${alert.reporterEmail}`}
                        style={{
                          fontWeight: '600',
                          color: '#2563eb',
                          textDecoration: 'none',
                        }}
                      >
                        {alert.reporterEmail}
                      </a>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                }}>
                  <strong style={{ color: '#92400e' }}>⚠️ Important:</strong>{' '}
                  <span style={{ color: '#78350f' }}>
                    If you've spotted this pet, call immediately. Time is critical in pet recovery.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwner && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}>
            <Link
              href={`/sightings/report?alertId=${alertId}`}
              style={{
                padding: '1rem',
                backgroundColor: '#10b981',
                color: 'white',
                textAlign: 'center',
                borderRadius: '0.5rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              👁️ Report Sighting
            </Link>
            <a
              href={`tel:${alert.reporterPhone}`}
              style={{
                padding: '1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                textAlign: 'center',
                borderRadius: '0.5rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              📞 Call Owner
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
