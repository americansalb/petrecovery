'use client';

/**
 * Squad Leader Command Center
 *
 * Multi-mission coordination view for squad leaders.
 * Manage all active searches from one interface.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function SquadCommandCenter() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const squadId = params.id;

  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState(null);
  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [broadcast, setBroadcast] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalVolunteers: 0,
    totalZones: 0,
    zonesSearched: 0,
    sightings: 0,
  });

  useEffect(() => {
    if (squadId) {
      fetchSquadData();
      const interval = setInterval(fetchMissions, 10000);
      return () => clearInterval(interval);
    }
  }, [squadId]);

  const fetchSquadData = async () => {
    try {
      const [squadRes, missionsRes] = await Promise.all([
        fetch(`/api/rescue-squads/${squadId}`),
        fetch(`/api/rescue-squads/${squadId}/live-missions`)
      ]);

      if (!squadRes.ok) {
        setError('Squad not found');
        return;
      }

      const squadData = await squadRes.json();
      setSquad(squadData.squad);
      setUserRole(squadData.userRole);

      // Check if user is authorized (leader or founder)
      if (!['FOUNDER', 'LEADER', 'COORDINATOR'].includes(squadData.userRole)) {
        setError('Unauthorized: Squad leaders only');
        return;
      }

      if (missionsRes.ok) {
        const missionsData = await missionsRes.json();
        setMissions(missionsData.missions || []);
        calculateStats(missionsData.missions || []);
      }
    } catch (err) {
      console.error('Error fetching squad:', err);
      setError('Failed to load squad data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMissions = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/live-missions`);
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        calculateStats(data.missions || []);
      }
    } catch (err) {
      console.error('Error refreshing missions:', err);
    }
  };

  const calculateStats = (missionList) => {
    const stats = missionList.reduce((acc, m) => ({
      totalVolunteers: acc.totalVolunteers + (m.activeVolunteers || 0),
      totalZones: acc.totalZones + (m.totalZones || 0),
      zonesSearched: acc.zonesSearched + (m.zonesSearched || 0),
      sightings: acc.sightings + (m.sightings || 0),
    }), { totalVolunteers: 0, totalZones: 0, zonesSearched: 0, sightings: 0 });
    setStats(stats);
  };

  const sendGlobalBroadcast = async (type = 'INFO') => {
    if (!broadcast.trim()) return;
    setSending(true);

    try {
      await fetch(`/api/rescue-squads/${squadId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcast,
          type,
          missionIds: selectedMission ? [selectedMission] : missions.map(m => m.id),
        }),
      });
      setBroadcast('');
      alert(selectedMission ? 'Sent to mission!' : 'Sent to all missions!');
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'LIVE_SEARCH': return 'Live Search';
      case 'CONTAINMENT': return 'Containment';
      case 'TRAP_OPS': return 'Trap Operations';
      default: return mode;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'LIVE_SEARCH': return '#2196F3';
      case 'CONTAINMENT': return '#FF9800';
      case 'TRAP_OPS': return '#9C27B0';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading Command Center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>⚠️</span>
          <h2 style={styles.errorTitle}>{error}</h2>
          <button onClick={() => router.push(`/rescue-squads/${squadId}`)} style={styles.backButton}>
            Back to Squad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href={`/rescue-squads/${squadId}`} style={styles.backLink}>
            ← Back to Squad
          </Link>
          <h1 style={styles.title}>
            <span style={styles.titleIcon}>🎯</span>
            Command Center
          </h1>
          <p style={styles.subtitle}>{squad?.name}</p>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.roleBadge}>{userRole}</span>
          <span style={styles.liveBadge}>
            <span style={styles.liveIndicator}>●</span>
            {missions.length} Active Mission{missions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Global Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats.totalVolunteers}</span>
          <span style={styles.statLabel}>Total Volunteers</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats.totalZones}</span>
          <span style={styles.statLabel}>Zones</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>
            {stats.totalZones > 0 ? Math.round((stats.zonesSearched / stats.totalZones) * 100) : 0}%
          </span>
          <span style={styles.statLabel}>Coverage</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats.sightings}</span>
          <span style={styles.statLabel}>Sightings</span>
        </div>
      </div>

      {/* Broadcast Section */}
      <div style={styles.broadcastSection}>
        <div style={styles.broadcastHeader}>
          <h3 style={styles.sectionTitle}>
            📢 Broadcast Command
          </h3>
          <select
            value={selectedMission || ''}
            onChange={(e) => setSelectedMission(e.target.value || null)}
            style={styles.missionSelect}
          >
            <option value="">All Missions</option>
            {missions.map(m => (
              <option key={m.id} value={m.id}>
                {m.pet?.name || 'Unknown'} - {getModeLabel(m.mode)}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          placeholder="Type a message to broadcast to all volunteers..."
          style={styles.broadcastInput}
          maxLength={300}
        />
        <div style={styles.broadcastActions}>
          <button
            onClick={() => sendGlobalBroadcast('INFO')}
            disabled={sending || !broadcast.trim()}
            style={styles.infoButton}
          >
            📢 Send Info
          </button>
          <button
            onClick={() => sendGlobalBroadcast('URGENT')}
            disabled={sending || !broadcast.trim()}
            style={styles.urgentButton}
          >
            🚨 Send Urgent
          </button>
          <button
            onClick={() => sendGlobalBroadcast('FREEZE')}
            disabled={sending}
            style={styles.freezeButton}
          >
            🛑 FREEZE All
          </button>
        </div>
      </div>

      {/* Active Missions Grid */}
      <div style={styles.missionsSection}>
        <h3 style={styles.sectionTitle}>Active Missions</h3>

        {missions.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>📭</span>
            <h4 style={styles.emptyTitle}>No Active Missions</h4>
            <p style={styles.emptyText}>
              When squad members start live searches, they'll appear here.
            </p>
          </div>
        ) : (
          <div style={styles.missionGrid}>
            {missions.map(mission => (
              <div key={mission.id} style={styles.missionCard}>
                {/* Mission Header */}
                <div style={styles.missionHeader}>
                  <div style={styles.missionPet}>
                    {mission.pet?.photoUrl ? (
                      <img
                        src={mission.pet.photoUrl}
                        alt={mission.pet.name}
                        style={styles.petPhoto}
                      />
                    ) : (
                      <div style={styles.petPhotoPlaceholder}>
                        {mission.pet?.species === 'DOG' ? '🐕' : '🐈'}
                      </div>
                    )}
                    <div>
                      <div style={styles.petName}>{mission.pet?.name || 'Unknown Pet'}</div>
                      <div style={styles.caseNumber}>Case #{mission.caseNumber}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.modeBadge,
                      backgroundColor: getModeColor(mission.mode),
                    }}
                  >
                    {getModeLabel(mission.mode)}
                  </span>
                </div>

                {/* Mission Stats */}
                <div style={styles.missionStats}>
                  <div style={styles.missionStat}>
                    <span style={styles.missionStatValue}>{mission.activeVolunteers}</span>
                    <span style={styles.missionStatLabel}>Volunteers</span>
                  </div>
                  <div style={styles.missionStat}>
                    <span style={styles.missionStatValue}>
                      {mission.totalZones > 0
                        ? Math.round((mission.zonesSearched / mission.totalZones) * 100)
                        : 0}%
                    </span>
                    <span style={styles.missionStatLabel}>Coverage</span>
                  </div>
                  <div style={styles.missionStat}>
                    <span style={styles.missionStatValue}>{mission.sightings}</span>
                    <span style={styles.missionStatLabel}>Sightings</span>
                  </div>
                </div>

                {/* Last Seen Location */}
                {mission.lastSeen?.address && (
                  <div style={styles.lastSeen}>
                    <span style={styles.lastSeenIcon}>📍</span>
                    <span style={styles.lastSeenText}>{mission.lastSeen.address}</span>
                  </div>
                )}

                {/* Mission Actions */}
                <div style={styles.missionActions}>
                  <Link
                    href={`/cases/${mission.caseNumber}`}
                    style={styles.viewMissionButton}
                  >
                    Open Mission Control →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <Link href={`/rescue-squads/${squadId}/divisions`} style={styles.quickAction}>
          <span>👥</span> Manage Divisions
        </Link>
        <Link href={`/rescue-squads/${squadId}/members`} style={styles.quickAction}>
          <span>🧑‍🤝‍🧑</span> View Members
        </Link>
        <Link href={`/rescue-squads/${squadId}/stats`} style={styles.quickAction}>
          <span>📊</span> Squad Stats
        </Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    color: '#888',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #333',
    borderTopColor: '#2196F3',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },

  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    padding: '20px',
  },

  errorCard: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    maxWidth: '400px',
  },

  errorIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  errorTitle: {
    fontSize: '20px',
    fontWeight: 600,
    margin: '0 0 20px 0',
    color: '#fff',
  },

  backButton: {
    padding: '12px 24px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px',
    borderBottom: '1px solid #222',
    backgroundColor: '#111',
  },

  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  backLink: {
    color: '#888',
    fontSize: '13px',
    textDecoration: 'none',
    marginBottom: '8px',
  },

  title: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  titleIcon: {
    fontSize: '28px',
  },

  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  roleBadge: {
    padding: '6px 12px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },

  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#dc2626',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
  },

  liveIndicator: {
    animation: 'pulse 2s infinite',
    color: '#fff',
    fontSize: '10px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    padding: '20px',
    borderBottom: '1px solid #222',
  },

  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
  },

  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#2196F3',
  },

  statLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: '4px',
  },

  broadcastSection: {
    padding: '20px',
    borderBottom: '1px solid #222',
  },

  broadcastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
  },

  missionSelect: {
    padding: '8px 12px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
  },

  broadcastInput: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#1E1E1E',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    resize: 'none',
    minHeight: '80px',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },

  broadcastActions: {
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
  },

  urgentButton: {
    padding: '12px 16px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
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
  },

  missionsSection: {
    padding: '20px',
  },

  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
  },

  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 8px 0',
  },

  emptyText: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },

  missionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
    marginTop: '16px',
  },

  missionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #333',
  },

  missionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #333',
  },

  missionPet: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  petPhoto: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    objectFit: 'cover',
  },

  petPhotoPlaceholder: {
    width: '48px',
    height: '48px',
    backgroundColor: '#2A2A2A',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },

  petName: {
    fontSize: '16px',
    fontWeight: 600,
  },

  caseNumber: {
    fontSize: '12px',
    color: '#888',
  },

  modeBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    textTransform: 'uppercase',
  },

  missionStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    padding: '16px',
    borderBottom: '1px solid #333',
  },

  missionStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  missionStatValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#2196F3',
  },

  missionStatLabel: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
  },

  lastSeen: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#2A2A2A',
    fontSize: '13px',
  },

  lastSeenIcon: {
    fontSize: '14px',
  },

  lastSeenText: {
    color: '#888',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  missionActions: {
    padding: '16px',
  },

  viewMissionButton: {
    display: 'block',
    padding: '12px',
    backgroundColor: '#2196F3',
    color: '#fff',
    textAlign: 'center',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
  },

  quickActions: {
    display: 'flex',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid #222',
    justifyContent: 'center',
  },

  quickAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#1E1E1E',
    color: '#fff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    border: '1px solid #333',
  },
};
