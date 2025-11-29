'use client';

/**
 * Mission Control - Main Component
 *
 * Real-time tactical coordination interface.
 * Design: "Calm Urgency" - clear, focused, reassuring.
 *
 * Accessibility:
 * - High contrast for outdoor use
 * - Colorblind-safe (no red/green only)
 * - Large touch targets (44px min)
 * - Screen reader support
 */

import { useState, useEffect, useCallback } from 'react';
import { ACCESSIBLE_COLORS, ZONE_VISUALS, TOUCH_TARGETS, announce } from '@/app/lib/missionControl/accessibility';
import VolunteerView from './VolunteerView';
import OwnerPulse from './OwnerPulse';
import CommandCenter from './CommandCenter';
import SightingAlert from './SightingAlert';
import ActivationSwitch from './ActivationSwitch';

export default function MissionControl({ caseId, userRole, initialState }) {
  const [mission, setMission] = useState(initialState);
  const [loading, setLoading] = useState(!initialState);
  const [error, setError] = useState(null);

  // Fetch mission state
  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch(`/api/mission/${caseId}`);
      if (!res.ok) throw new Error('Failed to fetch mission');
      const data = await res.json();
      setMission(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Initial fetch
  useEffect(() => {
    if (!initialState) {
      fetchMission();
    }
  }, [fetchMission, initialState]);

  // Poll for updates when live
  useEffect(() => {
    if (mission?.isLive) {
      const interval = setInterval(fetchMission, 5000); // 5 second polling
      return () => clearInterval(interval);
    }
  }, [mission?.isLive, fetchMission]);

  // Announce mode changes
  useEffect(() => {
    if (mission?.mode === 'CONTAINMENT') {
      announce('Containment mode activated. Stop moving.', 'assertive');
    }
  }, [mission?.mode]);

  if (loading) {
    return (
      <div
        className="mission-loading"
        style={styles.loadingContainer}
        role="status"
        aria-label="Loading mission control"
      >
        <div style={styles.spinner} aria-hidden="true" />
        <p style={styles.loadingText}>Loading mission...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer} role="alert">
        <p style={styles.errorText}>Error: {error}</p>
        <button
          onClick={fetchMission}
          style={styles.retryButton}
          aria-label="Retry loading mission"
        >
          Retry
        </button>
      </div>
    );
  }

  // Not activated - show activation switch
  if (!mission?.isLive && mission?.mode === 'INACTIVE') {
    return (
      <ActivationSwitch
        caseId={caseId}
        mission={mission}
        userRole={userRole}
        onActivated={fetchMission}
      />
    );
  }

  // Containment mode - show sighting alert overlay
  if (mission?.mode === 'CONTAINMENT') {
    return (
      <SightingAlert
        mission={mission}
        userRole={userRole}
        onUpdate={fetchMission}
      />
    );
  }

  // Render based on role
  const renderRoleView = () => {
    switch (userRole) {
      case 'OWNER':
        return (
          <OwnerPulse
            caseId={caseId}
            mission={mission}
            onUpdate={fetchMission}
          />
        );

      case 'LEADER':
      case 'COORDINATOR':
        return (
          <CommandCenter
            caseId={caseId}
            mission={mission}
            onUpdate={fetchMission}
          />
        );

      case 'VOLUNTEER':
      default:
        return (
          <VolunteerView
            caseId={caseId}
            mission={mission}
            onUpdate={fetchMission}
          />
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Mission header - always visible */}
      <header style={styles.header} role="banner">
        <div style={styles.petInfo}>
          {mission.pet.photoUrl && (
            <img
              src={mission.pet.photoUrl}
              alt={`Photo of ${mission.pet.name}`}
              style={styles.petPhoto}
            />
          )}
          <div>
            <h1 style={styles.petName}>{mission.pet.name}</h1>
            <p style={styles.species}>
              {mission.pet.species} • {mission.pet.color}
            </p>
          </div>
        </div>

        <div style={styles.urgency} aria-label={`Missing for ${mission.hoursElapsed} hours`}>
          <span style={styles.clock} aria-hidden="true">⏱</span>
          <span style={getUrgencyStyle(mission.urgencyLevel)}>
            {formatTimeElapsed(mission.hoursElapsed)}
          </span>
        </div>
      </header>

      {/* Live stats bar */}
      <div style={styles.statsBar} role="status" aria-live="polite">
        <div style={styles.stat}>
          <span style={styles.statValue}>{mission.stats.activeVolunteers}</span>
          <span style={styles.statLabel}>Searching</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statValue}>{mission.stats.zonesSearched}/{mission.stats.totalZones}</span>
          <span style={styles.statLabel}>Zones</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statValue}>{mission.stats.sightingsCount}</span>
          <span style={styles.statLabel}>Sightings</span>
        </div>
      </div>

      {/* Role-specific view */}
      <main style={styles.main}>
        {renderRoleView()}
      </main>

      {/* Aria announcer for screen readers */}
      <div
        id="aria-announcer"
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      />
    </div>
  );
}

function formatTimeElapsed(hours) {
  if (hours === null || hours === undefined) return 'Unknown';
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h missing`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function getUrgencyStyle(level) {
  const colors = {
    CRITICAL: '#FF5252',
    HIGH: '#FF9800',
    ELEVATED: '#FFC107',
    MODERATE: '#4CAF50',
    EXTENDED: '#9E9E9E',
  };
  return {
    ...styles.urgencyText,
    color: colors[level] || colors.MODERATE,
  };
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderBottom: '1px solid #333',
  },

  petInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  petPhoto: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #fff',
  },

  petName: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
  },

  species: {
    fontSize: '14px',
    color: '#B0B0B0',
    margin: 0,
  },

  urgency: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  clock: {
    fontSize: '20px',
  },

  urgencyText: {
    fontSize: '16px',
    fontWeight: 600,
  },

  statsBar: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #333',
  },

  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#2196F3',
  },

  statLabel: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
  },

  main: {
    flex: 1,
  },

  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#121212',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #333',
    borderTop: '4px solid #2196F3',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    marginTop: '16px',
    color: '#888',
  },

  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#121212',
    padding: '20px',
  },

  errorText: {
    color: '#FF5252',
    marginBottom: '16px',
  },

  retryButton: {
    padding: '12px 24px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    minWidth: TOUCH_TARGETS.large,
    minHeight: TOUCH_TARGETS.small,
  },

  srOnly: {
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  },
};
