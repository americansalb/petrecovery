'use client';

/**
 * FlyerProgress Component
 *
 * Displays flyer posting progress for the current user and team.
 * Shows coverage statistics and achievements.
 *
 * Per Actions_Guide.md Phase 4 specification.
 */

export default function FlyerProgress({
  userFlyers = 0,
  teamFlyers = 0,
  uniqueCells = 0,
  coldSpotsRemaining = 0,
  contributors = [],
  variant = 'default', // 'default' | 'compact' | 'detailed'
}) {
  // Calculate coverage percentage (assuming 100 cells as target)
  const targetCells = Math.max(uniqueCells + coldSpotsRemaining, 20);
  const coveragePercent = Math.min(Math.round((uniqueCells / targetCells) * 100), 100);

  if (variant === 'compact') {
    return (
      <div style={styles.compactContainer}>
        <div style={styles.compactStat}>
          <span style={styles.compactIcon}>{"0x1F4CC"}</span>
          <span style={styles.compactValue}>{teamFlyers}</span>
          <span style={styles.compactLabel}>flyers</span>
        </div>
        <div style={styles.compactDivider} />
        <div style={styles.compactStat}>
          <span style={styles.compactIcon}>{"0x1F30D"}</span>
          <span style={styles.compactValue}>{uniqueCells}</span>
          <span style={styles.compactLabel}>areas</span>
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div style={styles.detailedContainer}>
        <h3 style={styles.detailedTitle}>{"0x1F4CA"} Flyer Coverage</h3>

        {/* Coverage Bar */}
        <div style={styles.coverageSection}>
          <div style={styles.coverageHeader}>
            <span>Area Coverage</span>
            <span style={styles.coveragePercent}>{coveragePercent}%</span>
          </div>
          <div style={styles.coverageBarBg}>
            <div
              style={{
                ...styles.coverageBarFill,
                width: `${coveragePercent}%`,
              }}
            />
          </div>
          <p style={styles.coverageSubtext}>
            {coldSpotsRemaining > 0
              ? `${coldSpotsRemaining} cold spots remaining`
              : 'Great coverage!'}
          </p>
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{userFlyers}</span>
            <span style={styles.statLabel}>By you</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{teamFlyers}</span>
            <span style={styles.statLabel}>Team total</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{uniqueCells}</span>
            <span style={styles.statLabel}>Areas covered</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{contributors.length || Math.ceil(teamFlyers / 3)}</span>
            <span style={styles.statLabel}>Contributors</span>
          </div>
        </div>

        {/* Top Contributors */}
        {contributors.length > 0 && (
          <div style={styles.contributorsSection}>
            <h4 style={styles.contributorsTitle}>Top Contributors</h4>
            <div style={styles.contributorsList}>
              {contributors.slice(0, 5).map((c, idx) => (
                <div key={c.id || idx} style={styles.contributorItem}>
                  <span style={styles.contributorRank}>#{idx + 1}</span>
                  <span style={styles.contributorName}>{c.name || 'Anonymous'}</span>
                  <span style={styles.contributorCount}>{c.count} flyers</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievement hints */}
        {userFlyers >= 5 && (
          <div style={styles.achievementBadge}>
            <span>{"0x1F3C6"}</span> Flyer Champion! Keep up the great work!
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{"0x1F4CA"} Progress</h3>
      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <span style={styles.value}>{userFlyers}</span>
          <span style={styles.label}>Flyers by you</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.value}>{teamFlyers}</span>
          <span style={styles.label}>Team total</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.value}>{uniqueCells}</span>
          <span style={styles.label}>Areas covered</span>
        </div>
      </div>

      {/* Mini coverage bar */}
      <div style={styles.miniCoverageSection}>
        <div style={styles.miniCoverageBar}>
          <div
            style={{
              ...styles.miniCoverageFill,
              width: `${coveragePercent}%`,
            }}
          />
        </div>
        <span style={styles.miniCoverageText}>{coveragePercent}% coverage</span>
      </div>
    </div>
  );
}

const styles = {
  // Default variant
  container: {
    padding: '1rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  title: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0 0 0.75rem 0',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '0.75rem',
  },
  stat: {
    textAlign: 'center',
  },
  value: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#4F46E5',
  },
  label: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },
  miniCoverageSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #E5E7EB',
  },
  miniCoverageBar: {
    flex: 1,
    height: '6px',
    background: '#E5E7EB',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  miniCoverageFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  miniCoverageText: {
    fontSize: '0.75rem',
    color: '#6B7280',
    whiteSpace: 'nowrap',
  },

  // Compact variant
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 1rem',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  compactStat: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  compactIcon: {
    fontSize: '1rem',
  },
  compactValue: {
    fontWeight: '700',
    color: '#1F2937',
  },
  compactLabel: {
    fontSize: '0.8rem',
    color: '#6B7280',
  },
  compactDivider: {
    width: '1px',
    height: '24px',
    background: '#E5E7EB',
  },

  // Detailed variant
  detailedContainer: {
    padding: '1.25rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  detailedTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0 0 1rem 0',
  },
  coverageSection: {
    marginBottom: '1.25rem',
  },
  coverageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    color: '#374151',
  },
  coveragePercent: {
    fontWeight: '700',
    color: '#10B981',
  },
  coverageBarBg: {
    height: '10px',
    background: '#E5E7EB',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  coverageBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
    borderRadius: '5px',
    transition: 'width 0.5s ease',
  },
  coverageSubtext: {
    fontSize: '0.8rem',
    color: '#6B7280',
    marginTop: '0.5rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  statBox: {
    textAlign: 'center',
    padding: '0.75rem',
    background: '#F9FAFB',
    borderRadius: '8px',
  },
  statValue: {
    display: 'block',
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#4F46E5',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#6B7280',
  },
  contributorsSection: {
    borderTop: '1px solid #E5E7EB',
    paddingTop: '1rem',
  },
  contributorsTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 0.75rem 0',
  },
  contributorsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  contributorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.85rem',
  },
  contributorRank: {
    color: '#9CA3AF',
    fontWeight: '600',
    minWidth: '24px',
  },
  contributorName: {
    flex: 1,
    color: '#374151',
  },
  contributorCount: {
    color: '#10B981',
    fontWeight: '600',
  },
  achievementBadge: {
    marginTop: '1rem',
    padding: '0.75rem',
    background: '#FEF3C7',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#92400E',
    fontWeight: '600',
  },
};
