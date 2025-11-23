'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map component (client-side only)
const PolygonDrawMap = dynamic(
  () => import('@/app/components/PolygonDrawMap'),
  { ssr: false, loading: () => <div style={{ height: '500px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div> }
);

function DivisionRequestForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mySquads, setMySquads] = useState([]);
  const [myRequests, setMyRequests] = useState([]);

  const [formData, setFormData] = useState({
    rescueSquadId: searchParams.get('squadId') || '',
    proposedName: '',
    justification: '',
    zipCodes: '',
    centerLatitude: '',
    centerLongitude: '',
    estimatedPopulation: '',
    notes: '',
    proposedBoundaries: null
  });

  useEffect(() => {
    if (!session) {
      router.push('/login?callbackUrl=/divisions/request');
    } else {
      fetchMySquads();
      fetchMyRequests();
    }
  }, [session]);

  // Pre-select squad from URL if provided
  useEffect(() => {
    const squadId = searchParams.get('squadId');
    if (squadId && formData.rescueSquadId !== squadId) {
      setFormData(prev => ({
        ...prev,
        rescueSquadId: squadId
      }));
    }
  }, [searchParams]);

  const fetchMySquads = async () => {
    try {
      const res = await fetch('/api/rescue-squads');
      if (res.ok) {
        const data = await res.json();
        // Filter to squads where I'm a member
        const myMemberships = data.squads.filter(s =>
          s.members?.some(m => m.userId === session?.user?.id && m.isActive)
        );
        setMySquads(myMemberships);
      }
    } catch (err) {
      console.error('Error fetching squads:', err);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await fetch('/api/divisions/request');
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePolygonChange = (polygonData) => {
    if (!polygonData) {
      // Polygon was deleted
      setFormData(prev => ({
        ...prev,
        proposedBoundaries: null,
        centerLatitude: '',
        centerLongitude: ''
      }));
    } else {
      // Polygon was created or updated
      setFormData(prev => ({
        ...prev,
        proposedBoundaries: polygonData.boundaries,
        centerLatitude: polygonData.centerLatitude.toString(),
        centerLongitude: polygonData.centerLongitude.toString()
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const zipCodesArray = formData.zipCodes
        ? formData.zipCodes.split(',').map(z => z.trim()).filter(Boolean)
        : [];

      const payload = {
        ...formData,
        zipCodes: zipCodesArray,
        centerLatitude: formData.centerLatitude ? parseFloat(formData.centerLatitude) : null,
        centerLongitude: formData.centerLongitude ? parseFloat(formData.centerLongitude) : null,
        estimatedPopulation: formData.estimatedPopulation ? parseInt(formData.estimatedPopulation) : null,
        proposedBoundaries: formData.proposedBoundaries
      };

      const res = await fetch('/api/divisions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess('Division request submitted successfully! An admin will review it soon.');

      // Reset form
      setFormData({
        rescueSquadId: '',
        proposedName: '',
        justification: '',
        zipCodes: '',
        centerLatitude: '',
        centerLongitude: '',
        estimatedPopulation: '',
        notes: '',
        proposedBoundaries: null
      });

      // Refresh requests list
      fetchMyRequests();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: { bg: '#fef3c7', color: '#92400e', text: '⏳ Pending' },
      APPROVED: { bg: '#d1fae5', color: '#065f46', text: '✓ Approved' },
      REJECTED: { bg: '#fee2e2', color: '#991b1b', text: '✗ Rejected' }
    };
    const style = styles[status] || styles.PENDING;
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        background: style.bg,
        color: style.color,
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '700'
      }}>
        {style.text}
      </span>
    );
  };

  if (!session) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
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
              Request a Division
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              Propose a neighborhood subdivision for your Rescue Squad
            </p>
          </div>
          <Link
            href="/rescue-squads"
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
            ← Back to Squads
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: myRequests.length > 0 ? '2fr 1fr' : '1fr',
          gap: '2rem'
        }}>
          {/* Request Form */}
          <div>
            {/* Success Message */}
            {success && (
              <div style={{
                padding: '1rem',
                background: '#d1fae5',
                border: '2px solid #6ee7b7',
                borderRadius: '8px',
                color: '#065f46',
                marginBottom: '2rem',
                fontWeight: '600'
              }}>
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '1rem',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                marginBottom: '2rem',
                fontWeight: '600'
              }}>
                {error}
              </div>
            )}

            {mySquads.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '4rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏘️</div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '0.5rem'
                }}>
                  Join a Rescue Squad First
                </h2>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                  You must be a member of a Rescue Squad before you can request a Division.
                </p>
                <Link
                  href="/rescue-squads"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: '#667eea',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '700'
                  }}
                >
                  Browse Rescue Squads
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2.5rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '1.5rem'
                }}>
                  Division Details
                </h2>

                {/* Rescue Squad Selection */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Rescue Squad *
                  </label>
                  <select
                    name="rescueSquadId"
                    value={formData.rescueSquadId}
                    onChange={handleChange}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="">Select a squad...</option>
                    {mySquads.map(squad => (
                      <option key={squad.id} value={squad.id}>
                        {squad.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proposed Name */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Proposed Division Name *
                  </label>
                  <input
                    type="text"
                    name="proposedName"
                    value={formData.proposedName}
                    onChange={handleChange}
                    placeholder="e.g., North Side, Downtown, West End"
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

                {/* Justification */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Justification *
                  </label>
                  <textarea
                    name="justification"
                    value={formData.justification}
                    onChange={handleChange}
                    placeholder="Why is this division needed? What problem does it solve?"
                    required
                    rows="4"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                  <p style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    marginTop: '0.5rem'
                  }}>
                    Explain why this neighborhood needs its own division (e.g., high population density, geographic distance, active user base)
                  </p>
                </div>

                {/* Geographic Details */}
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '1rem',
                  marginTop: '2rem'
                }}>
                  Geographic Details
                </h3>

                {/* Polygon Drawing Map */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.75rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Division Boundaries (Draw on Map)
                  </label>
                  <PolygonDrawMap
                    onPolygonChange={handlePolygonChange}
                    initialBoundaries={formData.proposedBoundaries}
                    centerLat={formData.centerLatitude ? parseFloat(formData.centerLatitude) : 41.8781}
                    centerLng={formData.centerLongitude ? parseFloat(formData.centerLongitude) : -87.6298}
                    zoom={12}
                  />
                  {formData.proposedBoundaries && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      background: '#d1fae5',
                      border: '2px solid #6ee7b7',
                      borderRadius: '8px',
                      color: '#065f46',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      ✓ Polygon drawn with {formData.proposedBoundaries.length} points
                      <br />
                      Center: {parseFloat(formData.centerLatitude).toFixed(4)}, {parseFloat(formData.centerLongitude).toFixed(4)}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    ZIP Codes (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="zipCodes"
                    value={formData.zipCodes}
                    onChange={handleChange}
                    placeholder="e.g., 60614, 60657, 60640"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      Center Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="centerLatitude"
                      value={formData.centerLatitude}
                      onChange={handleChange}
                      placeholder="Auto-calculated from polygon"
                      readOnly
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        background: '#f8fafc',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      Center Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="centerLongitude"
                      value={formData.centerLongitude}
                      onChange={handleChange}
                      placeholder="Auto-calculated from polygon"
                      readOnly
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        background: '#f8fafc',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {/* Additional Context */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Estimated Population
                  </label>
                  <input
                    type="number"
                    name="estimatedPopulation"
                    value={formData.estimatedPopulation}
                    onChange={handleChange}
                    placeholder="e.g., 75000"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any additional context or information..."
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: loading ? '#cbd5e1' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Submitting Request...' : 'Submit Division Request'}
                </button>
              </form>
            )}
          </div>

          {/* My Requests Sidebar */}
          {myRequests.length > 0 && (
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '1rem'
              }}>
                Your Requests
              </h2>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {myRequests.map(request => (
                  <div
                    key={request.id}
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem'
                    }}>
                      <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {request.proposedName}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>

                    <p style={{
                      fontSize: '0.9rem',
                      color: '#64748b',
                      marginBottom: '0.5rem'
                    }}>
                      {request.justification.slice(0, 100)}
                      {request.justification.length > 100 && '...'}
                    </p>

                    <div style={{
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      Submitted {new Date(request.createdAt).toLocaleDateString()}
                    </div>

                    {request.status === 'REJECTED' && request.rejectionReason && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: '#fef2f2',
                        borderLeft: '3px solid #ef4444',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#991b1b'
                      }}>
                        <strong>Reason:</strong> {request.rejectionReason}
                      </div>
                    )}

                    {request.approvedDivision && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: '#f0fdf4',
                        borderLeft: '3px solid #10b981',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        <strong>Created:</strong> {request.approvedDivision.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DivisionRequestPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          fontSize: '1.2rem',
          color: '#64748b'
        }}>
          Loading...
        </div>
      </div>
    }>
      <DivisionRequestForm />
    </Suspense>
  );
}
