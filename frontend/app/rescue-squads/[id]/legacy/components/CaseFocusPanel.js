'use client';

/**
 * CaseFocusPanel - Single Case Focus Overlay
 *
 * When a case is selected, this panel slides up with:
 * - Pet details
 * - Search zones
 * - Active volunteers on this case
 * - Quick actions (join, report sighting)
 */

import { useState } from 'react';
import { useSquad, VIEW_MODES } from '../context/SquadContext';

export default function CaseFocusPanel() {
  const {
    viewMode,
    selectedCase,
    userRole,
    clearSelection,
  } = useSquad();

  const [joining, setJoining] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (viewMode !== VIEW_MODES.SINGLE_CASE || !selectedCase) {
    return null;
  }

  const urgency = getUrgencyLevel(selectedCase.lastSeenAt);
  const color = getUrgencyColor(urgency);
  const timeAgo = getTimeAgo(selectedCase.lastSeenAt);
  const isLeader = ['FOUNDER', 'LEADER'].includes(userRole);

  const handleJoin = async () => {
    setJoining(true);
    try {
      // TODO: API call to join case
      await new Promise(r => setTimeout(r, 500));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{
      ...styles.container,
      height: expanded ? '70vh' : '280px',
    }}>
      {/* Drag handle */}
      <div style={styles.dragHandle} onClick={() => setExpanded(!expanded)}>
        <div style={styles.dragBar} />
      </div>

      {/* Header with pet info */}
      <div style={styles.header}>
        {/* Pet photo */}
        <div style={{
          ...styles.petPhoto,
          borderColor: color,
          backgroundImage: selectedCase.petPhotoUrl
            ? `url(${selectedCase.petPhotoUrl})`
            : 'none',
        }}>
          {!selectedCase.petPhotoUrl && (
            <span style={styles.speciesIcon}>
              {selectedCase.petSpecies === 'DOG' ? '🐕' :
               selectedCase.petSpecies === 'CAT' ? '🐈' : '🐾'}
            </span>
          )}
        </div>

        {/* Pet details */}
        <div style={styles.petInfo}>
          <h2 style={styles.petName}>{selectedCase.petName || 'Unknown'}</h2>
          <p style={styles.petBreed}>
            {selectedCase.petColor} {selectedCase.petSpecies}
            {selectedCase.petBreed && ` • ${selectedCase.petBreed}`}
          </p>
          <div style={{ ...styles.urgencyBadge, background: color }}>
            {urgency === 'CRITICAL' ? '🔴 CRITICAL' : `Missing ${timeAgo}`}
          </div>
        </div>

        {/* Close button */}
        <button onClick={clearSelection} style={styles.closeButton}>
          ✕
        </button>
      </div>

      {/* Quick stats */}
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statValue}>
            {selectedCase._count?.activeVolunteers || 0}
          </span>
          <span style={styles.statLabel}>Searching</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.stat}>
          <span style={styles.statValue}>
            {selectedCase._count?.sightings || 0}
          </span>
          <span style={styles.statLabel}>Sightings</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.stat}>
          <span style={styles.statValue}>
            {selectedCase._count?.zones || 0}
          </span>
          <span style={styles.statLabel}>Zones</span>
        </div>
      </div>

      {/* Last seen location */}
      <div style={styles.location}>
        <span style={styles.locationIcon}>📍</span>
        <div style={styles.locationText}>
          <div style={styles.locationLabel}>Last Seen</div>
          <div style={styles.locationAddress}>
            {selectedCase.lastSeenAddress || 'Unknown location'}
          </div>
        </div>
      </div>

      {/* Description (if expanded) */}
      {expanded && selectedCase.petDescription && (
        <div style={styles.description}>
          <div style={styles.descriptionLabel}>Description</div>
          <p style={styles.descriptionText}>{selectedCase.petDescription}</p>
        </div>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          onClick={handleJoin}
          disabled={joining}
          style={{
            ...styles.joinButton,
            background: `linear-gradient(135deg, ${color} 0%, ${darken(color)} 100%)`,
            opacity: joining ? 0.7 : 1,
          }}
        >
          {joining ? 'Joining...' : '🔍 JOIN SEARCH'}
        </button>

        {isLeader && (
          <button style={styles.commandButton}>
            ⚡ Command
          </button>
        )}
      </div>

      {/* Expanded: Volunteer list */}
      {expanded && (
        <div style={styles.volunteerSection}>
          <div style={styles.sectionTitle}>Active Searchers</div>
          <div style={styles.volunteerList}>
            {/* Placeholder - would be real data */}
            <div style={styles.volunteerItem}>
              <div style={styles.volunteerDot} />
              <span>No active searchers yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function getUrgencyLevel(lastSeenAt) {
  if (!lastSeenAt) return 'MEDIUM';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hours < 4) return 'CRITICAL';
  if (hours < 24) return 'HIGH';
  if (hours < 72) return 'MEDIUM';
  return 'LOW';
}

function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#eab308';
    case 'LOW': return '#6b7280';
    default: return '#f97316';
  }
}

function darken(hex) {
  return hex.replace(/^#/, '#9');
}

function getTimeAgo(dateStr) {
  if (!dateStr) return 'unknown';
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 24) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '80px',
    left: 0,
    right: 0,
    background: 'rgba(15, 23, 42, 0.98)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid #334155',
    borderRadius: '20px 20px 0 0',
    transition: 'height 0.3s ease',
    overflow: 'hidden',
    zIndex: 95,
  },

  dragHandle: {
    padding: '12px',
    display: 'flex',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  dragBar: {
    width: '40px',
    height: '4px',
    background: '#475569',
    borderRadius: '2px',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '0 20px 16px',
  },

  petPhoto: {
    width: '72px',
    height: '72px',
    borderRadius: '16px',
    border: '3px solid',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  speciesIcon: {
    fontSize: '32px',
  },

  petInfo: {
    flex: 1,
    minWidth: 0,
  },

  petName: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '800',
    margin: '0 0 4px 0',
  },

  petBreed: {
    color: '#94a3b8',
    fontSize: '14px',
    margin: '0 0 8px 0',
  },

  urgencyBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
  },

  closeButton: {
    width: '32px',
    height: '32px',
    background: '#334155',
    border: 'none',
    borderRadius: '50%',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stats: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    padding: '12px 20px',
    background: '#1e293b',
    margin: '0 20px 16px',
    borderRadius: '12px',
  },

  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  statValue: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: '800',
  },

  statLabel: {
    color: '#64748b',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  statDivider: {
    width: '1px',
    height: '30px',
    background: '#334155',
  },

  location: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 20px 16px',
  },

  locationIcon: {
    fontSize: '20px',
  },

  locationText: {
    flex: 1,
  },

  locationLabel: {
    color: '#64748b',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
  },

  locationAddress: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },

  description: {
    padding: '0 20px 16px',
  },

  descriptionLabel: {
    color: '#64748b',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },

  descriptionText: {
    color: '#94a3b8',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: 0,
  },

  actions: {
    display: 'flex',
    gap: '12px',
    padding: '0 20px',
  },

  joinButton: {
    flex: 1,
    padding: '16px',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },

  commandButton: {
    padding: '16px 20px',
    background: '#334155',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  volunteerSection: {
    padding: '20px',
    marginTop: '16px',
    borderTop: '1px solid #334155',
  },

  sectionTitle: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    marginBottom: '12px',
  },

  volunteerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  volunteerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#64748b',
    fontSize: '14px',
  },

  volunteerDot: {
    width: '8px',
    height: '8px',
    background: '#64748b',
    borderRadius: '50%',
  },
};
