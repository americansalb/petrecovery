'use client';

/**
 * ScoutTipBanner Component
 *
 * Displays Scout mascot tips as a dismissable banner.
 * Can be used in task lists, overview pages, and other locations.
 *
 * Per Actions_Guide.md Phase 5 specification.
 */

import { useState, useCallback } from 'react';

// Scout mascot icon/emoji
const SCOUT_ICON = '\u{1F436}'; // Dog face

// Tip type icons
const TYPE_ICONS = {
  TIME: '\u{1F315}',      // Full moon
  WEATHER: '\u{26C8}',    // Thunder storm
  PROGRESS: '\u{1F3C6}',  // Trophy
  LOCATION: '\u{1F4CD}',  // Pin
  COLD_SPOT: '\u{1F534}', // Red circle
  STRATEGY: '\u{1F4A1}',  // Light bulb
  ENCOURAGE: '\u{1F49A}', // Green heart
  SIGHTING: '\u{1F6A8}',  // Alert
};

// Tip type colors
const TYPE_COLORS = {
  TIME: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
  WEATHER: { bg: '#DBEAFE', border: '#60A5FA', text: '#1E40AF' },
  PROGRESS: { bg: '#D1FAE5', border: '#34D399', text: '#065F46' },
  LOCATION: { bg: '#E0E7FF', border: '#818CF8', text: '#3730A3' },
  COLD_SPOT: { bg: '#FEE2E2', border: '#F87171', text: '#991B1B' },
  STRATEGY: { bg: '#FEF9C3', border: '#FACC15', text: '#713F12' },
  ENCOURAGE: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },
  SIGHTING: { bg: '#FEE2E2', border: '#EF4444', text: '#7F1D1D' },
};

export default function ScoutTipBanner({
  tip,
  onDismiss,
  onAction,
  variant = 'default', // 'default' | 'compact' | 'chat'
  showScoutLabel = true,
  dismissing = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (!tip) return null;

  const typeIcon = TYPE_ICONS[tip.type] || '\u{1F4AC}';
  const colors = TYPE_COLORS[tip.type] || TYPE_COLORS.STRATEGY;

  // Handle action button click
  const handleAction = useCallback(() => {
    if (onAction && tip.actionType) {
      onAction(tip.actionType, tip);
    }
  }, [onAction, tip]);

  // Chat message variant
  if (variant === 'chat') {
    return (
      <div style={styles.chatContainer}>
        <div style={styles.chatHeader}>
          <span style={styles.chatAvatar}>{SCOUT_ICON}</span>
          <span style={styles.chatName}>Scout</span>
          <span style={styles.chatTime}>
            {formatTime(tip.createdAt)}
          </span>
        </div>
        <div style={{
          ...styles.chatBubble,
          background: colors.bg,
          borderColor: colors.border,
        }}>
          {tip.title && (
            <div style={{ ...styles.chatTitle, color: colors.text }}>
              {typeIcon} {tip.title}
            </div>
          )}
          <p style={styles.chatMessage}>{tip.message}</p>
          {tip.actionLabel && (
            <button onClick={handleAction} style={styles.chatAction}>
              {tip.actionLabel} &rarr;
            </button>
          )}
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        style={{
          ...styles.compactContainer,
          background: colors.bg,
          borderColor: colors.border,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span style={styles.compactIcon}>{SCOUT_ICON}</span>
        <span style={{ ...styles.compactMessage, color: colors.text }}>
          {tip.message.length > 80 ? tip.message.substring(0, 77) + '...' : tip.message}
        </span>
        {onDismiss && isHovered && (
          <button
            onClick={() => onDismiss(tip.id)}
            style={styles.compactDismiss}
            disabled={dismissing}
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  // Default banner variant
  return (
    <div
      style={{
        ...styles.container,
        background: colors.bg,
        borderColor: colors.border,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scout icon and label */}
      <div style={styles.header}>
        <div style={styles.scoutInfo}>
          <span style={styles.scoutIcon}>{SCOUT_ICON}</span>
          {showScoutLabel && <span style={styles.scoutLabel}>Scout:</span>}
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(tip.id)}
            style={{
              ...styles.dismissButton,
              opacity: isHovered ? 1 : 0.5,
            }}
            disabled={dismissing}
            aria-label="Dismiss tip"
          >
            {dismissing ? '...' : 'Dismiss'}
          </button>
        )}
      </div>

      {/* Tip content */}
      <div style={styles.content}>
        {tip.title && (
          <div style={{ ...styles.title, color: colors.text }}>
            {typeIcon} {tip.title}
          </div>
        )}
        <p style={{ ...styles.message, color: colors.text }}>
          "{tip.message}"
        </p>
      </div>

      {/* Action button */}
      {tip.actionLabel && onAction && (
        <button
          onClick={handleAction}
          style={{
            ...styles.actionButton,
            color: colors.text,
            borderColor: colors.border,
          }}
        >
          {tip.actionLabel} &rarr;
        </button>
      )}
    </div>
  );
}

/**
 * ScoutTipCarousel - Shows multiple tips with navigation
 */
export function ScoutTipCarousel({
  tips,
  currentIndex,
  onDismiss,
  onAction,
  onNext,
  onPrev,
  dismissing,
}) {
  if (!tips || tips.length === 0) return null;

  const currentTip = tips[currentIndex] || tips[0];

  return (
    <div style={styles.carouselContainer}>
      <ScoutTipBanner
        tip={currentTip}
        onDismiss={onDismiss}
        onAction={onAction}
        dismissing={dismissing === currentTip.id}
      />

      {tips.length > 1 && (
        <div style={styles.carouselNav}>
          <button onClick={onPrev} style={styles.navButton}>
            &larr;
          </button>
          <span style={styles.navIndicator}>
            {currentIndex + 1} / {tips.length}
          </span>
          <button onClick={onNext} style={styles.navButton}>
            &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ==========================================================================
// STYLES
// ==========================================================================

const styles = {
  // Default banner
  container: {
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '0.75rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  scoutInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  scoutIcon: {
    fontSize: '1.5rem',
  },
  scoutLabel: {
    fontWeight: '700',
    color: '#374151',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    transition: 'opacity 0.2s',
  },
  content: {
    marginLeft: '2rem',
  },
  title: {
    fontWeight: '700',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  message: {
    margin: 0,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  actionButton: {
    display: 'block',
    marginLeft: 'auto',
    marginTop: '0.75rem',
    background: 'transparent',
    border: '1px solid',
    borderRadius: '6px',
    padding: '0.5rem 1rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },

  // Compact variant
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '0.85rem',
  },
  compactIcon: {
    fontSize: '1.1rem',
  },
  compactMessage: {
    flex: 1,
  },
  compactDismiss: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0 0.25rem',
    lineHeight: 1,
  },

  // Chat variant
  chatContainer: {
    marginBottom: '1rem',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.375rem',
  },
  chatAvatar: {
    fontSize: '1.25rem',
  },
  chatName: {
    fontWeight: '700',
    color: '#374151',
  },
  chatTime: {
    fontSize: '0.75rem',
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
  chatBubble: {
    marginLeft: '1.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    borderTopLeftRadius: '4px',
    border: '1px solid',
    maxWidth: '85%',
  },
  chatTitle: {
    fontWeight: '700',
    marginBottom: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  chatMessage: {
    margin: 0,
    lineHeight: 1.5,
    color: '#374151',
  },
  chatAction: {
    display: 'inline-block',
    marginTop: '0.5rem',
    background: 'none',
    border: 'none',
    color: '#667EEA',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.9rem',
  },

  // Carousel
  carouselContainer: {
    position: 'relative',
  },
  carouselNav: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  navButton: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
  },
  navIndicator: {
    fontSize: '0.8rem',
    color: '#9CA3AF',
  },
};
