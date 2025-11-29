'use client';

/**
 * Squad Operations - Map-OS Interface
 *
 * Route: /rescue-squads/[id]
 *
 * Full-screen tactical map with HUD overlays.
 * The map IS the interface - not a page with a map embedded.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SquadOperationsPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [squad, setSquad] = useState(null);
  const [cases, setCases] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Load squad data
  const loadData = useCallback(async () => {
    if (!params.id || status !== 'authenticated') return;

    try {
      const squadRes = await fetch(`/api/rescue-squads/${params.id}`);

      if (!squadRes.ok) {
        throw new Error(squadRes.status === 404 ? 'Squad not found' : 'Failed to load squad');
      }

      const squadData = await squadRes.json();
      setSquad(squadData.squad);

      // Check membership
      let memberFound = false;
      if (session?.user?.id && squadData.squad.members) {
        const membership = squadData.squad.members.find(
          m => m.userId === session.user.id && m.isActive
        );
        if (membership) {
          setUserRole(membership.role);
          setIsMember(true);
          memberFound = true;
        }
      }

      // Load cases if member
      if (memberFound) {
        const casesRes = await fetch(`/api/rescue-squads/${params.id}/nearby-cases`);
        if (casesRes.ok) {
          const casesData = await casesRes.json();
          setCases(casesData.cases || []);
        }
      }
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id, session?.user?.id, status]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!squad?.centerLatitude || !squad?.centerLongitude) return;

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        const map = L.map(mapRef.current, {
          center: [squad.centerLatitude, squad.centerLongitude],
          zoom: 13,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20,
          attribution: '',
        }).addTo(map);

        // Squad coverage circle
        if (squad.radiusMiles) {
          L.circle([squad.centerLatitude, squad.centerLongitude], {
            radius: squad.radiusMiles * 1609.34,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '8, 8',
          }).addTo(map);
        }

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error('Map init error:', err);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [squad]);

  // Add case markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const addMarkers = async () => {
      const L = (await import('leaflet')).default;

      cases.forEach(caseItem => {
        if (!caseItem.lastSeenLatitude || !caseItem.lastSeenLongitude) return;

        const hours = caseItem.lastSeenAt
          ? (Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000
          : 999;
        const color = hours < 4 ? '#ef4444' : hours < 24 ? '#f97316' : '#eab308';

        const icon = L.divIcon({
          html: `
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 3px solid ${color};
              background: ${caseItem.petPhotoUrl ? `url(${caseItem.petPhotoUrl})` : '#1e293b'};
              background-size: cover;
              background-position: center;
              box-shadow: 0 0 15px ${color}60;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${!caseItem.petPhotoUrl ? '<span style="font-size: 18px;">🐾</span>' : ''}
            </div>
          `,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker(
          [caseItem.lastSeenLatitude, caseItem.lastSeenLongitude],
          { icon }
        ).addTo(mapInstanceRef.current);

        marker.on('click', () => setSelectedCase(caseItem));

        marker.bindTooltip(`<strong>${caseItem.petName || 'Unknown'}</strong>`, {
          direction: 'top',
          offset: [0, -20],
        });
      });
    };

    addMarkers();
  }, [mapReady, cases]);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/rescue-squads/${params.id}`);
    }
  }, [status, router, params.id]);

  // Load data
  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  // Join squad
  const handleJoin = async () => {
    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/rescue-squads/${params.id}/join`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
          router.push(data.redirectTo);
          return;
        }
        throw new Error(data.error || 'Failed to join');
      }

      setIsMember(true);
      setUserRole('MEMBER');
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  // Loading
  if (status === 'loading' || loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <div style={styles.loadingText}>Loading Operations...</div>
      </div>
    );
  }

  // Error
  if (error && !squad) {
    return (
      <div style={styles.errorScreen}>
        <div style={styles.errorIcon}>⚠️</div>
        <h2 style={styles.errorTitle}>Error</h2>
        <p style={styles.errorText}>{error}</p>
        <Link href="/rescue-squads" style={styles.errorLink}>
          ← Back to Squads
        </Link>
      </div>
    );
  }

  // Join prompt
  if (!isMember && squad) {
    return (
      <div style={styles.joinScreen}>
        <div style={styles.joinCard}>
          <div style={styles.joinIcon}>🦮</div>
          <h1 style={styles.joinTitle}>{squad.name}</h1>
          <p style={styles.joinLocation}>📍 {squad.city}, {squad.state}</p>

          <div style={styles.joinStats}>
            <div style={styles.joinStat}>
              <span style={styles.joinStatNum}>{squad._count?.members || 0}</span>
              <span style={styles.joinStatLabel}>Members</span>
            </div>
            <div style={styles.joinStat}>
              <span style={styles.joinStatNum}>{squad.activeCases || 0}</span>
              <span style={styles.joinStatLabel}>Active</span>
            </div>
            <div style={styles.joinStat}>
              <span style={styles.joinStatNum}>{squad.successfulReunions || 0}</span>
              <span style={styles.joinStatLabel}>Reunions</span>
            </div>
          </div>

          <button onClick={handleJoin} disabled={joining} style={styles.joinButton}>
            {joining ? 'Joining...' : 'Join Squad'}
          </button>

          <Link href="/rescue-squads" style={styles.browseLink}>
            ← Browse Other Squads
          </Link>
        </div>
      </div>
    );
  }

  // Main Map-OS Interface
  return (
    <div style={styles.container}>
      {/* Layer 0: Map */}
      <div ref={mapRef} style={styles.map} />

      {/* Layer 1: TopBar */}
      <header style={styles.topBar}>
        <Link href="/rescue-squads" style={styles.backBtn}>←</Link>
        <div style={styles.squadInfo}>
          <div style={styles.squadName}>{squad?.name}</div>
          <div style={styles.squadLoc}>{squad?.city}, {squad?.state}</div>
        </div>
        <div style={styles.topStats}>
          <div style={styles.topStat}>
            <span style={styles.topStatNum}>{cases.length}</span>
            <span style={styles.topStatLabel}>Active</span>
          </div>
        </div>
        <div style={{
          ...styles.roleBadge,
          background: ['FOUNDER', 'LEADER'].includes(userRole) ? '#dc2626' : '#22c55e',
        }}>
          {userRole || 'MEMBER'}
        </div>
      </header>

      {/* Layer 1: Case Carousel */}
      {!selectedCase && (
        <div style={styles.carousel}>
          <div style={styles.carouselHeader}>
            <span style={styles.carouselTitle}>🔴 {cases.length} Active Case{cases.length !== 1 ? 's' : ''}</span>
          </div>
          {cases.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>✓</span>
              <span>No active cases in your area</span>
            </div>
          ) : (
            <div style={styles.carouselScroll}>
              {cases.map(c => (
                <button key={c.id} onClick={() => setSelectedCase(c)} style={styles.caseCard}>
                  <div style={{
                    ...styles.casePhoto,
                    backgroundImage: c.petPhotoUrl ? `url(${c.petPhotoUrl})` : 'none',
                  }}>
                    {!c.petPhotoUrl && <span>🐾</span>}
                  </div>
                  <div style={styles.caseInfo}>
                    <div style={styles.caseName}>{c.petName || 'Unknown'}</div>
                    <div style={styles.caseTime}>
                      {c.lastSeenAt ? getTimeAgo(c.lastSeenAt) : 'Unknown'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Layer 1: Case Focus Panel */}
      {selectedCase && (
        <div style={styles.focusPanel}>
          <button onClick={() => setSelectedCase(null)} style={styles.focusClose}>✕</button>
          <div style={styles.focusHeader}>
            <div style={{
              ...styles.focusPhoto,
              backgroundImage: selectedCase.petPhotoUrl ? `url(${selectedCase.petPhotoUrl})` : 'none',
            }}>
              {!selectedCase.petPhotoUrl && <span style={{ fontSize: '32px' }}>🐾</span>}
            </div>
            <div style={styles.focusInfo}>
              <h2 style={styles.focusName}>{selectedCase.petName || 'Unknown'}</h2>
              <p style={styles.focusBreed}>{selectedCase.petColor} {selectedCase.petSpecies}</p>
              <p style={styles.focusTime}>Missing {getTimeAgo(selectedCase.lastSeenAt)}</p>
            </div>
          </div>
          <p style={styles.focusLocation}>📍 {selectedCase.lastSeenAddress || 'Unknown location'}</p>
          <Link
            href={`/cases/${selectedCase.caseNumber || selectedCase.id}`}
            style={styles.focusJoinBtn}
          >
            🔍 VIEW CASE DETAILS
          </Link>
        </div>
      )}

      {/* Layer 1: ActionBar */}
      <div style={styles.actionBar}>
        <button
          onClick={() => setIsCheckedIn(!isCheckedIn)}
          style={{
            ...styles.actionBtn,
            background: isCheckedIn ? '#22c55e' : '#334155',
          }}
        >
          <span>{isCheckedIn ? '✓' : '📍'}</span>
          <span style={styles.actionLabel}>{isCheckedIn ? 'Active' : 'Check In'}</span>
        </button>

        <button style={styles.sightingBtn}>
          <span style={{ fontSize: '24px' }}>👁</span>
          <span style={styles.sightingText}>I SEE ONE</span>
        </button>

        <Link href="/report/new" style={styles.actionBtn}>
          <span>🚨</span>
          <span style={styles.actionLabel}>Report</span>
        </Link>
      </div>

      <style jsx global>{`
        .leaflet-container { background: #0f172a !important; z-index: 1 !important; }
        .leaflet-control-zoom { margin-bottom: 100px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return 'unknown';
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
  },

  map: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },

  // TopBar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: '12px',
    zIndex: 100,
  },

  backBtn: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '20px',
    padding: '8px',
  },

  squadInfo: {
    flex: 1,
  },

  squadName: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
  },

  squadLoc: {
    color: '#64748b',
    fontSize: '12px',
  },

  topStats: {
    display: 'flex',
    gap: '16px',
  },

  topStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  topStatNum: {
    color: '#f97316',
    fontSize: '18px',
    fontWeight: '800',
  },

  topStatLabel: {
    color: '#64748b',
    fontSize: '10px',
    textTransform: 'uppercase',
  },

  roleBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
  },

  // Carousel
  carousel: {
    position: 'absolute',
    bottom: '100px',
    left: 0,
    right: 0,
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #334155',
    borderRadius: '16px 16px 0 0',
    padding: '12px 0',
    zIndex: 100,
  },

  carouselHeader: {
    padding: '0 16px 12px',
  },

  carouselTitle: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
  },

  carouselScroll: {
    display: 'flex',
    gap: '12px',
    padding: '0 16px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },

  emptyState: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 16px',
    color: '#64748b',
  },

  emptyIcon: {
    color: '#22c55e',
    fontSize: '20px',
  },

  caseCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    background: '#1e293b',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    minWidth: '180px',
    flexShrink: 0,
  },

  casePhoto: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid #f97316',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },

  caseInfo: {
    textAlign: 'left',
  },

  caseName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
  },

  caseTime: {
    color: '#f97316',
    fontSize: '12px',
    fontWeight: '600',
  },

  // Focus Panel
  focusPanel: {
    position: 'absolute',
    bottom: '100px',
    left: 0,
    right: 0,
    background: 'rgba(15, 23, 42, 0.98)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid #334155',
    borderRadius: '20px 20px 0 0',
    padding: '20px',
    zIndex: 100,
  },

  focusClose: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    background: '#334155',
    border: 'none',
    borderRadius: '50%',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
  },

  focusHeader: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },

  focusPhoto: {
    width: '72px',
    height: '72px',
    borderRadius: '16px',
    border: '3px solid #f97316',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  focusInfo: {
    flex: 1,
  },

  focusName: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '800',
    margin: 0,
  },

  focusBreed: {
    color: '#94a3b8',
    fontSize: '14px',
    margin: '4px 0',
  },

  focusTime: {
    color: '#f97316',
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
  },

  focusLocation: {
    color: '#64748b',
    fontSize: '14px',
    marginBottom: '16px',
  },

  focusJoinBtn: {
    display: 'block',
    textAlign: 'center',
    padding: '16px',
    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '800',
    textDecoration: 'none',
  },

  // ActionBar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80px',
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 16px',
    zIndex: 100,
  },

  actionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '70px',
    height: '56px',
    background: '#334155',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#fff',
    fontSize: '20px',
  },

  actionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    marginTop: '2px',
  },

  sightingBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '88px',
    height: '88px',
    marginTop: '-30px',
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    border: '4px solid #0f172a',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)',
    color: '#fff',
  },

  sightingText: {
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '0.5px',
  },

  // Loading/Error/Join screens
  loadingScreen: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },

  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #334155',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    color: '#94a3b8',
    fontSize: '16px',
  },

  errorScreen: {
    position: 'fixed',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    textAlign: 'center',
  },

  errorIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },

  errorTitle: {
    color: '#fff',
    fontSize: '24px',
    margin: '0 0 8px',
  },

  errorText: {
    color: '#94a3b8',
    margin: '0 0 24px',
  },

  errorLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '600',
  },

  joinScreen: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  joinCard: {
    background: 'rgba(30, 41, 59, 0.9)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
  },

  joinIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },

  joinTitle: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 8px',
  },

  joinLocation: {
    color: '#94a3b8',
    margin: '0 0 24px',
  },

  joinStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
    marginBottom: '32px',
  },

  joinStat: {
    textAlign: 'center',
  },

  joinStatNum: {
    display: 'block',
    color: '#fff',
    fontSize: '28px',
    fontWeight: '800',
  },

  joinStatLabel: {
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'uppercase',
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
  },

  browseLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '14px',
  },
};
