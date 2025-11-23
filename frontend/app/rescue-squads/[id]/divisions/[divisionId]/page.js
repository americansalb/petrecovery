'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const DivisionMap = dynamic(() => import('@/app/components/DivisionMap'), {
  ssr: false,
  loading: () => <div style={{ height: '400px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

export default function DivisionDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [division, setDivision] = useState(null);
  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [isSquadMember, setIsSquadMember] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [availableCases, setAvailableCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [acceptingCase, setAcceptingCase] = useState(null);
  const [activeCases, setActiveCases] = useState([]);
  const [activeCasesLoading, setActiveCasesLoading] = useState(false);
  const [optingCase, setOptingCase] = useState(null);

  useEffect(() => {
    loadDivision();
  }, [params.id, params.divisionId, session]);

  useEffect(() => {
    // Load available cases if user is a division leader or moderator
    if (userRole && ['MODERATOR', 'DIVISION_LEADER'].includes(userRole)) {
      loadAvailableCases();
    }
    // Load active cases for all members
    if (isMember) {
      loadActiveCases();
    }
  }, [userRole, isMember, params.divisionId]);

  const loadDivision = async () => {
    try {
      // Load division data
      const divRes = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}`);
      const divData = await divRes.json();

      if (!divRes.ok) {
        throw new Error(divData.error || 'Failed to load division');
      }

      setDivision(divData.division);
      setSquad(divData.squad);

      // Check if current user is a member of the division
      if (session?.user?.id && divData.division.members) {
        const userMembership = divData.division.members.find(
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

      // Check if user is a member of the parent squad
      if (session?.user?.id && divData.squad.members) {
        const squadMembership = divData.squad.members.find(
          m => m.userId === session.user.id && m.isActive
        );
        setIsSquadMember(!!squadMembership);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}/divisions/${params.divisionId}`);
      return;
    }

    setJoining(true);
    setError('');

    try {
      // If not a squad member, join squad first
      if (!isSquadMember) {
        const squadRes = await fetch(`/api/rescue-squads/${params.id}/join`, {
          method: 'POST',
        });

        if (!squadRes.ok) {
          const squadData = await squadRes.json();
          throw new Error(squadData.error || 'Failed to join parent squad');
        }
      }

      // Join division
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join division');
      }

      setIsMember(true);
      setIsSquadMember(true);
      loadDivision(); // Reload to show updated member count
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this division? You will be removed from all division cases.')) {
      return;
    }

    setLeaving(true);
    setError('');

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}/leave`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to leave division');
      }

      setIsMember(false);
      setUserRole(null);
      loadDivision(); // Reload to show updated member count
    } catch (err) {
      setError(err.message);
    } finally {
      setLeaving(false);
    }
  };

  const loadAvailableCases = async () => {
    setCasesLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}/available-cases`);
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
    if (!confirm('Accept this case for your division? All division members will be notified.')) {
      return;
    }

    setAcceptingCase(caseId);
    setError('');

    try {
      const res = await fetch(`/api/cases/${caseId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rescueSquadId: params.id,
          divisionId: params.divisionId
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept case');
      }

      // Remove from available cases and reload division data
      setAvailableCases(prev => prev.filter(c => c.id !== caseId));
      loadDivision();
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
      const res = await fetch(`/api/rescue-squads/${params.id}/divisions/${params.divisionId}/active-cases`);
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
      loadDivision(); // Refresh division data
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
      loadDivision(); // Refresh division data
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
          Loading division details...
        </div>
      </div>
    );
  }

  if (error || !division || !squad) {
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
            Division Not Found
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            {error || 'The division you\'re looking for doesn\'t exist.'}
          </p>
          <Link
            href={`/rescue-squads/${params.id}`}
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
            ← Back to Rescue Squad
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
        {/* Breadcrumb and Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1 }}>
            {/* Breadcrumb */}
            <div style={{
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              color: '#64748b'
            }}>
              <Link
                href="/rescue-squads/search"
                style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Rescue Squads
              </Link>
              <span>→</span>
              <Link
                href={`/rescue-squads/${params.id}`}
                style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                {squad.name}
              </Link>
              <span>→</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>
                {division.name}
              </span>
            </div>

            {/* Division Badge */}
            <div style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '700',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              🎯 Division
            </div>

            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '0.5rem'
            }}>
              {division.name}
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#64748b',
              marginBottom: '0.5rem'
            }}>
              {division.description || 'Specialized division within the rescue squad'}
            </p>
            <p style={{
              fontSize: '0.95rem',
              color: '#94a3b8'
            }}>
              Part of <Link href={`/rescue-squads/${params.id}`} style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}>{squad.name}</Link>
            </p>
          </div>

          {/* Join/Leave Button */}
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
              {joining ? 'Joining...' : isSquadMember ? 'Join Division' : 'Join Squad & Division'}
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
                ✓ Division Member
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
                {leaving ? 'Leaving...' : 'Leave Division'}
              </button>
            </div>
          )}
        </div>

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
              Division Members
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#0f172a'
            }}>
              {division._count?.members || 0}
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
              {division.activeCases || 0}
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
              {division.successfulReunions || 0}
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
              Total Cases Handled
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: '#667eea'
            }}>
              {(division.activeCases || 0) + (division.successfulReunions || 0)}
            </div>
          </div>
        </div>

        {/* Coverage Area Map */}
        {division.boundaries && (
          <div style={{ marginBottom: '2rem' }}>
            <DivisionMap
              boundaries={division.boundaries}
              centerLatitude={division.centerLatitude}
              centerLongitude={division.centerLongitude}
              name={division.name}
            />
          </div>
        )}

        {/* Available Cases (Division Leaders/Moderators Only) */}
        {userRole && ['MODERATOR', 'DIVISION_LEADER'].includes(userRole) && (
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
                🔍 Available Cases in Your Division
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
                  No available cases in your division
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  Check back later for new cases within your area
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
                            🎯 {caseItem.distance.toFixed(1)} miles from division center
                          </div>
                        )}
                        <div>
                          📅 {new Date(caseItem.lastSeenAt).toLocaleDateString()}
                        </div>
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
                          {acceptingCase === caseItem.id ? 'Accepting...' : 'Accept for Division'}
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

        {/* Active Cases (All Division Members) */}
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
              marginBottom: '2rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  color: '#0f172a',
                  marginBottom: '0.25rem'
                }}>
                  🚨 Division Active Operations
                </h2>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  Cases currently being worked on by this division
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {activeCases.length > 0 && (
                  <div style={{
                    padding: '0.75rem 1.25rem',
                    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.9rem'
                  }}>
                    {activeCases.length} Active Case{activeCases.length === 1 ? '' : 's'}
                  </div>
                )}
                <button
                  onClick={loadActiveCases}
                  disabled={activeCasesLoading}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: activeCasesLoading ? '#cbd5e1' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: activeCasesLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {activeCasesLoading ? 'Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {activeCasesLoading ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: '#f8fafc',
                borderRadius: '12px'
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid #e2e8f0',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ marginTop: '1rem', color: '#64748b', fontWeight: '600' }}>
                  Loading active cases...
                </div>
              </div>
            ) : activeCases.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderRadius: '12px',
                border: '2px dashed #cbd5e1'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>
                  No Active Operations
                </div>
                <div style={{ fontSize: '0.95rem', color: '#64748b' }}>
                  {userRole && ['MODERATOR', 'DIVISION_LEADER'].includes(userRole)
                    ? 'Accept cases from the available list above to begin operations'
                    : 'Division leaders will assign cases when new pets need help'}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                {activeCases.map(assignment => {
                  const daysSinceLastSeen = Math.floor(
                    (new Date() - new Date(assignment.case.lastSeenAt)) / (1000 * 60 * 60 * 24)
                  );
                  const isUrgent = daysSinceLastSeen <= 2;

                  return (
                    <div
                      key={assignment.id}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        gap: '1.5rem',
                        padding: '1.75rem',
                        border: assignment.isUserParticipating
                          ? '3px solid #10b981'
                          : isUrgent
                          ? '3px solid #dc2626'
                          : '2px solid #e2e8f0',
                        borderRadius: '16px',
                        background: assignment.isUserParticipating
                          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                          : 'white',
                        transition: 'all 0.3s ease',
                        overflow: 'hidden',
                        boxShadow: assignment.isUserParticipating
                          ? '0 4px 12px rgba(16, 185, 129, 0.15)'
                          : '0 2px 8px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      {/* Urgency indicator stripe */}
                      {isUrgent && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'linear-gradient(90deg, #dc2626 0%, #991b1b 100%)'
                        }} />
                      )}

                      {/* Pet Photo with badge */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img
                          src={assignment.case.petPhotoUrl || '/placeholder-pet.jpg'}
                          alt={assignment.case.petName}
                          style={{
                            width: '140px',
                            height: '140px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            border: '3px solid white',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        {isUrgent && (
                          <div style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                            color: 'white',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: '900',
                            boxShadow: '0 4px 8px rgba(220, 38, 38, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            🔥 URGENT
                          </div>
                        )}
                      </div>

                      {/* Case Details */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '1rem',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{
                              fontSize: '1.6rem',
                              fontWeight: '800',
                              color: '#0f172a',
                              marginBottom: '0.5rem',
                              lineHeight: '1.2'
                            }}>
                              {assignment.case.petName}
                            </h3>
                            <div style={{
                              fontSize: '1rem',
                              color: '#64748b',
                              fontWeight: '600'
                            }}>
                              {assignment.case.petSpecies} • {assignment.case.petBreed || 'Unknown breed'} • {assignment.case.petColor}
                            </div>
                          </div>
                          <div style={{
                            padding: '0.6rem 1.2rem',
                            background: assignment.status === 'ACTIVE'
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : assignment.status === 'ACCEPTED'
                              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                              : '#f1f5f9',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                          }}>
                            {assignment.status}
                          </div>
                        </div>

                        {/* Key metrics grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '1rem',
                          marginBottom: '1rem',
                          padding: '1rem',
                          background: '#f8fafc',
                          borderRadius: '8px'
                        }}>
                          <div>
                            <div style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              marginBottom: '0.25rem',
                              textTransform: 'uppercase',
                              fontWeight: '700',
                              letterSpacing: '0.5px'
                            }}>
                              Last Seen
                            </div>
                            <div style={{
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              color: isUrgent ? '#dc2626' : '#0f172a'
                            }}>
                              {daysSinceLastSeen === 0 ? 'Today' : `${daysSinceLastSeen} day${daysSinceLastSeen === 1 ? '' : 's'} ago`}
                            </div>
                          </div>
                          <div>
                            <div style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              marginBottom: '0.25rem',
                              textTransform: 'uppercase',
                              fontWeight: '700',
                              letterSpacing: '0.5px'
                            }}>
                              Team Size
                            </div>
                            <div style={{
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              color: '#0f172a'
                            }}>
                              👥 {assignment._count.participants} member{assignment._count.participants === 1 ? '' : 's'}
                            </div>
                          </div>
                          {assignment._count.petSpottings > 0 && (
                            <div>
                              <div style={{
                                fontSize: '0.7rem',
                                color: '#64748b',
                                marginBottom: '0.25rem',
                                textTransform: 'uppercase',
                                fontWeight: '700',
                                letterSpacing: '0.5px'
                              }}>
                                Sightings
                              </div>
                              <div style={{
                                fontSize: '0.9rem',
                                fontWeight: '700',
                                color: '#10b981'
                              }}>
                                👀 {assignment._count.petSpottings}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              marginBottom: '0.25rem',
                              textTransform: 'uppercase',
                              fontWeight: '700',
                              letterSpacing: '0.5px'
                            }}>
                              Location
                            </div>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              color: '#0f172a'
                            }}>
                              📍 {assignment.case.lastSeenAddress.split(',')[0]}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{
                          fontSize: '0.95rem',
                          color: '#475569',
                          marginBottom: '1.25rem',
                          lineHeight: '1.6',
                          fontWeight: '500'
                        }}>
                          {assignment.case.petDescription.length > 150
                            ? assignment.case.petDescription.substring(0, 150) + '...'
                            : assignment.case.petDescription}
                        </div>

                        {/* Action buttons */}
                        <div style={{
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'center',
                          marginTop: 'auto',
                          flexWrap: 'wrap'
                        }}>
                          {assignment.isUserParticipating ? (
                            <>
                              <div style={{
                                padding: '1rem 1.75rem',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                borderRadius: '10px',
                                fontWeight: '800',
                                fontSize: '1rem',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                ✓ You're On This Case
                              </div>
                              <button
                                onClick={() => handleOptOut(assignment.id)}
                                disabled={optingCase === assignment.id}
                                style={{
                                  padding: '1rem 1.75rem',
                                  background: optingCase === assignment.id ? '#cbd5e1' : 'white',
                                  color: optingCase === assignment.id ? '#64748b' : '#ef4444',
                                  border: `2px solid ${optingCase === assignment.id ? '#cbd5e1' : '#ef4444'}`,
                                  borderRadius: '10px',
                                  fontWeight: '800',
                                  fontSize: '1rem',
                                  cursor: optingCase === assignment.id ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {optingCase === assignment.id ? 'Processing...' : 'Leave Case'}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOptIn(assignment.id)}
                              disabled={optingCase === assignment.id}
                              style={{
                                padding: '1rem 1.75rem',
                                background: optingCase === assignment.id
                                  ? '#cbd5e1'
                                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '800',
                                fontSize: '1rem',
                                cursor: optingCase === assignment.id ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              {optingCase === assignment.id ? 'Joining...' : '🚀 Join This Case'}
                            </button>
                          )}
                          <Link
                            href={`/cases/${assignment.case.id}`}
                            style={{
                              padding: '1rem 1.75rem',
                              background: 'white',
                              color: '#667eea',
                              border: '2px solid #667eea',
                              borderRadius: '10px',
                              textDecoration: 'none',
                              fontWeight: '800',
                              fontSize: '1rem',
                              transition: 'all 0.2s',
                              display: 'inline-block'
                            }}
                          >
                            📋 Full Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Division Leaders */}
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
            Division Leadership
          </h2>

          {division.members && division.members.filter(m => ['MODERATOR', 'DIVISION_LEADER'].includes(m.role)).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {division.members
                .filter(m => ['MODERATOR', 'DIVISION_LEADER'].includes(m.role))
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
                        {member.role === 'MODERATOR' ? 'Squad Moderator' : 'Division Leader'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No leaders assigned yet</p>
          )}
        </div>

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
