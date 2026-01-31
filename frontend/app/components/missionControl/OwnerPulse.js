'use client';

/**
 * Owner Pulse - The Pet Owner's View
 *
 * Design: Show effort, not raw data. Reassurance over tactical.
 * - The "Pulse" visualization of volunteers searching
 * - Filtered sightings (verified only)
 * - Call Mode to play voice across all phones
 * - Status broadcast
 */

import { useState, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic } from '@/app/lib/missionControl/accessibility';
import { useToast } from '@/app/components/ui/Toast';

const OWNER_ACTIVITIES = [
  { id: 'AT_HOME', label: 'At home', icon: '🏠' },
  { id: 'SEARCHING', label: 'Out searching', icon: '🔍' },
  { id: 'AT_SHELTER', label: 'Checking shelter', icon: '🏥' },
  { id: 'MAKING_FLYERS', label: 'Making flyers', icon: '📄' },
  { id: 'SETTING_TRAP', label: 'Setting trap', icon: '🪤' },
];

export default function OwnerPulse({ missionId, mission, onUpdate }) {
  const toast = useToast();
  const [ownerView, setOwnerView] = useState(null);
  const [showCallMode, setShowCallMode] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    fetchOwnerView();
    const interval = setInterval(fetchOwnerView, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOwnerView = async () => {
    try {
      const res = await fetch(`/api/mission/${missionId}/owner`);
      if (res.ok) {
        const data = await res.json();
        setOwnerView(data);
      }
    } catch (err) {
      console.error('Error fetching owner view:', err);
    }
  };

  const updateStatus = async (newActivity, newBroadcast = null) => {
    try {
      await fetch(`/api/mission/${missionId}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          activity: newActivity,
          broadcast: newBroadcast,
        }),
      });
      triggerHaptic('success');
      setActivity(newActivity);
      if (newBroadcast) setBroadcast('');
      setShowBroadcast(false);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status.');
    }
  };

  const triggerCallMode = async () => {
    try {
      await fetch(`/api/mission/${missionId}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TRIGGER_CALL_MODE' }),
      });
      triggerHaptic('warning');
      toast.success('Call mode activated! All volunteers are playing your voice clip.');
    } catch (err) {
      console.error('Error triggering call mode:', err);
      toast.error('Failed to activate call mode.');
    }
  };

  return (
    <div style={styles.container}>
      {/* The Pulse - Visualization of effort */}
      <div style={styles.pulseSection}>
        <div style={styles.pulseCircle}>
          <span style={styles.pulseNumber}>{mission.stats.activeVolunteers}</span>
          <span style={styles.pulseLabel}>Searching Now</span>
          {/* Animated rings */}
          <div style={styles.ring1} aria-hidden="true" />
          <div style={styles.ring2} aria-hidden="true" />
          <div style={styles.ring3} aria-hidden="true" />
        </div>
        <p style={styles.totalHelpers}>
          {mission.stats.totalVolunteers} total people have helped
        </p>
      </div>

      {/* Progress */}
      <div style={styles.progressSection}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(mission.stats.zonesSearched / mission.stats.totalZones) * 100}%`,
            }}
          />
        </div>
        <p style={styles.progressText}>
          {mission.stats.zonesSearched} of {mission.stats.totalZones} areas searched
        </p>
      </div>

      {/* Verified Sightings Only */}
      {ownerView?.sightings?.length > 0 && (
        <div style={styles.sightingsSection}>
          <h3 style={styles.sectionTitle}>Sightings</h3>
          {ownerView.sightings.map(s => (
            <div key={s.id} style={styles.sighting}>
              <span style={styles.sightingTime}>{formatTimeAgo(s.time)}</span>
              <span style={styles.sightingBadge}>
                {s.verified ? '✓ Verified' : 'Reported'}
              </span>
              {s.notes && <p style={styles.sightingNotes}>{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Your Status */}
      <div style={styles.statusSection}>
        <h3 style={styles.sectionTitle}>Tell Volunteers Where You Are</h3>
        <div style={styles.activityGrid}>
          {OWNER_ACTIVITIES.map(act => (
            <button
              key={act.id}
              onClick={() => updateStatus(act.id)}
              style={{
                ...styles.activityButton,
                ...(activity === act.id ? styles.activityActive : {}),
              }}
            >
              <span style={styles.activityIcon}>{act.icon}</span>
              <span style={styles.activityLabel}>{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Broadcast Message */}
      <button
        onClick={() => setShowBroadcast(!showBroadcast)}
        style={styles.broadcastToggle}
      >
        📢 Send Tip to Volunteers
      </button>

      {showBroadcast && (
        <div style={styles.broadcastForm}>
          <textarea
            value={broadcast}
            onChange={e => setBroadcast(e.target.value)}
            placeholder={`e.g., "${mission.pet.name} responds to the sound of treats shaking"`}
            style={styles.broadcastInput}
            maxLength={200}
          />
          <button
            onClick={() => updateStatus(activity, broadcast)}
            style={styles.sendButton}
            disabled={!broadcast.trim()}
          >
            Send to All Volunteers
          </button>
        </div>
      )}

      {/* Call Mode */}
      {ownerView?.callMode?.audioUrl && (
        <div style={styles.callModeSection}>
          <h3 style={styles.sectionTitle}>Call Mode</h3>
          <p style={styles.callModeDesc}>
            Play your voice calling {mission.pet.name} on all volunteer phones simultaneously.
          </p>
          <button
            onClick={triggerCallMode}
            style={styles.callModeButton}
          >
            🔊 Play My Voice Now
          </button>
        </div>
      )}

      {/* Reassurance message */}
      <div style={styles.reassurance}>
        <p style={styles.reassuranceText}>
          💙 {mission.stats.activeVolunteers} people are out there looking for {mission.pet.name} right now.
          You're not alone in this.
        </p>
      </div>
    </div>
  );
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const styles = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  pulseSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 0',
  },

  pulseCircle: {
    position: 'relative',
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    backgroundColor: '#1A237E',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseNumber: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#fff',
  },

  pulseLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },

  ring1: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(33, 150, 243, 0.3)',
    animation: 'pulse-ring 2s ease-out infinite',
  },

  ring2: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(33, 150, 243, 0.2)',
    animation: 'pulse-ring 2s ease-out infinite 0.5s',
  },

  ring3: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(33, 150, 243, 0.1)',
    animation: 'pulse-ring 2s ease-out infinite 1s',
  },

  totalHelpers: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#888',
  },

  progressSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
  },

  progressBar: {
    height: '8px',
    backgroundColor: '#333',
    borderRadius: '4px',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },

  progressText: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#888',
    textAlign: 'center',
  },

  sightingsSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
  },

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },

  sighting: {
    padding: '12px 0',
    borderBottom: '1px solid #333',
  },

  sightingTime: {
    fontSize: '12px',
    color: '#888',
  },

  sightingBadge: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#4CAF50',
  },

  sightingNotes: {
    marginTop: '4px',
    fontSize: '14px',
    color: '#fff',
  },

  statusSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
  },

  activityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },

  activityButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  activityActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },

  activityIcon: {
    fontSize: '24px',
    marginBottom: '4px',
  },

  activityLabel: {
    fontSize: '11px',
    textAlign: 'center',
  },

  broadcastToggle: {
    padding: '16px',
    backgroundColor: '#1E1E1E',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: TOUCH_TARGETS.medium,
  },

  broadcastForm: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
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
    minHeight: '80px',
  },

  sendButton: {
    marginTop: '12px',
    width: '100%',
    padding: '14px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  callModeSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '16px',
  },

  callModeDesc: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '12px',
  },

  callModeButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  reassurance: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
  },

  reassuranceText: {
    fontSize: '14px',
    color: '#2196F3',
    margin: 0,
    lineHeight: 1.5,
  },
};
