'use client';

/**
 * CaseCarousel - Bottom Sheet with Case Cards
 *
 * Default: Horizontal scroll of active cases (peek above action bar)
 * Expanded: Full list with volunteer roster
 * Swipeable on mobile
 */

import { useRef, useState } from 'react';
import { useSquad, VIEW_MODES } from '../context/SquadContext';

export default function CaseCarousel() {
  const scrollRef = useRef(null);
  const {
    cases,
    viewMode,
    selectedCaseId,
    bottomSheetExpanded,
    selectCase,
    toggleBottomSheet,
  } = useSquad();

  // Don't show in single case mode
  if (viewMode === VIEW_MODES.SINGLE_CASE) return null;

  // Sort by urgency (most recent first)
  const sortedCases = [...cases].sort((a, b) => {
    const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <div style={{
      ...styles.container,
      height: bottomSheetExpanded ? '50vh' : '140px',
    }}>
      {/* Drag Handle */}
      <div
        style={styles.dragHandle}
        onClick={toggleBottomSheet}
      >
        <div style={styles.dragBar} />
      </div>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.headerIcon}>🔴</span>
          {cases.length} Active Case{cases.length !== 1 ? 's' : ''}
        </div>
        {!bottomSheetExpanded && (
          <button onClick={toggleBottomSheet} style={styles.expandButton}>
            Show All ↑
          </button>
        )}
      </div>

      {/* Horizontal Scroll (collapsed view) */}
      {!bottomSheetExpanded ? (
        <div ref={scrollRef} style={styles.scrollContainer}>
          {sortedCases.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>✓</span>
              <span>No active cases in your area</span>
            </div>
          ) : (
            sortedCases.map(caseItem => (
              <CaseCard
                key={caseItem.id}
                caseItem={caseItem}
                isSelected={caseItem.id === selectedCaseId}
                onSelect={() => selectCase(caseItem)}
                compact
              />
            ))
          )}
        </div>
      ) : (
        /* Grid view (expanded) */
        <div style={styles.gridContainer}>
          {sortedCases.map(caseItem => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
              isSelected={caseItem.id === selectedCaseId}
              onSelect={() => selectCase(caseItem)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseCard({ caseItem, isSelected, onSelect, compact }) {
  const urgency = getUrgencyLevel(caseItem.lastSeenAt);
  const color = getUrgencyColor(urgency);
  const timeAgo = getTimeAgo(caseItem.lastSeenAt);

  if (compact) {
    return (
      <button onClick={onSelect} style={{
        ...styles.compactCard,
        borderColor: isSelected ? color : 'transparent',
        background: isSelected
          ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
          : '#1e293b',
      }}>
        {/* Pet Photo */}
        <div style={{
          ...styles.compactPhoto,
          borderColor: color,
          backgroundImage: caseItem.petPhotoUrl ? `url(${caseItem.petPhotoUrl})` : 'none',
        }}>
          {!caseItem.petPhotoUrl && (
            <span style={styles.speciesIcon}>
              {caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
            </span>
          )}
          {urgency === 'CRITICAL' && (
            <div style={styles.urgentBadge}>!</div>
          )}
        </div>

        {/* Info */}
        <div style={styles.compactInfo}>
          <div style={styles.compactName}>{caseItem.petName || 'Unknown'}</div>
          <div style={{ ...styles.compactTime, color }}>{timeAgo}</div>
        </div>

        {/* Action */}
        <div style={{
          ...styles.compactAction,
          background: color,
        }}>
          →
        </div>
      </button>
    );
  }

  // Full card
  return (
    <button onClick={onSelect} style={{
      ...styles.fullCard,
      borderColor: isSelected ? color : '#334155',
    }}>
      {/* Photo */}
      <div style={{
        ...styles.fullPhoto,
        backgroundImage: caseItem.petPhotoUrl ? `url(${caseItem.petPhotoUrl})` : 'none',
      }}>
        {!caseItem.petPhotoUrl && (
          <span style={{ fontSize: '32px' }}>
            {caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
          </span>
        )}

        {/* Urgency tag */}
        <div style={{
          ...styles.urgencyTag,
          background: color,
        }}>
          {urgency === 'CRITICAL' ? 'CRITICAL' : timeAgo}
        </div>
      </div>

      {/* Details */}
      <div style={styles.fullDetails}>
        <div style={styles.fullName}>{caseItem.petName || 'Unknown'}</div>
        <div style={styles.fullBreed}>
          {caseItem.petColor} {caseItem.petSpecies}
          {caseItem.petBreed && ` • ${caseItem.petBreed}`}
        </div>
        <div style={styles.fullLocation}>
          📍 {caseItem.lastSeenAddress?.split(',')[0] || 'Unknown location'}
        </div>
      </div>

      {/* Join button */}
      <div style={{
        ...styles.joinButton,
        background: `linear-gradient(135deg, ${color} 0%, ${darken(color)} 100%)`,
      }}>
        JOIN →
      </div>
    </button>
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
  // Simple darken for gradient
  return hex.replace(/^#/, '#9');
}

function getTimeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '80px', // Above action bar
    left: 0,
    right: 0,
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid #334155',
    borderRadius: '16px 16px 0 0',
    transition: 'height 0.3s ease',
    overflow: 'hidden',
    zIndex: 90,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px 12px',
  },

  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
  },

  headerIcon: {
    fontSize: '10px',
  },

  expandButton: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  scrollContainer: {
    display: 'flex',
    gap: '12px',
    padding: '0 16px 16px',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },

  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    padding: '0 16px 16px',
    overflowY: 'auto',
  },

  emptyState: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px',
    color: '#64748b',
    fontSize: '14px',
  },

  emptyIcon: {
    fontSize: '20px',
    color: '#22c55e',
  },

  // Compact card
  compactCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    background: '#1e293b',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    minWidth: '180px',
    scrollSnapAlign: 'start',
    transition: 'all 0.2s',
  },

  compactPhoto: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },

  speciesIcon: {
    fontSize: '20px',
  },

  urgentBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '16px',
    height: '16px',
    background: '#ef4444',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
  },

  compactInfo: {
    flex: 1,
    minWidth: 0,
  },

  compactName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  compactTime: {
    fontSize: '12px',
    fontWeight: '600',
  },

  compactAction: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
    flexShrink: 0,
  },

  // Full card
  fullCard: {
    display: 'flex',
    flexDirection: 'column',
    background: '#1e293b',
    border: '2px solid #334155',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  fullPhoto: {
    height: '80px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  urgencyTag: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    color: '#fff',
  },

  fullDetails: {
    padding: '12px',
  },

  fullName: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '4px',
  },

  fullBreed: {
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '4px',
  },

  fullLocation: {
    color: '#64748b',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  joinButton: {
    margin: '0 12px 12px',
    padding: '10px',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    textAlign: 'center',
  },
};
