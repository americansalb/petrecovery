'use client';

/**
 * ScoutTipsPanel Component
 *
 * Full panel showing all Scout tips for a mission.
 * Includes filtering, sorting, and tip management.
 *
 * Per Actions_Guide.md Phase 5 specification.
 */

import { useState, useMemo } from 'react';
import useScoutTips from '@/app/mission-control/hooks/useScoutTips';
import ScoutTipBanner from './ScoutTipBanner';

// Scout mascot icon
const SCOUT_ICON = '\u{1F436}';

export default function ScoutTipsPanel({
  caseId,
  onAction,
  variant = 'full', // 'full' | 'sidebar' | 'minimal'
  maxTips = 10,
  coldSpotsCount = 0,
}) {
  const {
    tips,
    petName,
    loading,
    error,
    generating,
    dismissing,
    generateTips,
    dismissTip,
    getTipIcon,
    getTipLabel,
  } = useScoutTips(caseId, { coldSpotsCount });

  const [filter, setFilter] = useState('all'); // 'all' | 'high' | type
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'time'

  // Filter and sort tips
  const displayedTips = useMemo(() => {
    let filtered = [...tips];

    // Apply filter
    if (filter === 'high') {
      filtered = filtered.filter((t) => t.priority >= 70);
    } else if (filter !== 'all') {
      filtered = filtered.filter((t) => t.type === filter);
    }

    // Apply sort
    if (sortBy === 'time') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      filtered.sort((a, b) => b.priority - a.priority);
    }

    return filtered.slice(0, maxTips);
  }, [tips, filter, sortBy, maxTips]);

  // Get unique tip types for filter
  const tipTypes = useMemo(() => {
    const types = new Set(tips.map((t) => t.type));
    return Array.from(types);
  }, [tips]);

  // Handle action
  const handleAction = (actionType, tip) => {
    if (onAction) {
      onAction(actionType, tip);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading Scout tips...</p>
      </div>
    );
  }

  // Minimal variant - just show top tip
  if (variant === 'minimal') {
    if (tips.length === 0) return null;

    return (
      <ScoutTipBanner
        tip={tips[0]}
        onDismiss={dismissTip}
        onAction={handleAction}
        dismissing={dismissing === tips[0].id}
        variant="compact"
      />
    );
  }

  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <div style={styles.sidebarContainer}>
        <div style={styles.sidebarHeader}>
          <span style={styles.scoutIcon}>{SCOUT_ICON}</span>
          <span style={styles.sidebarTitle}>Scout Tips</span>
          {tips.length > 0 && (
            <span style={styles.tipCount}>{tips.length}</span>
          )}
        </div>

        {tips.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No tips right now. Keep up the great work!</p>
          </div>
        ) : (
          <div style={styles.sidebarTips}>
            {displayedTips.slice(0, 3).map((tip) => (
              <ScoutTipBanner
                key={tip.id}
                tip={tip}
                onDismiss={dismissTip}
                onAction={handleAction}
                dismissing={dismissing === tip.id}
                variant="compact"
              />
            ))}
            {tips.length > 3 && (
              <p style={styles.moreCount}>+{tips.length - 3} more tips</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full panel variant
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.scoutIconLarge}>{SCOUT_ICON}</span>
          <div>
            <h3 style={styles.title}>Scout Intelligence</h3>
            <p style={styles.subtitle}>
              {petName ? `Tips for finding ${petName}` : 'Contextual tips and encouragement'}
            </p>
          </div>
        </div>
        <button
          onClick={() => generateTips(true)}
          disabled={generating}
          style={styles.refreshButton}
        >
          {generating ? 'Updating...' : 'Refresh Tips'}
        </button>
      </div>

      {/* Filters */}
      {tips.length > 0 && (
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">All Tips</option>
              <option value="high">High Priority</option>
              {tipTypes.map((type) => (
                <option key={type} value={type}>
                  {getTipIcon(type)} {getTipLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="priority">By Priority</option>
              <option value="time">By Time</option>
            </select>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={styles.errorBanner}>
          <p>{error}</p>
          <button onClick={() => generateTips(true)} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Tips list */}
      {displayedTips.length === 0 ? (
        <div style={styles.emptyStateContainer}>
          <span style={styles.emptyIcon}>{SCOUT_ICON}</span>
          <p style={styles.emptyText}>
            No tips available right now.
          </p>
          <p style={styles.emptySubtext}>
            Scout will provide contextual guidance as you work on the mission.
          </p>
          <button
            onClick={() => generateTips(true)}
            disabled={generating}
            style={styles.generateButton}
          >
            {generating ? 'Generating...' : 'Generate Tips'}
          </button>
        </div>
      ) : (
        <div style={styles.tipsList}>
          {displayedTips.map((tip) => (
            <ScoutTipBanner
              key={tip.id}
              tip={tip}
              onDismiss={dismissTip}
              onAction={handleAction}
              dismissing={dismissing === tip.id}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {tips.length > 0 && (
        <div style={styles.footer}>
          <span style={styles.footerText}>
            Showing {displayedTips.length} of {tips.length} tips
          </span>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// STYLES
// ==========================================================================

const styles = {
  container: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #E5E7EB',
    background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  scoutIconLarge: {
    fontSize: '2rem',
  },
  title: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#78350F',
  },
  subtitle: {
    margin: '0.125rem 0 0',
    fontSize: '0.85rem',
    color: '#92400E',
  },
  refreshButton: {
    padding: '0.5rem 1rem',
    background: 'white',
    border: '1px solid #FCD34D',
    borderRadius: '8px',
    fontWeight: '600',
    color: '#92400E',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },

  // Filters
  filters: {
    display: 'flex',
    gap: '1rem',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #F3F4F6',
    background: '#F9FAFB',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.8rem',
    color: '#6B7280',
  },
  filterSelect: {
    padding: '0.375rem 0.75rem',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '0.85rem',
    background: 'white',
  },

  // Tips list
  tipsList: {
    padding: '1rem 1.25rem',
    maxHeight: '400px',
    overflow: 'auto',
  },

  // Empty state
  emptyStateContainer: {
    padding: '3rem 2rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '1rem',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '1rem',
    color: '#374151',
    margin: '0 0 0.5rem',
  },
  emptySubtext: {
    fontSize: '0.85rem',
    color: '#6B7280',
    margin: '0 0 1.5rem',
  },
  generateButton: {
    padding: '0.75rem 1.5rem',
    background: '#667EEA',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // Error
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.25rem',
    background: '#FEE2E2',
    color: '#991B1B',
  },
  retryButton: {
    padding: '0.375rem 0.75rem',
    background: '#991B1B',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },

  // Footer
  footer: {
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #F3F4F6',
    background: '#F9FAFB',
  },
  footerText: {
    fontSize: '0.8rem',
    color: '#6B7280',
  },

  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#6B7280',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E7EB',
    borderTopColor: '#667EEA',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },

  // Sidebar variant
  sidebarContainer: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #F3F4F6',
    background: '#FEF3C7',
  },
  scoutIcon: {
    fontSize: '1.25rem',
  },
  sidebarTitle: {
    fontWeight: '700',
    color: '#78350F',
    flex: 1,
  },
  tipCount: {
    background: '#92400E',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
  },
  sidebarTips: {
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  moreCount: {
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#6B7280',
    margin: '0.5rem 0 0',
  },
  emptyState: {
    padding: '1rem',
    textAlign: 'center',
    color: '#6B7280',
    fontSize: '0.85rem',
  },
};
