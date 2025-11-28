'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const SquadCoverageMap = dynamic(() => import('@/app/components/SquadCoverageMap'), {
  ssr: false,
  loading: () => <div style={{ height: '400px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [acceptCaseConfirm, setAcceptCaseConfirm] = useState(null);
  const [optOutConfirm, setOptOutConfirm] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

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

  const handleLeave = () => {
    setLeaveConfirmOpen(true);
  };

  const confirmLeave = async () => {
    setLeaveConfirmOpen(false);
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
      setSuccessMessage('You have left the squad.');
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

  const handleAcceptCase = (caseId, petName) => {
    setAcceptCaseConfirm({ caseId, petName });
  };

  const confirmAcceptCase = async () => {
    if (!acceptCaseConfirm) return;

    const { caseId, petName } = acceptCaseConfirm;
    setAcceptCaseConfirm(null);
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
      setSuccessMessage(`Case for ${petName} accepted! All members will be notified.`);
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

  const handleOptOut = (assignmentId) => {
    setOptOutConfirm(assignmentId);
  };

  const confirmOptOut = async () => {
    if (!optOutConfirm) return;

    const assignmentId = optOutConfirm;
    setOptOutConfirm(null);
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
      setSuccessMessage('You have left the case. You can rejoin anytime.');
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
      {/* Leave Squad Confirmation */}
      {leaveConfirmOpen && (
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
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#0f172a' }}>
              Leave Squad?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Are you sure you want to leave <strong>{squad?.name}</strong>? You will be removed from all active cases.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setLeaveConfirmOpen(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Leave Squad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Case Confirmation */}
      {acceptCaseConfirm && (
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
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#0f172a' }}>
              Accept Case?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Accept the case for <strong>{acceptCaseConfirm.petName}</strong>? All squad members will be notified.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setAcceptCaseConfirm(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAcceptCase}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Accept Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opt Out Confirmation */}
      {optOutConfirm && (
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
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#0f172a' }}>
              Leave Case?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Stop helping with this case? You can opt back in at any time.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setOptOutConfirm(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmOptOut}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Yes, Leave Case
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
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
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

        {/* Coverage Area Map */}
        {squad.centerLatitude && squad.centerLongitude && (
          <div style={{ marginBottom: '2rem' }}>
            <SquadCoverageMap
              latitude={squad.centerLatitude}
              longitude={squad.centerLongitude}
              radiusMiles={squad.radiusMiles}
              city={squad.city}
              state={squad.state}
            />
          </div>
        )}

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
                          onClick={() => handleAcceptCase(caseItem.id, caseItem.petName)}
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
        )}

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
        {squad.divisions && squad.divisions.length > 0 && (
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
