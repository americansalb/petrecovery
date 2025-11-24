'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RescueSquadDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [legalError, setLegalError] = useState(null); // { message, redirectTo }
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [availableCases, setAvailableCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [acceptingCase, setAcceptingCase] = useState(null);
  const [activeCases, setActiveCases] = useState([]);
  const [activeCasesLoading, setActiveCasesLoading] = useState(false);
  const [optingCase, setOptingCase] = useState(null);

  useEffect(() => {
    loadSquad();
  }, [params.id, session]);

  useEffect(() => {
    // Load available cases if user is a leader
    if (userRole && ['FOUNDER', 'LEADER'].includes(userRole)) {
      loadAvailableCases();
    }
    // Load active cases for all members
    if (isMember) {
      loadActiveCases();
    }
  }, [userRole, isMember, params.id]);

  const loadSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load squad');
      }

      setSquad(data.squad);

      // Check if current user is a member and get their role
      if (session?.user?.id && data.squad.members) {
        const userMembership = data.squad.members.find(
          m => m.userId === session.user.id && m.isActive
        );
        if (userMembership) {
          setIsMember(true);
          setUserRole(userMembership.role);
        } else {
          setIsMember(false);
          setUserRole(null);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}`);
      return;
    }

    setJoining(true);
    setError('');
    setLegalError(null);

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for legal consent requirement (Phase 0: Legal Baseline)
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalError({
            message: data.message,
            redirectTo: data.redirectTo
          });
          return;
        }

        throw new Error(data.error || 'Failed to join squad');
      }

      setIsMember(true);
      loadSquad(); // Reload to show updated member count
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this squad? You will be removed from all active cases.')) {
      return;
    }

    setLeaving(true);
    setError('');

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/leave`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to leave squad');
      }

      setIsMember(false);
      setUserRole(null);
      loadSquad(); // Reload to show updated member count
    } catch (err) {
      setError(err.message);
    } finally {
      setLeaving(false);
    }
  };

  const loadAvailableCases = async () => {
    setCasesLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/available-cases`);
      if (res.ok) {
        const data = await res.json();
        setAvailableCases(data.cases || []);
      }
    } catch (err) {
      console.error('Error loading available cases:', err);
    } finally {
      setCasesLoading(false);
    }
  };

  const handleAcceptCase = async (caseId) => {
    if (!confirm('Accept this case for your squad? All members will be notified.')) {
      return;
    }

    setAcceptingCase(caseId);
    setError('');

    try {
      const res = await fetch(`/api/cases/${caseId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rescueSquadId: params.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept case');
      }

      // Remove from available cases and reload squad data
      setAvailableCases(prev => prev.filter(c => c.id !== caseId));
      loadSquad();
      loadActiveCases(); // Refresh active cases
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingCase(null);
    }
  };

  const loadActiveCases = async () => {
    setActiveCasesLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/active-cases`);
      if (res.ok) {
        const data = await res.json();
        setActiveCases(data.assignments || []);
      }
    } catch (err) {
      console.error('Error loading active cases:', err);
    } finally {
      setActiveCasesLoading(false);
    }
  };

  const handleOptIn = async (assignmentId) => {
    setOptingCase(assignmentId);
    setError('');

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/participants`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to opt into case');
      }

      // Update the local state
      setActiveCases(prev =>
        prev.map(assignment =>
          assignment.id === assignmentId
            ? { ...assignment, isUserParticipating: true }
            : assignment
        )
      );
      loadSquad(); // Refresh squad data
    } catch (err) {
      setError(err.message);
    } finally {
      setOptingCase(null);
    }
  };

  const handleOptOut = async (assignmentId) => {
    if (!confirm('Stop helping with this case? You can opt back in later.')) {
      return;
    }

    setOptingCase(assignmentId);
    setError('');

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/participants`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to opt out of case');
      }

      // Update the local state
      setActiveCases(prev =>
        prev.map(assignment =>
          assignment.id === assignmentId
            ? { ...assignment, isUserParticipating: false }
            : assignment
        )
      );
      loadSquad(); // Refresh squad data
    } catch (err) {
      setError(err.message);
    } finally {
      setOptingCase(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{
          fontSize: '1.2rem',
          color: '#64748b'
        }}>
          Loading squad details...
        </div>
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            Squad Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The rescue squad you\'re looking for doesn\'t exist.'}
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
            ← Browse Rescue Squads
          </Link>
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
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1 }}>
            <Link
              href="/rescue-squads"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600',
                marginBottom: '1rem',
                display: 'inline-block'
              }}
            >
              ← Back to Rescue Squads
            </Link>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              {squad.name}
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b'
            }}>
              {squad.description || 'Volunteer rescue squad'}
            </p>
          </div>

          {/* Join Button */}
          {!isMember && (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                padding: '1rem 2rem',
                background: joining ? '#cbd5e1' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1.1rem',
                cursor: joining ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {joining ? 'Joining...' : 'Join Squad'}
            </button>
          )}

          {isMember && (
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{
                padding: '1rem 2rem',
                background: '#d1fae5',
                border: '2px solid #10b981',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1.1rem',
                color: '#065f46'
              }}>
                ✓ You're a Member
              </div>
              <button
                onClick={handleLeave}
                disabled={leaving}
                style={{
                  padding: '1rem 2rem',
                  background: leaving ? '#cbd5e1' : 'white',
                  color: leaving ? '#64748b' : '#dc2626',
                  border: `2px solid ${leaving ? '#cbd5e1' : '#dc2626'}`,
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem',
                  cursor: leaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {leaving ? 'Leaving...' : 'Leave Squad'}
              </button>
            </div>
          )}
        </div>

        {/* Legal Consent Required Banner */}
        {legalError && (
          <div style={{
            padding: '1.5rem',
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '0.25rem' }}>
                  Legal Agreement Required
                </div>
                <div style={{ color: '#b45309', fontSize: '0.95rem' }}>
                  {legalError.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(legalError.redirectTo)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Review & Accept Now →
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Active Members
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squad._count?.members || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Active Cases
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#dc2626'
            }}>
              {squad.activeCases || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Successful Reunions
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#10b981'
            }}>
              {squad.successfulReunions || 0}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              Coverage Area
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {squad.radiusMiles} mi
            </div>
          </div>
        </div>

        {/* Available Cases (Leaders Only) */}
        {userRole && ['FOUNDER', 'LEADER'].includes(userRole) && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                color: '#0f172a'
              }}>
                🔍 Available Cases in Your Area
              </h2>
              <button
                onClick={loadAvailableCases}
                disabled={casesLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: casesLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {casesLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {casesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Loading available cases...
              </div>
            ) : availableCases.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: '#f8fafc',
                borderRadius: '12px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  No available cases in your area
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  Check back later for new cases to help with
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                {availableCases.slice(0, 5).map(caseItem => (
                  <div
                    key={caseItem.id}
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      padding: '1.5rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Pet Photo */}
                    <img
                      src={caseItem.petPhotoUrl || '/placeholder-pet.jpg'}
                      alt={caseItem.petName}
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Case Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem'
                      }}>
                        <div>
                          <h3 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#0f172a',
                            marginBottom: '0.25rem'
                          }}>
                            {caseItem.petName}
                          </h3>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#64748b'
                          }}>
                            {caseItem.petSpecies} • {caseItem.petBreed || 'Unknown breed'} • {caseItem.petColor}
                          </div>
                        </div>
                        <div style={{
                          padding: '0.5rem 1rem',
                          background: caseItem.priority === 'URGENT' ? '#fee2e2' :
                                    caseItem.priority === 'HIGH' ? '#fef3c7' : '#f1f5f9',
                          color: caseItem.priority === 'URGENT' ? '#991b1b' :
                                caseItem.priority === 'HIGH' ? '#92400e' : '#64748b',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '700'
                        }}>
                          {caseItem.priority}
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.9rem',
                        color: '#475569',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        gap: '1.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <div>
                          📍 {caseItem.lastSeenAddress}
                        </div>
                        {caseItem.distance !== null && (
                          <div>
                            🎯 {caseItem.distance.toFixed(1)} miles away
                          </div>
                        )}
                        <div>
                          📅 {new Date(caseItem.lastSeenAt).toLocaleDateString()}
                        </div>
                        {caseItem._count.assignments > 0 && (
                          <div>
                            👥 {caseItem._count.assignments} squad{caseItem._count.assignments === 1 ? '' : 's'} helping
                          </div>
                        )}
                      </div>

                      <div style={{
                        fontSize: '0.95rem',
                        color: '#64748b',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        {caseItem.petDescription.length > 150
                          ? caseItem.petDescription.substring(0, 150) + '...'
                          : caseItem.petDescription}
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center'
                      }}>
                        <button
                          onClick={() => handleAcceptCase(caseItem.id)}
                          disabled={acceptingCase === caseItem.id}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: acceptingCase === caseItem.id ? '#cbd5e1' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: acceptingCase === caseItem.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {acceptingCase === caseItem.id ? 'Accepting...' : 'Accept Case'}
                        </button>
                        <Link
                          href={`/cases/${caseItem.id}`}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: '700'
                          }}
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {availableCases.length > 5 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    color: '#64748b'
                  }}>
                    Showing 5 of {availableCases.length} available cases
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active Cases (All Members) */}
        {isMember && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                color: '#0f172a'
              }}>
                🚨 Squad's Active Cases
              </h2>
              <button
                onClick={loadActiveCases}
                disabled={activeCasesLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: activeCasesLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {activeCasesLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {activeCasesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Loading active cases...
              </div>
            ) : activeCases.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: '#f8fafc',
                borderRadius: '12px',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  No active cases yet
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  {userRole && ['FOUNDER', 'LEADER'].includes(userRole)
                    ? 'Browse available cases above to get started'
                    : 'Squad leaders will assign cases soon'}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                {activeCases.map(assignment => (
                  <div
                    key={assignment.id}
                    style={{
                      display: 'flex',
                      gap: '1.5rem',
                      padding: '1.5rem',
                      border: assignment.isUserParticipating ? '2px solid #10b981' : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      background: assignment.isUserParticipating ? '#f0fdf4' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Pet Photo */}
                    <img
                      src={assignment.case.petPhotoUrl || '/placeholder-pet.jpg'}
                      alt={assignment.case.petName}
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Case Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem'
                      }}>
                        <div>
                          <h3 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#0f172a',
                            marginBottom: '0.25rem'
                          }}>
                            {assignment.case.petName}
                          </h3>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#64748b'
                          }}>
                            {assignment.case.petSpecies} • {assignment.case.petBreed || 'Unknown breed'} • {assignment.case.petColor}
                          </div>
                        </div>
                        <div style={{
                          padding: '0.5rem 1rem',
                          background: assignment.status === 'ACTIVE' ? '#dcfce7' :
                                    assignment.status === 'ACCEPTED' ? '#dbeafe' : '#f1f5f9',
                          color: assignment.status === 'ACTIVE' ? '#166534' :
                                assignment.status === 'ACCEPTED' ? '#1e40af' : '#64748b',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '700'
                        }}>
                          {assignment.status}
                        </div>
                      </div>

                      <div style={{
                        fontSize: '0.9rem',
                        color: '#475569',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        gap: '1.5rem',
                        flexWrap: 'wrap'
                      }}>
                        <div>
                          📍 {assignment.case.lastSeenAddress}
                        </div>
                        <div>
                          📅 {new Date(assignment.case.lastSeenAt).toLocaleDateString()}
                        </div>
                        <div>
                          👥 {assignment._count.participants} member{assignment._count.participants === 1 ? '' : 's'} helping
                        </div>
                        {assignment._count.petSpottings > 0 && (
                          <div>
                            👀 {assignment._count.petSpottings} sighting{assignment._count.petSpottings === 1 ? '' : 's'}
                          </div>
                        )}
                      </div>

                      <div style={{
                        fontSize: '0.95rem',
                        color: '#64748b',
                        marginBottom: '1rem',
                        lineHeight: '1.5'
                      }}>
                        {assignment.case.petDescription.length > 150
                          ? assignment.case.petDescription.substring(0, 150) + '...'
                          : assignment.case.petDescription}
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center'
                      }}>
                        {assignment.isUserParticipating ? (
                          <>
                            <div style={{
                              padding: '0.75rem 1.5rem',
                              background: '#d1fae5',
                              color: '#065f46',
                              borderRadius: '8px',
                              fontWeight: '700'
                            }}>
                              ✓ You're Helping
                            </div>
                            <button
                              onClick={() => handleOptOut(assignment.id)}
                              disabled={optingCase === assignment.id}
                              style={{
                                padding: '0.75rem 1.5rem',
                                background: optingCase === assignment.id ? '#cbd5e1' : '#f1f5f9',
                                color: optingCase === assignment.id ? '#64748b' : '#ef4444',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: optingCase === assignment.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {optingCase === assignment.id ? 'Processing...' : 'Stop Helping'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleOptIn(assignment.id)}
                            disabled={optingCase === assignment.id}
                            style={{
                              padding: '0.75rem 1.5rem',
                              background: optingCase === assignment.id ? '#cbd5e1' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: '700',
                              cursor: optingCase === assignment.id ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {optingCase === assignment.id ? 'Joining...' : 'Help with This Case'}
                          </button>
                        )}
                        <Link
                          href={`/cases/${assignment.case.id}`}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: '700'
                          }}
                        >
                          View Case Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Squad Info */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              About This Squad
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                Coverage Type
              </div>
              <div style={{
                fontSize: '1.1rem',
                color: '#0f172a'
              }}>
                {squad.coverageType || 'CITYWIDE'}
              </div>
            </div>

            {squad.zipCodes && squad.zipCodes.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  fontWeight: '600'
                }}>
                  ZIP Codes Served
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  color: '#0f172a'
                }}>
                  {Array.isArray(squad.zipCodes)
                    ? squad.zipCodes.join(', ')
                    : JSON.parse(squad.zipCodes).join(', ')}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                Availability
              </div>
              <div style={{
                fontSize: '1.1rem',
                color: '#0f172a'
              }}>
                {squad.availability247 ? '24/7 Available' : 'Business Hours'}
              </div>
            </div>

            {squad.contactEmail && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  fontWeight: '600'
                }}>
                  Contact
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  color: '#667eea'
                }}>
                  {squad.contactEmail}
                </div>
              </div>
            )}
          </div>

          {/* Members Preview */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Squad Leaders
            </h2>

            {squad.members && squad.members.filter(m => ['FOUNDER', 'LEADER'].includes(m.role)).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {squad.members
                  .filter(m => ['FOUNDER', 'LEADER'].includes(m.role))
                  .slice(0, 5)
                  .map(member => (
                    <div key={member.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}>
                        {member.user.firstName?.[0] || '?'}
                      </div>
                      <div>
                        <div style={{
                          fontWeight: '700',
                          color: '#0f172a'
                        }}>
                          {member.user.firstName} {member.user.lastName}
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          color: '#64748b'
                        }}>
                          {member.role}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>No leaders listed</p>
            )}
          </div>
        </div>

        {/* Divisions */}
        {squad.divisions && squad.divisions.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Divisions
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {squad.divisions.map(division => (
                <div key={division.id} style={{
                  padding: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '0.5rem'
                  }}>
                    {division.name}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#64748b'
                  }}>
                    {division.totalMembers || 0} members
                  </div>
                </div>
              ))}
            </div>
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
            marginTop: '1rem',
            fontWeight: '600'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
