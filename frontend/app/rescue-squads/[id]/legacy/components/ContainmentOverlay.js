'use client';

/**
 * ContainmentOverlay - FREEZE Protocol Screen
 *
 * Takes over the entire screen when a confirmed sighting is reported.
 * Guides volunteer to freeze, shows perimeter positions.
 */

import { useState, useEffect } from 'react';
import { useSquad, ALERT_LEVELS } from '../context/SquadContext';

export default function ContainmentOverlay() {
  const {
    alertLevel,
    activeSighting,
    selectedCase,
    userRole,
    clearContainment,
  } = useSquad();

  const [arrived, setArrived] = useState(false);
  const [position, setPosition] = useState(null); // Assigned perimeter position

  // Vibrate on mount (if supported)
  useEffect(() => {
    if (alertLevel === ALERT_LEVELS.CRITICAL && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [alertLevel]);

  if (alertLevel !== ALERT_LEVELS.CRITICAL) {
    return null;
  }

  const isLeader = ['FOUNDER', 'LEADER'].includes(userRole);
  const petName = selectedCase?.petName || 'the pet';

  // Reporter view (they made the sighting)
  if (activeSighting?.isReporter) {
    return (
      <div style={styles.overlay}>
        <div style={styles.freezeContainer}>
          <div style={styles.freezeIcon}>🛑</div>
          <h1 style={styles.freezeTitle}>FREEZE</h1>

          <div style={styles.instructions}>
            <p style={styles.instruction}>❌ Do NOT move</p>
            <p style={styles.instruction}>❌ Do NOT approach {petName}</p>
            <p style={styles.instruction}>❌ Do NOT make eye contact</p>
            <p style={styles.instruction}>❌ Stay very quiet</p>
          </div>

          <div style={styles.statusBox}>
            <div style={styles.pulseRing} />
            <p style={styles.statusText}>Notifying team...</p>
            <p style={styles.statusSubtext}>Help is on the way</p>
          </div>

          <div style={styles.quietReminder}>
            <span>🤫</span>
            <span>Scared pets run from noise</span>
          </div>
        </div>
      </div>
    );
  }

  // Leader view
  if (isLeader) {
    return (
      <div style={styles.overlay}>
        <div style={styles.alertHeader}>
          <div style={styles.alertBadge}>
            <span style={styles.alertIcon}>👁</span>
            SIGHTING REPORTED
          </div>
        </div>

        {/* Pet reminder */}
        <div style={styles.petReminder}>
          <div style={{
            ...styles.petPhoto,
            backgroundImage: selectedCase?.petPhotoUrl
              ? `url(${selectedCase.petPhotoUrl})`
              : 'none',
          }}>
            {!selectedCase?.petPhotoUrl && <span>🐾</span>}
          </div>
          <div>
            <h2 style={styles.petName}>{petName} spotted!</h2>
            <p style={styles.petDesc}>
              {selectedCase?.petColor} {selectedCase?.petSpecies}
            </p>
          </div>
        </div>

        {/* Perimeter control */}
        <div style={styles.perimeterSection}>
          <h3 style={styles.sectionTitle}>Perimeter Status</h3>
          <div style={styles.perimeterGrid}>
            {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map(dir => (
              <div key={dir} style={styles.perimeterPosition}>
                <span style={styles.positionDir}>{dir}</span>
                <span style={styles.positionStatus}>Open</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leader actions */}
        <div style={styles.leaderActions}>
          <button style={styles.verifyButton}>
            ✓ Verify Sighting
          </button>
          <button
            onClick={clearContainment}
            style={styles.standDownButton}
          >
            ✕ False Alarm
          </button>
        </div>

        <div style={styles.quietReminder}>
          <span>🤫</span>
          <span>Remind team: stay quiet, move slowly</span>
        </div>
      </div>
    );
  }

  // Volunteer view
  return (
    <div style={styles.overlay}>
      <div style={styles.alertHeader}>
        <div style={styles.alertBadge}>
          <span style={styles.alertIcon}>👁</span>
          SIGHTING REPORTED
        </div>
      </div>

      {/* Pet reminder */}
      <div style={styles.petReminder}>
        <div style={{
          ...styles.petPhoto,
          backgroundImage: selectedCase?.petPhotoUrl
            ? `url(${selectedCase.petPhotoUrl})`
            : 'none',
        }}>
          {!selectedCase?.petPhotoUrl && <span>🐾</span>}
        </div>
        <div>
          <h2 style={styles.petName}>{petName} spotted!</h2>
          <p style={styles.petDesc}>
            {selectedCase?.petColor} {selectedCase?.petSpecies}
          </p>
        </div>
      </div>

      {/* Volunteer instructions */}
      <div style={styles.volunteerInstructions}>
        <h3 style={styles.sectionTitle}>Your Instructions</h3>

        {position ? (
          <>
            <div style={styles.positionCard}>
              <span style={styles.positionIcon}>📍</span>
              <span>Move to {position} position</span>
            </div>

            <div style={styles.steps}>
              <p style={styles.step}>1. Move SLOWLY and QUIETLY</p>
              <p style={styles.step}>2. Do NOT approach the pet</p>
              <p style={styles.step}>3. Position yourself to WATCH, not chase</p>
              <p style={styles.step}>4. Wait for leader's signal</p>
            </div>

            {!arrived ? (
              <button
                onClick={() => setArrived(true)}
                style={styles.arriveButton}
              >
                I'm In Position
              </button>
            ) : (
              <div style={styles.holdingMessage}>
                <span>✓</span>
                <span>Hold position. Wait for instructions.</span>
              </div>
            )}
          </>
        ) : (
          <div style={styles.waitingMessage}>
            <p>Stand by for position assignment...</p>
            <p style={styles.waitingSubtext}>
              If you're far away, continue your current search.
            </p>
          </div>
        )}
      </div>

      <div style={styles.quietReminder}>
        <span>🤫</span>
        <span>Keep quiet. Scared pets run from noise.</span>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#0f172a',
    zIndex: 9999,
    overflow: 'auto',
    padding: '20px',
  },

  // Freeze screen (reporter)
  freezeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    background: '#991b1b',
    borderRadius: '20px',
    padding: '40px 20px',
  },

  freezeIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },

  freezeTitle: {
    fontSize: '48px',
    fontWeight: '900',
    color: '#fff',
    letterSpacing: '4px',
    margin: '0 0 32px 0',
  },

  instructions: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
  },

  instruction: {
    fontSize: '18px',
    color: '#fff',
    margin: '12px 0',
    fontWeight: '600',
  },

  statusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
  },

  pulseRing: {
    width: '60px',
    height: '60px',
    border: '4px solid #fff',
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  statusText: {
    fontSize: '18px',
    color: '#fff',
    marginTop: '16px',
    fontWeight: '600',
  },

  statusSubtext: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    marginTop: '4px',
  },

  // Alert header
  alertHeader: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },

  alertBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#f97316',
    borderRadius: '24px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    animation: 'pulse 1.5s infinite',
  },

  alertIcon: {
    fontSize: '20px',
  },

  // Pet reminder
  petReminder: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#1e293b',
    borderRadius: '12px',
    marginBottom: '24px',
  },

  petPhoto: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: '3px solid #22c55e',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },

  petName: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },

  petDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '4px 0 0 0',
  },

  // Perimeter control
  perimeterSection: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },

  sectionTitle: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 16px 0',
  },

  perimeterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },

  perimeterPosition: {
    padding: '12px 8px',
    background: '#334155',
    borderRadius: '8px',
    textAlign: 'center',
  },

  positionDir: {
    display: 'block',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
  },

  positionStatus: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    marginTop: '4px',
  },

  // Leader actions
  leaderActions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },

  verifyButton: {
    flex: 1,
    padding: '16px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  standDownButton: {
    flex: 1,
    padding: '16px',
    background: '#475569',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  // Volunteer instructions
  volunteerInstructions: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },

  positionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#3b82f6',
    borderRadius: '12px',
    marginBottom: '16px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
  },

  positionIcon: {
    fontSize: '24px',
  },

  steps: {
    marginBottom: '20px',
  },

  step: {
    fontSize: '16px',
    color: '#fff',
    margin: '12px 0',
    paddingLeft: '12px',
    borderLeft: '3px solid #22c55e',
  },

  arriveButton: {
    width: '100%',
    padding: '18px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  holdingMessage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px',
    background: 'rgba(34, 197, 94, 0.2)',
    borderRadius: '12px',
    color: '#22c55e',
    fontSize: '18px',
    fontWeight: '600',
  },

  waitingMessage: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '16px',
  },

  waitingSubtext: {
    fontSize: '14px',
    marginTop: '8px',
    color: '#64748b',
  },

  // Quiet reminder
  quietReminder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    background: 'rgba(249, 115, 22, 0.1)',
    borderRadius: '12px',
    color: '#f97316',
    fontSize: '14px',
  },
};
