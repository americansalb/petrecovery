'use client';

/**
 * Squad Operations - Map-OS Interface
 *
 * Route: /rescue-squads/[id]
 *
 * Full-screen tactical map with HUD overlays.
 * The map IS the interface - not a page with a map embedded.
 *
 * Architecture:
 * - Layer 0: Full-screen TacticalMap (Leaflet)
 * - Layer 1: HUD overlays (TopBar, CaseCarousel, ActionBar, CaseFocusPanel)
 * - Layer 2: Modal overlays (ContainmentOverlay, settings panels)
 */

import { useEffect, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { SquadProvider, useSquad } from './context/SquadContext';

// Dynamic imports for map (no SSR)
const TacticalMap = dynamic(() => import('./components/TacticalMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #334155',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite',
        }} />
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div>Loading tactical map...</div>
      </div>
    </div>
  ),
});

// HUD Components
import TopBar from './components/TopBar';
import CaseCarousel from './components/CaseCarousel';
import CaseFocusPanel from './components/CaseFocusPanel';
import ActionBar from './components/ActionBar';
import ContainmentOverlay from './components/ContainmentOverlay';

function SquadOperationsInner({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joining, setJoining] = useState(false);
  const [legalRedirect, setLegalRedirect] = useState(null);

  const {
    squad,
    setSquad,
    setCases,
    setVolunteers,
    userRole,
    setUserRole,
  } = useSquad();

  // Load squad and cases data
  const loadData = useCallback(async () => {
    if (!params.id) return;

    try {
      // Fetch squad data first
      const squadRes = await fetch(`/api/rescue-squads/${params.id}`);

      if (!squadRes.ok) {
        if (squadRes.status === 404) {
          throw new Error('Squad not found');
        }
        throw new Error('Failed to load squad');
      }

      const squadData = await squadRes.json();
      setSquad(squadData.squad);

      // Check user membership
      let isMember = false;
      if (session?.user?.id && squadData.squad.members) {
        const membership = squadData.squad.members.find(
          m => m.userId === session.user.id && m.isActive
        );
        if (membership) {
          setUserRole(membership.role);
          isMember = true;
        } else {
          setUserRole(null);
          setShowJoinPrompt(true);
        }
      } else if (session?.user?.id) {
        // User is logged in but not a member
        setShowJoinPrompt(true);
      }

      // Load nearby cases if member
      if (isMember) {
        const casesRes = await fetch(`/api/rescue-squads/${params.id}/nearby-cases`);
        if (casesRes.ok) {
          const casesData = await casesRes.json();
          setCases(casesData.cases || []);
          if (casesData.userRole) {
            setUserRole(casesData.userRole);
          }
        }
      }

      // TODO: Fetch active volunteers
      setVolunteers([]);

    } catch (err) {
      console.error('Error loading operations data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id, session?.user?.id, setSquad, setCases, setVolunteers, setUserRole]);

  // Handle joining the squad
  const handleJoin = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}`);
      return;
    }

    setJoining(true);

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          setLegalRedirect(data.redirectTo);
          return;
        }
        throw new Error(data.error || 'Failed to join squad');
      }

      setShowJoinPrompt(false);
      setUserRole('MEMBER');
      loadData(); // Reload to get cases
    } catch (err) {
      console.error('Join error:', err);
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}`);
    }
  }, [status, router, params.id]);

  // Initial load
  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (userRole) {
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [loadData, userRole]);

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.spinner} />
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={styles.loadingText}>Initializing Operations...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !squad) {
    return (
      <div style={styles.errorScreen}>
        <div style={styles.errorContent}>
          <div style={styles.errorIcon}>⚠️</div>
          <h2 style={styles.errorTitle}>Unable to Load</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button
            onClick={() => router.push('/rescue-squads')}
            style={styles.errorButton}
          >
            Browse Rescue Squads
          </button>
        </div>
      </div>
    );
  }

  // Legal waiver redirect
  if (legalRedirect) {
    return (
      <div style={styles.legalScreen}>
        <div style={styles.legalContent}>
          <div style={styles.legalIcon}>📋</div>
          <h2 style={styles.legalTitle}>Legal Agreement Required</h2>
          <p style={styles.legalMessage}>
            Before joining rescue operations, you need to review and accept our volunteer agreement.
          </p>
          <button
            onClick={() => router.push(legalRedirect)}
            style={styles.legalButton}
          >
            Review Agreement →
          </button>
        </div>
      </div>
    );
  }

  // Join prompt for non-members
  if (showJoinPrompt && !userRole) {
    return (
      <div style={styles.joinScreen}>
        <div style={styles.joinContent}>
          <div style={styles.joinHeader}>
            <div style={styles.squadIcon}>🦮</div>
            <h1 style={styles.squadName}>{squad?.name || 'Rescue Squad'}</h1>
            {squad?.city && (
              <p style={styles.squadLocation}>
                📍 {squad.city}, {squad.state}
              </p>
            )}
          </div>

          <div style={styles.joinStats}>
            <div style={styles.joinStat}>
              <span style={styles.joinStatValue}>{squad?._count?.members || 0}</span>
              <span style={styles.joinStatLabel}>Members</span>
            </div>
            <div style={styles.joinStatDivider} />
            <div style={styles.joinStat}>
              <span style={styles.joinStatValue}>{squad?.activeCases || 0}</span>
              <span style={styles.joinStatLabel}>Active Cases</span>
            </div>
            <div style={styles.joinStatDivider} />
            <div style={styles.joinStat}>
              <span style={styles.joinStatValue}>{squad?.successfulReunions || 0}</span>
              <span style={styles.joinStatLabel}>Reunions</span>
            </div>
          </div>

          <p style={styles.joinDescription}>
            {squad?.description || 'Join this rescue squad to help find lost pets in your community.'}
          </p>

          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              ...styles.joinButton,
              opacity: joining ? 0.7 : 1,
              cursor: joining ? 'not-allowed' : 'pointer',
            }}
          >
            {joining ? 'Joining...' : '🚀 Join Squad & Start Helping'}
          </button>

          <button
            onClick={() => router.push('/rescue-squads')}
            style={styles.browseButton}
          >
            ← Browse Other Squads
          </button>

          {error && (
            <div style={styles.joinError}>{error}</div>
          )}
        </div>
      </div>
    );
  }

  // Main Map-OS Interface
  return (
    <div style={styles.container}>
      {/* Layer 0: Full Screen Map */}
      <TacticalMap />

      {/* Layer 1: HUD Overlays */}
      <TopBar />
      <CaseCarousel />
      <CaseFocusPanel />
      <ActionBar />

      {/* Layer 2: Modal Overlays */}
      <ContainmentOverlay />
    </div>
  );
}

export default function SquadOperationsPage({ params }) {
  return (
    <SquadProvider>
      <SquadOperationsInner params={params} />
    </SquadProvider>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#0f172a',
    overflow: 'hidden',
  },

  // Loading Screen
  loadingScreen: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingContent: {
    textAlign: 'center',
  },

  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #334155',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    color: '#94a3b8',
    fontSize: '16px',
    fontWeight: '600',
  },

  // Error Screen
  errorScreen: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  errorContent: {
    textAlign: 'center',
    maxWidth: '400px',
  },

  errorIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },

  errorTitle: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },

  errorMessage: {
    color: '#94a3b8',
    fontSize: '16px',
    margin: '0 0 24px 0',
  },

  errorButton: {
    padding: '12px 24px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // Legal Screen
  legalScreen: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  legalContent: {
    textAlign: 'center',
    maxWidth: '400px',
  },

  legalIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },

  legalTitle: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },

  legalMessage: {
    color: '#94a3b8',
    fontSize: '16px',
    margin: '0 0 24px 0',
    lineHeight: '1.5',
  },

  legalButton: {
    padding: '14px 28px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  // Join Screen
  joinScreen: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  joinContent: {
    background: 'rgba(30, 41, 59, 0.9)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    border: '1px solid #334155',
  },

  joinHeader: {
    textAlign: 'center',
    marginBottom: '24px',
  },

  squadIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },

  squadName: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 8px 0',
  },

  squadLocation: {
    color: '#94a3b8',
    fontSize: '16px',
    margin: 0,
  },

  joinStats: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    padding: '20px',
    background: '#1e293b',
    borderRadius: '16px',
    marginBottom: '24px',
  },

  joinStat: {
    textAlign: 'center',
  },

  joinStatValue: {
    display: 'block',
    color: '#fff',
    fontSize: '28px',
    fontWeight: '800',
  },

  joinStatLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '4px',
  },

  joinStatDivider: {
    width: '1px',
    height: '40px',
    background: '#334155',
  },

  joinDescription: {
    color: '#94a3b8',
    fontSize: '16px',
    lineHeight: '1.6',
    textAlign: 'center',
    marginBottom: '32px',
  },

  joinButton: {
    width: '100%',
    padding: '18px',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '800',
    cursor: 'pointer',
    marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
  },

  browseButton: {
    width: '100%',
    padding: '14px',
    background: 'transparent',
    border: '2px solid #475569',
    borderRadius: '12px',
    color: '#94a3b8',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  joinError: {
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
  },
};
