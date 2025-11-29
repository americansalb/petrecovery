'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamic import for map (no SSR)
const MissionMap = dynamic(() => import('./MissionMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b'
    }}>
      Loading map...
    </div>
  )
});

// Urgency color based on hours missing
function getUrgencyColor(lastSeenAt) {
  if (!lastSeenAt) return '#f59e0b';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hours < 4) return '#dc2626'; // Red - Critical
  if (hours < 24) return '#f59e0b'; // Orange - Active
  return '#eab308'; // Yellow - Extended
}

function getUrgencyLabel(lastSeenAt) {
  if (!lastSeenAt) return 'Unknown';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}

export default function MissionControlPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Core state
  const [squad, setSquad] = useState(null);
  const [cases, setCases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [joiningCase, setJoiningCase] = useState(null);

  // Load squad and cases data
  const loadData = useCallback(async () => {
    if (!params.id) return;

    try {
      // Fetch squad details and nearby cases in parallel
      const [squadRes, casesRes] = await Promise.all([
        fetch(`/api/rescue-squads/${params.id}`),
        fetch(`/api/rescue-squads/${params.id}/nearby-cases`)
      ]);

      if (squadRes.ok) {
        const squadData = await squadRes.json();
        setSquad(squadData.squad);

        // Check user membership
        if (session?.user?.id && squadData.squad.members) {
          const membership = squadData.squad.members.find(
            m => m.userId === session.user.id && m.isActive
          );
          if (membership) {
            setUserRole(membership.role);
          }
        }
      }

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData.cases || []);
        if (casesData.userRole) {
          setUserRole(casesData.userRole);
        }
      }

      // Generate some activity items (will be replaced with real API)
      setActivities([
        { id: 1, type: 'info', message: 'Mission Control active', time: new Date() },
      ]);

    } catch (err) {
      console.error('Error loading mission control data:', err);
      setError('Failed to load mission control');
    } finally {
      setLoading(false);
    }
  }, [params.id, session?.user?.id]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData, router]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Join a search
  const handleJoinSearch = async (caseItem) => {
    setJoiningCase(caseItem.id);
    try {
      // Navigate to the case coordination page
      router.push(`/cases/${caseItem.caseNumber}/coordinate`);
    } catch (err) {
      console.error('Error joining search:', err);
    } finally {
      setJoiningCase(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #334155',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite'
          }} />
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Loading Mission Control...</div>
        </div>
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div style={{
        height: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Unable to Load</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{error || 'Squad not found'}</p>
          <Link
            href="/rescue-squads"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Back to Squads
          </Link>
        </div>
      </div>
    );
  }

  const activeCasesCount = cases.filter(c => c.status === 'ACTIVE').length;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f172a',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        padding: '0.75rem 1rem',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/rescue-squads/${params.id}`}
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '1.25rem' }}
          >
            ←
          </Link>
          <div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ color: '#ef4444' }}>●</span>
              MISSION CONTROL
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {squad.name} • {squad.city}, {squad.state}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>
              {activeCasesCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
              Active
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6' }}>
              {squad._count?.members || squad.members?.length || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
              Members
            </div>
          </div>
          {userRole && (
            <div style={{
              padding: '0.35rem 0.75rem',
              background: userRole === 'FOUNDER' ? '#7c2d12' :
                         userRole === 'LEADER' ? '#854d0e' : '#1e3a5f',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}>
              {userRole}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Map Container */}
        <div style={{
          flex: 1,
          position: 'relative',
          minWidth: 0
        }}>
          <MissionMap
            squad={squad}
            cases={cases}
            selectedCase={selectedCase}
            onSelectCase={setSelectedCase}
          />

          {/* Map Overlay - Quick Stats */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #334155',
            fontSize: '0.85rem'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {cases.length} cases in range
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              {squad.radiusMiles || 10} mile radius
            </div>
          </div>
        </div>

        {/* Sidebar - Cases List */}
        <aside style={{
          width: sidebarOpen ? '340px' : '0',
          background: '#1e293b',
          borderLeft: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          flexShrink: 0
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: '700' }}>NEARBY CASES</div>
            <button
              onClick={loadData}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Cases List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem'
          }}>
            {cases.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
                <div style={{ fontWeight: '600' }}>No active cases nearby</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  All clear in your area
                </div>
              </div>
            ) : (
              cases.map(caseItem => (
                <div
                  key={caseItem.id}
                  onClick={() => setSelectedCase(caseItem)}
                  style={{
                    padding: '1rem',
                    background: selectedCase?.id === caseItem.id ? '#334155' : '#0f172a',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    border: `2px solid ${selectedCase?.id === caseItem.id ? getUrgencyColor(caseItem.lastSeenAt) : 'transparent'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Case Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: '0.75rem'
                  }}>
                    {/* Pet Photo */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#334155',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: `2px solid ${getUrgencyColor(caseItem.lastSeenAt)}`
                    }}>
                      {caseItem.petPhotoUrl ? (
                        <img
                          src={caseItem.petPhotoUrl}
                          alt={caseItem.petName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem'
                        }}>
                          {caseItem.petSpecies === 'DOG' ? '🐕' :
                           caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
                        </div>
                      )}
                    </div>

                    {/* Pet Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getUrgencyColor(caseItem.lastSeenAt),
                          animation: 'pulse 2s infinite'
                        }} />
                        <style jsx>{`
                          @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.5; }
                          }
                        `}</style>
                        {caseItem.petName || 'Unknown'}
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        marginTop: '0.15rem'
                      }}>
                        {caseItem.petSpecies} • {caseItem.petBreed || 'Unknown breed'}
                      </div>
                    </div>
                  </div>

                  {/* Case Details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div>
                      <div style={{ color: '#64748b' }}>Missing</div>
                      <div style={{
                        fontWeight: '600',
                        color: getUrgencyColor(caseItem.lastSeenAt)
                      }}>
                        {getUrgencyLabel(caseItem.lastSeenAt)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Distance</div>
                      <div style={{ fontWeight: '600' }}>
                        {caseItem.distance ? `${caseItem.distance} mi` : 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {caseItem.lastSeenAddress && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      marginBottom: '0.75rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      📍 {caseItem.lastSeenAddress}
                    </div>
                  )}

                  {/* Join Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinSearch(caseItem);
                    }}
                    disabled={joiningCase === caseItem.id}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: caseItem.isAssignedToSquad
                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      opacity: joiningCase === caseItem.id ? 0.7 : 1
                    }}
                  >
                    {joiningCase === caseItem.id ? 'Opening...' :
                     caseItem.isAssignedToSquad ? '→ VIEW ACTIVE SEARCH' : '→ JOIN SEARCH'}
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Action Bar */}
      <footer style={{
        padding: '0.75rem 1rem',
        background: '#1e293b',
        borderTop: '1px solid #334155',
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        flexShrink: 0
      }}>
        <button style={{
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '700',
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📍 Report Sighting
        </button>

        {['FOUNDER', 'LEADER'].includes(userRole) && (
          <button style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📢 Broadcast Alert
          </button>
        )}

        <button style={{
          padding: '0.75rem 1.5rem',
          background: '#334155',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🆘 Request Help
        </button>
      </footer>

      {/* Toggle Sidebar Button (Mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          right: sidebarOpen ? '350px' : '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#1e293b',
          border: '1px solid #334155',
          color: 'white',
          width: '32px',
          height: '48px',
          borderRadius: '8px 0 0 8px',
          cursor: 'pointer',
          zIndex: 200,
          transition: 'right 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {sidebarOpen ? '→' : '←'}
      </button>
    </div>
  );
}
