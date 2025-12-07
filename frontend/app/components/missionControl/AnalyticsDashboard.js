'use client';

/**
 * AnalyticsDashboard Component
 *
 * Displays platform-wide analytics and insights from case outcomes.
 * Shows action effectiveness, reunion rates, and correlations.
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { useState, useEffect, useCallback } from 'react';

// Found method labels
const FOUND_METHOD_LABELS = {
  CAME_HOME: 'Came home',
  SHELTER_INTAKE: 'Found at shelter',
  NEIGHBOR_FOUND: 'Neighbor found',
  SIGHTING_LED_TO: 'Sighting led to',
  TRAP_CAUGHT: 'Trap caught',
  FLYER_RESPONSE: 'Flyer response',
  SOCIAL_MEDIA: 'Social media',
  OTHER: 'Other',
};

// Action type labels
const ACTION_LABELS = {
  SEARCH: 'Physical Search',
  FLYER_POSTING: 'Flyer Posting',
  SHELTER_EMAIL: 'Shelter Contact',
  SHELTER_CALL: 'Shelter Call',
  VET_EMAIL: 'Vet Contact',
  NEIGHBOR_TALK: 'Neighbor Outreach',
};

export default function AnalyticsDashboard({ variant = 'full' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('all');
  const [petType, setPetType] = useState('ALL');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const queryType = variant === 'compact' ? 'overview' : 'full';
      const res = await fetch(
        `/api/analytics?type=${queryType}&period=${period}&petType=${petType}`
      );

      if (!res.ok) throw new Error('Failed to fetch analytics');

      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Analytics error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [variant, period, petType]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>Error: {error}</p>
        <button onClick={fetchAnalytics} style={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Compact variant for sidebar/widget
  if (variant === 'compact') {
    return (
      <div style={styles.compactContainer}>
        <h3 style={styles.compactTitle}>{'\u{1F4CA}'} Quick Stats</h3>
        <div style={styles.compactStats}>
          <div style={styles.compactStat}>
            <span style={styles.compactValue}>{data.overview?.reunionRate || 0}%</span>
            <span style={styles.compactLabel}>Reunion Rate</span>
          </div>
          <div style={styles.compactStat}>
            <span style={styles.compactValue}>
              {Math.round(data.overview?.avgTimeToReunionHours || 0)}h
            </span>
            <span style={styles.compactLabel}>Avg Time</span>
          </div>
          <div style={styles.compactStat}>
            <span style={styles.compactValue}>{data.overview?.reunitedCases || 0}</span>
            <span style={styles.compactLabel}>Reunited</span>
          </div>
        </div>
      </div>
    );
  }

  // Full dashboard
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{'\u{1F4CA}'} Analytics Dashboard</h2>
          <p style={styles.subtitle}>Insights from case outcomes for algorithm training</p>
        </div>
        <div style={styles.filters}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={styles.select}
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last year</option>
            <option value="all">All time</option>
          </select>
          <select
            value={petType}
            onChange={(e) => setPetType(e.target.value)}
            style={styles.select}
          >
            <option value="ALL">All pets</option>
            <option value="DOG">Dogs only</option>
            <option value="CAT">Cats only</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={styles.overviewGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>{'\u{1F389}'}</div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>{data.reunionStats?.reunited || 0}</span>
            <span style={styles.statLabel}>Reunited</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>{'\u{23F1}'}</div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>
              {Math.round(data.reunionStats?.avgTimeToReunion || 0)}h
            </span>
            <span style={styles.statLabel}>Avg Time to Reunion</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>{'\u{1F4C8}'}</div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>
              {data.reunionStats?.totalCases > 0
                ? Math.round((data.reunionStats.reunited / data.reunionStats.totalCases) * 100)
                : 0}
              %
            </span>
            <span style={styles.statLabel}>Success Rate</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>{'\u{2705}'}</div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>
              {data.activityMetrics?.totalVerifiedActions || 0}
            </span>
            <span style={styles.statLabel}>Verified Actions</span>
          </div>
        </div>
      </div>

      {/* Action Effectiveness */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Action Effectiveness</h3>
        <p style={styles.sectionSubtitle}>
          Which actions correlate with faster reunions?
        </p>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Cases</th>
                <th style={styles.th}>Avg Hours to Reunion</th>
              </tr>
            </thead>
            <tbody>
              {(data.actionEffectiveness || []).slice(0, 8).map((action, i) => (
                <tr key={action.actionType} style={i % 2 === 0 ? styles.trEven : {}}>
                  <td style={styles.td}>
                    {ACTION_LABELS[action.actionType] || action.actionType}
                  </td>
                  <td style={styles.tdCenter}>{action.caseCount}</td>
                  <td style={styles.tdCenter}>
                    <span
                      style={{
                        ...styles.timeBadge,
                        background:
                          action.avgHoursToReunion < 24
                            ? '#D1FAE5'
                            : action.avgHoursToReunion < 72
                            ? '#FEF3C7'
                            : '#FEE2E2',
                        color:
                          action.avgHoursToReunion < 24
                            ? '#065F46'
                            : action.avgHoursToReunion < 72
                            ? '#92400E'
                            : '#991B1B',
                      }}
                    >
                      {Math.round(action.avgHoursToReunion)}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Early Action Impact */}
      {data.earlyActionCorrelations && data.earlyActionCorrelations.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{'\u{26A1}'} Early Action Impact</h3>
          <p style={styles.sectionSubtitle}>
            Actions taken within 6 hours of case creation
          </p>
          <div style={styles.earlyActionsGrid}>
            {data.earlyActionCorrelations.slice(0, 4).map((action) => (
              <div key={action.actionType} style={styles.earlyActionCard}>
                <span style={styles.earlyActionType}>
                  {ACTION_LABELS[action.actionType] || action.actionType}
                </span>
                <span style={styles.earlyActionValue}>
                  {Math.round(action.avgReunionHours)}h avg
                </span>
                <span style={styles.earlyActionCount}>{action.count} cases</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Found Method Distribution */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>How Pets Were Found</h3>
        <div style={styles.foundMethodsGrid}>
          {(data.reunionStats?.byFoundMethod || []).map((method) => (
            <div key={method.method} style={styles.foundMethodCard}>
              <span style={styles.foundMethodLabel}>
                {FOUND_METHOD_LABELS[method.method] || method.method}
              </span>
              <span style={styles.foundMethodCount}>{method.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pet Type Breakdown */}
      {data.petTypeBreakdown && data.petTypeBreakdown.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>By Pet Type</h3>
          <div style={styles.petTypeGrid}>
            {data.petTypeBreakdown.map((pt) => (
              <div key={pt.petType} style={styles.petTypeCard}>
                <span style={styles.petTypeEmoji}>
                  {pt.petType === 'DOG' ? '\u{1F436}' : pt.petType === 'CAT' ? '\u{1F431}' : '\u{1F43E}'}
                </span>
                <span style={styles.petTypeName}>{pt.petType}</span>
                <span style={styles.petTypeStats}>
                  {pt.count} cases &bull; {pt.avgTimeToReunionHours}h avg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Metrics */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Platform Activity</h3>
        <div style={styles.activityGrid}>
          <div style={styles.activityCard}>
            <span style={styles.activityValue}>
              {data.activityMetrics?.totalSearchSessions || 0}
            </span>
            <span style={styles.activityLabel}>Search Sessions</span>
          </div>
          <div style={styles.activityCard}>
            <span style={styles.activityValue}>
              {data.activityMetrics?.totalFlyersPosted || 0}
            </span>
            <span style={styles.activityLabel}>Flyers Posted</span>
          </div>
          <div style={styles.activityCard}>
            <span style={styles.activityValue}>
              {data.activityMetrics?.totalSheltersContacted || 0}
            </span>
            <span style={styles.activityLabel}>Shelters Contacted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1.5rem',
    borderBottom: '1px solid #E5E7EB',
    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'white',
  },
  subtitle: {
    margin: '0.25rem 0 0',
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filters: {
    display: 'flex',
    gap: '0.5rem',
  },
  select: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },

  // Overview grid
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    padding: '1.5rem',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#F9FAFB',
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
  },
  statIcon: {
    fontSize: '1.75rem',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  // Sections
  section: {
    padding: '1.5rem',
    borderTop: '1px solid #E5E7EB',
  },
  sectionTitle: {
    margin: '0 0 0.25rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    margin: '0 0 1rem',
    fontSize: '0.875rem',
    color: '#6B7280',
  },

  // Table
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    borderBottom: '2px solid #E5E7EB',
    fontWeight: '600',
    color: '#374151',
  },
  td: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #F3F4F6',
    color: '#111827',
  },
  tdCenter: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #F3F4F6',
    textAlign: 'center',
  },
  trEven: {
    background: '#F9FAFB',
  },
  timeBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },

  // Early actions
  earlyActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  earlyActionCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    background: '#EEF2FF',
    borderRadius: '10px',
    border: '1px solid #C7D2FE',
  },
  earlyActionType: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: '0.5rem',
  },
  earlyActionValue: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#111827',
  },
  earlyActionCount: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  // Found methods
  foundMethodsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  foundMethodCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: '#F9FAFB',
    borderRadius: '9999px',
    border: '1px solid #E5E7EB',
  },
  foundMethodLabel: {
    fontSize: '0.85rem',
    color: '#374151',
  },
  foundMethodCount: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#667EEA',
  },

  // Pet type
  petTypeGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  petTypeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.25rem 2rem',
    background: '#F9FAFB',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  petTypeEmoji: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  petTypeName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#111827',
  },
  petTypeStats: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  // Activity
  activityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  activityCard: {
    textAlign: 'center',
    padding: '1rem',
    background: '#F9FAFB',
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
  },
  activityValue: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#667EEA',
  },
  activityLabel: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },

  // Compact variant
  compactContainer: {
    padding: '1rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  },
  compactTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#374151',
  },
  compactStats: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  compactStat: {
    textAlign: 'center',
  },
  compactValue: {
    display: 'block',
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#667EEA',
  },
  compactLabel: {
    fontSize: '0.7rem',
    color: '#6B7280',
  },

  // Loading/Error
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
  loadingText: {
    margin: 0,
    fontSize: '0.9rem',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
  errorText: {
    color: '#991B1B',
    marginBottom: '1rem',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    background: '#667EEA',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
