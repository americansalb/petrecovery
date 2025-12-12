'use client';

/**
 * Command Center - Leader's Strategic View
 *
 * Zone management, volunteer deployment, resource coordination.
 * The "RTS" (Real-Time Strategy) interface for squad leaders.
 */

import { useState, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic } from '@/app/lib/missionControl/accessibility';

export default function CommandCenter({ missionId, mission, onUpdate }) {
  const [commandView, setCommandView] = useState(null);
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  useEffect(() => {
    fetchCommandView();
    const interval = setInterval(fetchCommandView, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchCommandView = async () => {
    try {
      const res = await fetch(`/api/mission/${missionId}/command`);
      if (res.ok) {
        const data = await res.json();
        setCommandView(data);
      }
    } catch (err) {
      console.error('Error fetching command view:', err);
    }
  };

  const sendBroadcast = async (type = 'INFO') => {
    if (!broadcastMessage.trim()) return;

    try {
      await fetch(`/api/mission/${missionId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BROADCAST',
          message: broadcastMessage,
          type,
        }),
      });
      triggerHaptic('success');
      setBroadcastMessage('');
    } catch (err) {
      console.error('Broadcast error:', err);
    }
  };

  const updateStaleZones = async () => {
    try {
      await fetch(`/api/mission/${missionId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STALE' }),
      });
      fetchCommandView();
    } catch (err) {
      console.error('Error updating stale zones:', err);
    }
  };

  if (!commandView) {
    return (
      <div style={styles.loading}>
        <p>Loading command center...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Tab navigation */}
      <div style={styles.tabs}>
        {['OVERVIEW', 'ZONES', 'RESOURCES', 'TRAPS'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'OVERVIEW' && (
        <div style={styles.content}>
          {/* Quick stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{commandView.volunteers.active}</span>
              <span style={styles.statLabel}>Active</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{commandView.coverage.percentComplete}%</span>
              <span style={styles.statLabel}>Covered</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{commandView.coverage.stale}</span>
              <span style={styles.statLabel}>Stale</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{commandView.sightings.total}</span>
              <span style={styles.statLabel}>Sightings</span>
            </div>
          </div>

          {/* Broadcast */}
          <div style={styles.broadcastSection}>
            <h3 style={styles.sectionTitle}>Broadcast Command</h3>
            <textarea
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              placeholder="Message to all volunteers..."
              style={styles.broadcastInput}
            />
            <div style={styles.broadcastButtons}>
              <button
                onClick={() => sendBroadcast('INFO')}
                style={styles.infoButton}
              >
                📢 Send Info
              </button>
              <button
                onClick={() => sendBroadcast('FREEZE')}
                style={styles.freezeButton}
              >
                🛑 FREEZE All
              </button>
            </div>
          </div>

          {/* Active volunteers */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              Active Volunteers ({commandView.volunteers.active})
            </h3>
            <div style={styles.volunteerList}>
              {commandView.volunteers.list
                .filter(v => v.status === 'ACTIVE')
                .slice(0, 10)
                .map(v => (
                  <div key={v.id} style={styles.volunteerRow}>
                    <span style={styles.volunteerName}>{v.name}</span>
                    <span style={styles.volunteerZone}>
                      {v.assignedZone || 'Unassigned'}
                    </span>
                    {v.resources.length > 0 && (
                      <span style={styles.resourceBadge}>
                        {v.resources.join(', ')}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Recent sightings */}
          {commandView.sightings.recent.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Recent Sightings</h3>
              {commandView.sightings.recent.slice(0, 5).map(s => (
                <div key={s.id} style={styles.sightingRow}>
                  <span style={styles.sightingPriority}>
                    {s.priority === 'CONFIRMED' ? '✓' : s.priority === 'HIGH' ? '!' : '?'}
                  </span>
                  <span style={styles.sightingReporter}>{s.reporter}</span>
                  <span style={styles.sightingStatus}>
                    {s.verified ? 'Verified' : s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zones tab */}
      {activeTab === 'ZONES' && (
        <div style={styles.content}>
          <button onClick={updateStaleZones} style={styles.refreshButton}>
            🔄 Refresh Stale Zones
          </button>

          <div style={styles.zoneStats}>
            <span>Unsearched: {commandView.coverage.unsearched}</span>
            <span>In Progress: {commandView.coverage.inProgress}</span>
            <span>Stale: {commandView.coverage.stale}</span>
          </div>

          <div style={styles.zoneGrid}>
            {commandView.coverage.zones.slice(0, 20).map(zone => (
              <div
                key={zone.id}
                style={{
                  ...styles.zoneCell,
                  backgroundColor: getZoneColor(zone.status),
                }}
              >
                <span style={styles.zoneRef}>{zone.gridRef}</span>
                <span style={styles.zoneStatus}>
                  {zone.status.substring(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources tab */}
      {activeTab === 'RESOURCES' && (
        <div style={styles.content}>
          <div style={styles.resourceSummary}>
            <div style={styles.resourceType}>
              🚗 Cars: {commandView.resources.cars}
            </div>
            <div style={styles.resourceType}>
              🪤 Traps: {commandView.resources.traps}
            </div>
            <div style={styles.resourceType}>
              📄 Flyers: {commandView.resources.flyers}
            </div>
          </div>

          <h3 style={styles.sectionTitle}>Available Resources</h3>
          {commandView.resources.list
            .filter(r => r.available)
            .map((r, i) => (
              <div key={i} style={styles.resourceRow}>
                <span>{r.type}</span>
                <span style={styles.resourceOwner}>{r.volunteer}</span>
                <button style={styles.requestButton}>Request</button>
              </div>
            ))}
        </div>
      )}

      {/* Traps tab */}
      {activeTab === 'TRAPS' && (
        <div style={styles.content}>
          <button style={styles.addTrapButton}>+ Add Trap Location</button>

          {commandView.trapOps.active > 0 ? (
            <div style={styles.trapList}>
              <h3 style={styles.sectionTitle}>
                Active Traps ({commandView.trapOps.active})
              </h3>
              {commandView.trapOps.traps.map(trap => (
                <div key={trap.id} style={styles.trapRow}>
                  <span style={styles.trapStatus}>
                    {trap.status === 'TRIGGERED' ? '⚠️' : '🪤'}
                  </span>
                  <span style={styles.trapInfo}>
                    Last checked: {trap.lastChecked ? formatTimeAgo(trap.lastChecked) : 'Never'}
                  </span>
                  <button style={styles.checkTrapButton}>Check</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noTraps}>
              No traps deployed. Add trap locations when switching to trap operations mode.
            </p>
          )}

          <button style={styles.switchModeButton}>
            Switch to Trap Operations Mode
          </button>
        </div>
      )}
    </div>
  );
}

function getZoneColor(status) {
  const colors = {
    UNSEARCHED: '#37474F',
    IN_PROGRESS: '#1976D2',
    SEARCHED: '#1565C0',
    STALE: '#FF8F00',
    HIGH_PROBABILITY: '#7B1FA2',
    SIGHTING: '#D32F2F',
  };
  return colors[status] || '#37474F';
}

function formatTimeAgo(date) {
  if (!date) return 'Unknown';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const styles = {
  container: {
    minHeight: 'calc(100vh - 140px)',
  },

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#888',
  },

  tabs: {
    display: 'flex',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #333',
  },

  tab: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  tabActive: {
    color: '#fff',
    borderBottom: '2px solid #2196F3',
  },

  content: {
    padding: '16px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '20px',
  },

  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
  },

  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#2196F3',
  },

  statLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
  },

  broadcastSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 12px 0',
    color: '#fff',
  },

  broadcastInput: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    resize: 'none',
    minHeight: '60px',
    marginBottom: '12px',
  },

  broadcastButtons: {
    display: 'flex',
    gap: '8px',
  },

  infoButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  freezeButton: {
    padding: '12px 16px',
    backgroundColor: '#D32F2F',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },

  volunteerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  volunteerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#2A2A2A',
    borderRadius: '6px',
  },

  volunteerName: {
    flex: 1,
    fontSize: '14px',
    color: '#fff',
  },

  volunteerZone: {
    fontSize: '12px',
    color: '#888',
  },

  resourceBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: '#4CAF50',
    borderRadius: '4px',
    color: '#fff',
  },

  sightingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#2A2A2A',
    borderRadius: '6px',
    marginBottom: '8px',
  },

  sightingPriority: {
    fontSize: '16px',
  },

  sightingReporter: {
    flex: 1,
    fontSize: '14px',
    color: '#fff',
  },

  sightingStatus: {
    fontSize: '12px',
    color: '#888',
  },

  refreshButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#2A2A2A',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '16px',
    minHeight: TOUCH_TARGETS.small,
  },

  zoneStats: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px',
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '12px',
    color: '#888',
  },

  zoneGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
  },

  zoneCell: {
    aspectRatio: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },

  zoneRef: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#fff',
  },

  zoneStatus: {
    fontSize: '8px',
    color: 'rgba(255,255,255,0.7)',
  },

  resourceSummary: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    marginBottom: '20px',
  },

  resourceType: {
    fontSize: '14px',
    color: '#fff',
  },

  resourceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#2A2A2A',
    borderRadius: '8px',
    marginBottom: '8px',
  },

  resourceOwner: {
    flex: 1,
    fontSize: '14px',
    color: '#888',
  },

  requestButton: {
    padding: '8px 16px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },

  addTrapButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '20px',
    minHeight: TOUCH_TARGETS.medium,
  },

  trapList: {
    marginBottom: '20px',
  },

  trapRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#2A2A2A',
    borderRadius: '8px',
    marginBottom: '8px',
  },

  trapStatus: {
    fontSize: '20px',
  },

  trapInfo: {
    flex: 1,
    fontSize: '14px',
    color: '#888',
  },

  checkTrapButton: {
    padding: '8px 16px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },

  noTraps: {
    textAlign: 'center',
    color: '#888',
    fontSize: '14px',
    padding: '40px 20px',
  },

  switchModeButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },
};
