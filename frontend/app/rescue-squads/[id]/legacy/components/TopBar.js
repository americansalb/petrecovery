'use client';

/**
 * TopBar - Glassmorphism HUD Header
 *
 * Shows: Squad name, active volunteer count, user role, live status
 * Always visible on top of the map.
 */

import { useSquad, VIEW_MODES } from '../context/SquadContext';
import Link from 'next/link';

export default function TopBar() {
  const {
    squad,
    cases,
    volunteers,
    userRole,
    viewMode,
    selectedCase,
    isCheckedIn,
    clearSelection,
  } = useSquad();

  const activeCases = cases.filter(c => c.status === 'ACTIVE' || c.status === 'OPEN');
  const criticalCases = cases.filter(c => {
    if (!c.lastSeenAt) return false;
    const hours = (Date.now() - new Date(c.lastSeenAt).getTime()) / 3600000;
    return hours < 4;
  });

  const isLeader = ['FOUNDER', 'LEADER'].includes(userRole);

  return (
    <header style={styles.container}>
      {/* Left: Back / Squad Info */}
      <div style={styles.left}>
        {viewMode === VIEW_MODES.SINGLE_CASE ? (
          <button onClick={clearSelection} style={styles.backButton}>
            ← Back
          </button>
        ) : (
          <Link href="/rescue-squads" style={styles.backLink}>
            ←
          </Link>
        )}

        <div style={styles.squadInfo}>
          {viewMode === VIEW_MODES.SINGLE_CASE && selectedCase ? (
            <>
              <div style={styles.caseName}>{selectedCase.petName}</div>
              <div style={styles.caseDetail}>
                {selectedCase.petSpecies} • {getTimeAgo(selectedCase.lastSeenAt)}
              </div>
            </>
          ) : (
            <>
              <div style={styles.squadName}>{squad?.name || 'Loading...'}</div>
              <div style={styles.squadLocation}>
                {squad?.city}, {squad?.state}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center: Live Status */}
      {criticalCases.length > 0 && viewMode !== VIEW_MODES.SINGLE_CASE && (
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot}>●</span>
          <span style={styles.liveText}>
            {criticalCases.length} CRITICAL
          </span>
        </div>
      )}

      {/* Right: Stats & Role */}
      <div style={styles.right}>
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{activeCases.length}</span>
            <span style={styles.statLabel}>Active</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: '#22c55e' }}>
              {volunteers.length || squad?._count?.members || 0}
            </span>
            <span style={styles.statLabel}>Online</span>
          </div>
        </div>

        {userRole && (
          <div style={{
            ...styles.roleBadge,
            background: isLeader
              ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
              : isCheckedIn
                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                : '#334155',
          }}>
            {isLeader ? userRole : isCheckedIn ? 'ACTIVE' : 'MEMBER'}
          </div>
        )}
      </div>
    </header>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)}m missing`;
  if (hours < 24) return `${Math.round(hours)}h missing`;
  return `${Math.round(hours / 24)}d missing`;
}

const styles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 100,
  },

  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  backLink: {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '20px',
    padding: '8px',
  },

  backButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 12px',
  },

  squadInfo: {
    display: 'flex',
    flexDirection: 'column',
  },

  squadName: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
  },

  squadLocation: {
    color: '#64748b',
    fontSize: '12px',
  },

  caseName: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '800',
  },

  caseDetail: {
    color: '#f97316',
    fontSize: '12px',
    fontWeight: '600',
  },

  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    borderRadius: '20px',
  },

  liveDot: {
    color: '#ef4444',
    fontSize: '12px',
    animation: 'pulse 1.5s infinite',
  },

  liveText: {
    color: '#ef4444',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  statValue: {
    color: '#f97316',
    fontSize: '18px',
    fontWeight: '800',
  },

  statLabel: {
    color: '#64748b',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  statDivider: {
    width: '1px',
    height: '24px',
    background: '#334155',
  },

  roleBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
};
