'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const SquadCoverageMap = dynamic(() => import('@/app/components/SquadCoverageMap'), {
  ssr: false,
  loading: () => <div style={{ height: '400px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

export default function SquadDetailsPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const router = useRouter();

  const [squad, setSquad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Premium Features State
  const [legalError, setLegalError] = useState(null); // { message, redirectTo }
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [availableCases, setAvailableCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [acceptingCase, setAcceptingCase] = useState(null);
  const [activeCases, setActiveCases] = useState([]);
  const [activeCasesLoading, setActiveCasesLoading] = useState(false);
  const [optingCase, setOptingCase] = useState(null);

  const fetchSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${id}`);
      if (!res.ok) throw new Error('Squad not found');
      const data = await res.json();
      setSquad(data);

      // Update derived state
      const member = data.members?.find(m => m.userId === session?.user?.id);
      setIsMember(!!member);
      setUserRole(member?.role || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSquad();
  }, [id, session]);

  // --- Missing Functions Implementation ---
  const loadAvailableCases = async () => {
    setCasesLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/cases/available`);
      if (res.ok) {
        const data = await res.json();
        setAvailableCases(data);
      }
    } catch (e) {
      console.error("Failed to load available cases", e);
    } finally {
      setCasesLoading(false);
    }
  };

  const loadActiveCases = async () => {
    setActiveCasesLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/cases/active`);
      if (res.ok) {
        const data = await res.json();
        setActiveCases(data);
      }
    } catch (e) {
      console.error("Failed to load active cases", e);
    } finally {
      setActiveCasesLoading(false);
    }
  };

  const handleAcceptCase = async (caseId) => {
    setAcceptingCase(caseId);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/cases/${caseId}/accept`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to accept case');
      await loadAvailableCases();
      await loadActiveCases();
    } catch (e) {
      alert(e.message);
    } finally {
      setAcceptingCase(null);
    }
  };

  const handleOptIn = async (assignmentId) => {
    setOptingCase(assignmentId);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/assignments/${assignmentId}/join`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to join case');
      await loadActiveCases();
    } catch (e) {
      alert(e.message);
    } finally {
      setOptingCase(null);
    }
  };

  const handleOptOut = async (assignmentId) => {
    setOptingCase(assignmentId);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/assignments/${assignmentId}/leave`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to leave case');
      await loadActiveCases();
    } catch (e) {
      alert(e.message);
    } finally {
      setOptingCase(null);
    }
  };

  // Load cases when role is known
  useEffect(() => {
    if (userRole) {
      loadActiveCases();
      if (['FOUNDER', 'LEADER'].includes(userRole)) {
        loadAvailableCases();
      }
    }
  }, [userRole]);

  const handleJoin = async () => {
    if (!session) {
      router.push('/login');
      return;
    }

    setJoining(true);
    setError('');
    setLegalError(null);

    try {
      const res = await fetch(`/api/rescue-squads/${id}/join`, {
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
      fetchSquad(); // Reload to show updated member count
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this squad?')) return;

    setJoining(true);
    try {
      const res = await fetch(`/api/rescue-squads/${id}/leave`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to leave squad');
      await fetchSquad();
    } catch (err) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading squad details...</div>;
  if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!squad) return null;



  // Helper to format ZIPs
  const formatZips = (zips) => {
    if (!zips) return 'None';
    if (Array.isArray(zips)) return zips.join(', ');
    try {
      return JSON.parse(zips).join(', ');
    } catch (e) {
      return zips;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Link href="/rescue-squads" style={{ textDecoration: 'none', color: '#64748b', display: 'inline-block', marginBottom: '1rem' }}>
            ← Back to Search
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
                {squad.name}
              </h1>
              <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '1.1rem' }}>
                <span>📍 {squad.city}, {squad.state}</span>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', gap: '3rem', marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{squad.members?.length || 0}</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Members</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{squad.successfulReunions || 0}</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Reunions</div>
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
                    {(squad.activeCases || 0) + (squad.successfulReunions || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div >
      </div>


      {/* Coverage Area Map */}
      {
        squad.centerLatitude && squad.centerLongitude && (
          <div style={{ marginBottom: '2rem' }}>
            <SquadCoverageMap
              latitude={squad.centerLatitude}
              longitude={squad.centerLongitude}
              radiusMiles={squad.radiusMiles}
              city={squad.city}
              state={squad.state}
            />
          </div>
        )
      }

      {/* Available Cases (Leaders Only) */}
      {
        userRole && ['FOUNDER', 'LEADER'].includes(userRole) && (
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
        )
      }

      {/* Active Cases (All Members) */}
      {
        isMember && (
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
                  🚨 Active Operations
                </h2>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  Cases currently being worked on by this squad
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
                  onMouseEnter={(e) => {
                    if (!activeCasesLoading) e.currentTarget.style.background = '#5568d3';
                  }}
                  onMouseLeave={(e) => {
                    if (!activeCasesLoading) e.currentTarget.style.background = '#667eea';
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
                  {userRole && ['FOUNDER', 'LEADER'].includes(userRole)
                    ? 'Accept cases from the available list above to begin rescue operations'
                    : 'Squad leaders will assign cases when new pets need help'}
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
                  const participationRate = assignment._count.participants / (squad._count?.members || 1);

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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = assignment.isUserParticipating
                          ? '0 4px 12px rgba(16, 185, 129, 0.15)'
                          : '0 2px 8px rgba(0, 0, 0, 0.05)';
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
                                onMouseEnter={(e) => {
                                  if (optingCase !== assignment.id) {
                                    e.currentTarget.style.background = '#ef4444';
                                    e.currentTarget.style.color = 'white';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (optingCase !== assignment.id) {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.color = '#ef4444';
                                  }
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
                              onMouseEnter={(e) => {
                                if (optingCase !== assignment.id) {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (optingCase !== assignment.id) {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                                }
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
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#667eea';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.color = '#667eea';
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
        )
      }

      {/* Members Preview */}
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

      {/* Divisions */}
      {
        squad.divisions && squad.divisions.length > 0 && (
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
              marginBottom: '2rem'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  color: '#0f172a',
                  marginBottom: '0.25rem'
                }}>
                  🎯 Specialized Divisions
                </h2>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}>
                  Expert teams focused on specific rescue operations
                </p>
              </div>
              <div style={{
                padding: '0.75rem 1.25rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.9rem'
              }}>
                {squad.divisions.length} Active Division{squad.divisions.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem'
            }}>
              {squad.divisions.map((division, idx) => {
                const divisionColors = [
                  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '#667eea', light: '#f0f4ff' },
                  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: '#f5576c', light: '#fff0f5' },
                  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: '#4facfe', light: '#f0faff' },
                  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: '#43e97b', light: '#f0fff4' },
                  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', border: '#fa709a', light: '#fff8f0' },
                  { bg: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', border: '#30cfd0', light: '#f0f9ff' }
                ];
                const colorScheme = divisionColors[idx % divisionColors.length];

                return (
                  <div
                    key={division.id}
                    style={{
                      position: 'relative',
                      padding: '1.75rem',
                      border: `2px solid ${colorScheme.border}`,
                      borderRadius: '12px',
                      background: 'white',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
                      e.currentTarget.style.background = colorScheme.light;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    {/* Gradient accent bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: colorScheme.bg
                    }} />

                    {/* Division icon */}
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      background: colorScheme.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      fontSize: '1.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}>
                      {division.name.toLowerCase().includes('search') ? '🔍' :
                        division.name.toLowerCase().includes('transport') ? '🚗' :
                          division.name.toLowerCase().includes('medical') ? '⚕️' :
                            division.name.toLowerCase().includes('comm') ? '📡' :
                              division.name.toLowerCase().includes('train') ? '📚' :
                                '⭐'}
                    </div>

                    {/* Division name */}
                    <h3 style={{
                      fontSize: '1.2rem',
                      fontWeight: '800',
                      color: '#0f172a',
                      marginBottom: '0.75rem',
                      lineHeight: '1.3'
                    }}>
                      {division.name}
                    </h3>

                    {/* Division description */}
                    {division.description && (
                      <p style={{
                        fontSize: '0.9rem',
                        color: '#64748b',
                        lineHeight: '1.5',
                        marginBottom: '1rem'
                      }}>
                        {division.description.length > 80
                          ? division.description.substring(0, 80) + '...'
                          : division.description}
                      </p>
                    )}

                    {/* Stats row */}
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      marginTop: 'auto',
                      paddingTop: '1rem',
                      borderTop: '1px solid #e2e8f0'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          marginBottom: '0.25rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          fontWeight: '600'
                        }}>
                          Members
                        </div>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: '900',
                          color: '#0f172a'
                        }}>
                          {division.totalMembers || 0}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          marginBottom: '0.25rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          fontWeight: '600'
                        }}>
                          Status
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block'
                          }}></span>
                          Active
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      }

    </div >
  );
}
