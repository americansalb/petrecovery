'use client';

/**
 * OfflineIndicator Component
 *
 * Shows offline status and pending action count.
 * Per Actions_Guide.md Phase 7 specification.
 */

import { memo } from 'react';
import { useOffline } from '@/app/lib/offline';

const OfflineIndicator = memo(function OfflineIndicator({ variant = 'banner' }) {
  const { isOffline, pendingCount, syncing, sync } = useOffline();

  // Don't show if online and no pending actions
  if (!isOffline && pendingCount === 0) {
    return null;
  }

  // Compact indicator (for nav/header)
  if (variant === 'compact') {
    return (
      <div style={compactStyles.container}>
        <span style={compactStyles.dot(isOffline)} />
        {pendingCount > 0 && (
          <span style={compactStyles.badge}>{pendingCount}</span>
        )}
      </div>
    );
  }

  // Floating indicator (fixed position)
  if (variant === 'floating') {
    return (
      <div style={floatingStyles.container(isOffline)}>
        <span style={floatingStyles.icon}>
          {isOffline ? '\u{1F4F4}' : syncing ? '\u{1F504}' : '\u{2601}'}
        </span>
        <div style={floatingStyles.content}>
          <span style={floatingStyles.title}>
            {isOffline ? 'Offline' : syncing ? 'Syncing...' : 'Pending'}
          </span>
          {pendingCount > 0 && (
            <span style={floatingStyles.count}>{pendingCount} action{pendingCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        {!isOffline && pendingCount > 0 && !syncing && (
          <button onClick={sync} style={floatingStyles.syncButton}>
            Sync
          </button>
        )}
      </div>
    );
  }

  // Default banner
  return (
    <div style={bannerStyles.container(isOffline)}>
      <div style={bannerStyles.content}>
        <span style={bannerStyles.icon}>
          {isOffline ? '\u26A0\uFE0F' : '\u{1F504}'}
        </span>
        <div style={bannerStyles.text}>
          <span style={bannerStyles.title}>
            {isOffline ? "You're offline" : 'Syncing pending actions...'}
          </span>
          {isOffline && (
            <span style={bannerStyles.subtitle}>
              Actions will sync when you reconnect
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <div style={bannerStyles.progress}>
            <div style={bannerStyles.progressBar}>
              <div style={bannerStyles.progressFill(isOffline, syncing)} />
            </div>
            <span style={bannerStyles.count}>{pendingCount} pending</span>
          </div>
        )}
      </div>
      {!isOffline && pendingCount > 0 && !syncing && (
        <button onClick={sync} style={bannerStyles.button}>
          Sync Now
        </button>
      )}
    </div>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const compactStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  dot: (isOffline) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: isOffline ? '#EF4444' : '#10B981',
    boxShadow: isOffline ? '0 0 8px #EF4444' : '0 0 8px #10B981',
  }),
  badge: {
    background: '#667EEA',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '0.125rem 0.375rem',
    borderRadius: '9999px',
    minWidth: '1.25rem',
    textAlign: 'center',
  },
};

const floatingStyles = {
  container: (isOffline) => ({
    position: 'fixed',
    bottom: '5rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    background: isOffline ? '#1F2937' : '#1E293B',
    border: `1px solid ${isOffline ? '#374151' : '#334155'}`,
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
  }),
  icon: {
    fontSize: '1.25rem',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  count: {
    color: '#94A3B8',
    fontSize: '0.75rem',
  },
  syncButton: {
    padding: '0.375rem 0.75rem',
    background: '#667EEA',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

const bannerStyles = {
  container: (isOffline) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.75rem 1rem',
    background: isOffline
      ? 'linear-gradient(135deg, #374151 0%, #1F2937 100%)'
      : 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)',
    border: `1px solid ${isOffline ? '#4B5563' : '#3B82F6'}`,
    borderRadius: '12px',
    marginBottom: '1rem',
  }),
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
  },
  icon: {
    fontSize: '1.25rem',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.8rem',
  },
  progress: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.25rem',
  },
  progressBar: {
    width: '80px',
    height: '4px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: (isOffline, syncing) => ({
    height: '100%',
    width: syncing ? '60%' : '100%',
    background: isOffline ? '#9CA3AF' : '#60A5FA',
    transition: 'width 0.3s',
    animation: syncing ? 'pulse 1s infinite' : 'none',
  }),
  count: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.7rem',
  },
  button: {
    padding: '0.5rem 1rem',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

export default OfflineIndicator;
