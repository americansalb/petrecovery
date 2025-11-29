'use client';

/**
 * Volunteer View - The "10-Minute Hero" Experience
 *
 * Design:
 * - Simple compass directive (not complex map)
 * - Giant sighting button (thumb-accessible)
 * - Non-verbal signals (no typing while walking)
 * - Large touch targets
 * - Mobile-first with offline support indicators
 */

import { useState, useEffect, useRef } from 'react';
import { TOUCH_TARGETS, triggerHaptic, announce, ARIA_ANNOUNCEMENTS } from '@/app/lib/missionControl/accessibility';
import SightingButton from './SightingButton';
import useRealtimeUpdates from '@/app/lib/missionControl/useRealtimeUpdates';

export default function VolunteerView({ caseId, mission, onUpdate }) {
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('acquiring'); // acquiring, active, error
  const [assignment, setAssignment] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [showResources, setShowResources] = useState(false);
  const [showPetPhoto, setShowPetPhoto] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [resources, setResources] = useState([]);
  const [recentSightings, setRecentSightings] = useState([]);
  const lastUpdateRef = useRef(null);

  // Real-time updates
  const { connected, mode } = useRealtimeUpdates(caseId, {
    onSighting: (data) => {
      setRecentSightings(prev => [data, ...prev].slice(0, 3));
    },
    enabled: !!volunteerId,
  });

  // Initialize volunteer session
  useEffect(() => {
    // Get stored volunteer ID
    const storedId = localStorage.getItem(`mission_${caseId}_volunteer`);
    if (storedId) {
      setVolunteerId(storedId);
      setCheckInTime(new Date());
    }
  }, [caseId]);

  // Timer for elapsed time
  useEffect(() => {
    if (!checkInTime) return;
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() - checkInTime.getTime()) / 60000);
      setElapsedMinutes(mins);
    }, 60000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  // Get volunteer's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      setLocationStatus('acquiring');

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
          });
          setLocationStatus('active');
          lastUpdateRef.current = Date.now();
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocationStatus('error');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationStatus('error');
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
    triggerHaptic('tap');

    const newResources = resources.includes(resource)
      ? resources.filter(r => r !== resource)
      : [...resources, resource];

    setResources(newResources);

    try {
      await fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FLAG_RESOURCES',
          volunteerId,
          resources: newResources,
        }),
      });
    } catch (err) {
      console.error('Resource update error:', err);
    }
  };

  // Handle check out
  const handleCheckOut = async () => {
    triggerHaptic('tap');

    try {
      await fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECK_OUT',
          volunteerId,
        }),
      });

      localStorage.removeItem(`mission_${caseId}_volunteer`);
      announce('Thank you for helping! You have checked out.', 'polite');
      onUpdate?.();
    } catch (err) {
      console.error('Check out error:', err);
    }
  };

  return (
    <div style={styles.container}>
      {/* Status Bar - Connection and Location */}
      <div style={styles.statusBar}>
        <div style={styles.statusItem}>
          <span style={{
            ...styles.statusDot,
            backgroundColor: connected ? '#4CAF50' : '#FF9800',
          }} />
          <span style={styles.statusText}>
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        <div style={styles.statusItem}>
          <span style={{
            ...styles.statusDot,
            backgroundColor: locationStatus === 'active' ? '#4CAF50' :
                            locationStatus === 'acquiring' ? '#FF9800' : '#F44336',
          }} />
          <span style={styles.statusText}>
            {locationStatus === 'active' ? 'GPS Active' :
             locationStatus === 'acquiring' ? 'Getting GPS...' : 'GPS Error'}
          </span>
        </div>
        {elapsedMinutes > 0 && (
          <div style={styles.statusItem}>
            <span style={styles.statusText}>
              {elapsedMinutes}m searching
            </span>
          </div>
        )}
      </div>

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

      {/* Recent Sightings Alert */}
      {recentSightings.length > 0 && (
        <div style={styles.sightingAlert}>
          <span style={styles.sightingIcon}>👁</span>
          <div>
            <strong>Recent sighting!</strong>
            <p style={styles.sightingTime}>
              {formatTimeAgo(recentSightings[0].timestamp)}
            </p>
          </div>
        </div>
      )}

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
        <button
          onClick={() => setShowPetPhoto(!showPetPhoto)}
          style={styles.petReminderButton}
        >
          <div style={styles.petReminderContent}>
            {mission.pet?.photoUrl && (
              <img
                src={mission.pet.photoUrl}
                alt={mission.pet.name}
                style={styles.petThumbnail}
              />
            )}
            <div>
              <p style={styles.reminderText}>
                Looking for: <strong>{mission.pet?.name || 'Lost Pet'}</strong>
              </p>
              <p style={styles.reminderDetail}>
                {mission.pet?.color} {mission.pet?.species}
                {mission.pet?.breed && ` • ${mission.pet.breed}`}
              </p>
            </div>
          </div>
          <span style={styles.expandIcon}>{showPetPhoto ? '▼' : '▶'}</span>
        </button>

        {showPetPhoto && mission.pet?.photoUrl && (
          <div style={styles.petPhotoExpanded}>
            <img
              src={mission.pet.photoUrl}
              alt={mission.pet.name}
              style={styles.petPhotoLarge}
            />
            {mission.pet?.respondsTo && (
              <p style={styles.respondsTo}>
                Responds to: "{mission.pet.respondsTo}"
              </p>
            )}
            {mission.pet?.distinctiveFeatures && (
              <p style={styles.features}>
                {mission.pet.distinctiveFeatures}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Check Out Button */}
      <button onClick={handleCheckOut} style={styles.checkOutButton}>
        Check Out - Done Searching
      </button>
    </div>
  );
}

function formatTimeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
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

  statusBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '8px 16px',
    backgroundColor: '#1A1A1A',
    borderRadius: '8px',
  },

  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },

  statusText: {
    fontSize: '12px',
    color: '#888',
  },

  sightingAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    border: '1px solid #FF5722',
    borderRadius: '12px',
  },

  sightingIcon: {
    fontSize: '24px',
  },

  sightingTime: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
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
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    overflow: 'hidden',
  },

  petReminderButton: {
    width: '100%',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },

  petReminderContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
  },

  petThumbnail: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '2px solid #4CAF50',
  },

  expandIcon: {
    color: '#888',
    fontSize: '12px',
  },

  petPhotoExpanded: {
    padding: '0 16px 16px',
    textAlign: 'center',
  },

  petPhotoLarge: {
    width: '100%',
    maxWidth: '300px',
    borderRadius: '12px',
    marginBottom: '12px',
  },

  respondsTo: {
    fontSize: '14px',
    color: '#4CAF50',
    margin: '0 0 8px 0',
    fontWeight: 600,
  },

  features: {
    fontSize: '13px',
    color: '#888',
    margin: 0,
    lineHeight: 1.5,
  },

  reminderText: {
    fontSize: '16px',
    margin: '0 0 4px 0',
    color: '#fff',
  },

  reminderDetail: {
    fontSize: '14px',
    margin: 0,
    color: '#888',
  },

  checkOutButton: {
    padding: '16px',
    backgroundColor: 'transparent',
    border: '1px solid #666',
    borderRadius: '12px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px',
    minHeight: TOUCH_TARGETS.medium,
  },
};
