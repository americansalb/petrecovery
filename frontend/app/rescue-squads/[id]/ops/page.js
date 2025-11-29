'use client';

/**
 * Squad Operations - Map-OS Interface
 *
 * Route: /rescue-squads/[id]/ops
 *
 * Full-screen tactical map with HUD overlays.
 * The map IS the interface.
 */

import { useEffect, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { SquadProvider, useSquad } from '../context/SquadContext';

// Dynamic imports for map (no SSR)
const TacticalMap = dynamic(() => import('../components/TacticalMap'), {
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
import TopBar from '../components/TopBar';
import CaseCarousel from '../components/CaseCarousel';
import CaseFocusPanel from '../components/CaseFocusPanel';
import ActionBar from '../components/ActionBar';
import ContainmentOverlay from '../components/ContainmentOverlay';

function SquadOperationsInner({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    setSquad,
    setCases,
    setVolunteers,
    setUserRole,
  } = useSquad();

  // Load squad and cases data
  const loadData = useCallback(async () => {
    if (!params.id) return;

    try {
      // Fetch squad and nearby cases in parallel
      const [squadRes, casesRes] = await Promise.all([
        fetch(`/api/rescue-squads/${params.id}`),
        fetch(`/api/rescue-squads/${params.id}/nearby-cases`),
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
      } else {
        throw new Error('Failed to load squad');
      }

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData.cases || []);
        if (casesData.userRole) {
          setUserRole(casesData.userRole);
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

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}/ops`);
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
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

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

  if (error) {
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
            Back to Squads
          </button>
        </div>
      </div>
    );
  }

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
};
