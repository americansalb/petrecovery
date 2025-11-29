'use client';

/**
 * Volunteer View - The "10-Minute Hero" Experience
 *
 * Design:
 * - Simple compass directive (not complex map)
 * - Giant sighting button (thumb-accessible)
 * - Non-verbal signals (no typing while walking)
 * - Large touch targets
 */

import { useState, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic, announce, ARIA_ANNOUNCEMENTS } from '@/app/lib/missionControl/accessibility';
import SightingButton from './SightingButton';

export default function VolunteerView({ caseId, mission, onUpdate }) {
  const [location, setLocation] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [showResources, setShowResources] = useState(false);

  // Get volunteer's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
          });
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Update location on server
  useEffect(() => {
    if (volunteerId && location) {
      fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId, location }),
      }).catch(console.error);
    }
  }, [caseId, volunteerId, location]);

  // Handle quick signals
  const sendSignal = async (signalType) => {
    triggerHaptic('tap');

    try {
      await fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SIGNAL',
          volunteerId,
          signalType,
          location,
        }),
      });

      announce(`${signalType.replace('_', ' ')} signal sent`);
    } catch (err) {
      console.error('Signal error:', err);
    }
  };

  // Handle resource flagging
  const toggleResource = async (resource) => {
    // This would update the resources list
    triggerHaptic('tap');
  };

  return (
    <div style={styles.container}>
      {/* Compass Directive - Simple, clear direction */}
      <div style={styles.directive} role="region" aria-label="Search directive">
        {assignment ? (
          <>
            <div style={styles.arrow} aria-hidden="true">
              {assignment.directive?.arrow || '➡️'}
            </div>
            <h2 style={styles.directiveText}>
              {assignment.directive?.text || 'Search nearby area'}
            </h2>
            <p style={styles.directiveDistance}>
              {assignment.directive?.distance || ''}
            </p>
            {assignment.directive?.tips?.map((tip, i) => (
              <p key={i} style={styles.tip}>{tip}</p>
            ))}
          </>
        ) : (
          <>
            <div style={styles.arrow} aria-hidden="true">🔍</div>
            <h2 style={styles.directiveText}>Search your area</h2>
            <p style={styles.tip}>Keep eyes low - check under bushes, cars, porches</p>
          </>
        )}
      </div>

      {/* Giant Sighting Button - THE most important element */}
      <SightingButton
        caseId={caseId}
        volunteerId={volunteerId}
        location={location}
        petName={mission.pet.name}
        onSightingReported={onUpdate}
      />

      {/* Quick Signal Buttons - No typing required */}
      <div style={styles.signalGrid} role="group" aria-label="Quick signals">
        <button
          onClick={() => sendSignal('AREA_CLEAR')}
          style={styles.signalButton}
          aria-label="Mark area as clear"
        >
          <span style={styles.signalIcon} aria-hidden="true">✓</span>
          <span style={styles.signalLabel}>Clear</span>
        </button>

        <button
          onClick={() => sendSignal('NEED_BACKUP')}
          style={{ ...styles.signalButton, ...styles.backupButton }}
          aria-label="Request backup"
        >
          <span style={styles.signalIcon} aria-hidden="true">🆘</span>
          <span style={styles.signalLabel}>Backup</span>
        </button>

        <button
          onClick={() => sendSignal('TAKING_BREAK')}
          style={styles.signalButton}
          aria-label="Taking a break"
        >
          <span style={styles.signalIcon} aria-hidden="true">⏸</span>
          <span style={styles.signalLabel}>Break</span>
        </button>

        <button
          onClick={() => sendSignal('HEADING_HOME')}
          style={styles.signalButton}
          aria-label="Heading home"
        >
          <span style={styles.signalIcon} aria-hidden="true">🏠</span>
          <span style={styles.signalLabel}>Done</span>
        </button>
      </div>

      {/* Resource toggle */}
      <button
        onClick={() => setShowResources(!showResources)}
        style={styles.resourceToggle}
        aria-expanded={showResources}
      >
        {showResources ? 'Hide Resources' : 'I Have Resources'}
      </button>

      {showResources && (
        <div style={styles.resourceGrid} role="group" aria-label="Available resources">
          {['CAR', 'TRAP', 'FLYERS', 'TREATS', 'CARRIER'].map(resource => (
            <button
              key={resource}
              onClick={() => toggleResource(resource)}
              style={styles.resourceChip}
              aria-pressed={false}
            >
              {getResourceIcon(resource)} {resource}
            </button>
          ))}
        </div>
      )}

      {/* Pet reminder at bottom */}
      <div style={styles.petReminder}>
        <p style={styles.reminderText}>
          Looking for: <strong>{mission.pet.name}</strong>
        </p>
        <p style={styles.reminderDetail}>
          {mission.pet.color} {mission.pet.species}
          {mission.pet.breed && ` • ${mission.pet.breed}`}
        </p>
        {mission.pet.respondsTo && (
          <p style={styles.reminderDetail}>
            Responds to: "{mission.pet.respondsTo}"
          </p>
        )}
      </div>
    </div>
  );
}

function getResourceIcon(type) {
  const icons = {
    CAR: '🚗',
    TRAP: '🪤',
    FLYERS: '📄',
    TREATS: '🍖',
    CARRIER: '📦',
    FLASHLIGHT: '🔦',
  };
  return icons[type] || '📦';
}

const styles = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 'calc(100vh - 140px)',
  },

  directive: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
  },

  arrow: {
    fontSize: '48px',
    marginBottom: '8px',
  },

  directiveText: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  directiveDistance: {
    fontSize: '18px',
    color: '#2196F3',
    margin: 0,
  },

  tip: {
    fontSize: '14px',
    color: '#888',
    margin: '8px 0 0 0',
  },

  signalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },

  signalButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 8px',
    backgroundColor: '#2A2A2A',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    minHeight: TOUCH_TARGETS.medium,
    cursor: 'pointer',
  },

  backupButton: {
    backgroundColor: '#FF57221A',
    border: '1px solid #FF5722',
  },

  signalIcon: {
    fontSize: '24px',
    marginBottom: '4px',
  },

  signalLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: '#888',
  },

  resourceToggle: {
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  resourceGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },

  resourceChip: {
    padding: '8px 16px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  petReminder: {
    marginTop: 'auto',
    padding: '16px',
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    textAlign: 'center',
  },

  reminderText: {
    fontSize: '16px',
    margin: '0 0 4px 0',
    color: '#fff',
  },

  reminderDetail: {
    fontSize: '14px',
    margin: '4px 0 0 0',
    color: '#888',
  },
};
