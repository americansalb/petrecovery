'use client';

/**
 * Sighting Alert - Containment Mode Overlay
 *
 * When a confirmed sighting comes in, this takes over the screen.
 * Shows perimeter positions and guides volunteers to their spots.
 */

import { useState, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic, announce } from '@/app/lib/missionControl/accessibility';

export default function SightingAlert({ mission, userRole, onUpdate }) {
  const [myPosition, setMyPosition] = useState(null);
  const [arrivedAtPosition, setArrivedAtPosition] = useState(false);

  useEffect(() => {
    // Announce containment mode
    announce('Containment mode active. A sighting has been reported.', 'assertive');
    triggerHaptic('urgent');
  }, []);

  const confirmArrival = async () => {
    triggerHaptic('success');
    setArrivedAtPosition(true);
    // API call to confirm position
  };

  return (
    <div style={styles.overlay} role="alert" aria-live="assertive">
      {/* Alert header */}
      <div style={styles.header}>
        <div style={styles.alertBadge}>
          <span style={styles.alertIcon}>👁</span>
          SIGHTING REPORTED
        </div>
      </div>

      {/* Pet info reminder */}
      <div style={styles.petReminder}>
        <img
          src={mission.pet.photoUrl}
          alt={mission.pet.name}
          style={styles.petPhoto}
        />
        <div>
          <h2 style={styles.petName}>{mission.pet.name} spotted!</h2>
          <p style={styles.petDesc}>{mission.pet.color} {mission.pet.species}</p>
        </div>
      </div>

      {/* Instructions based on role */}
      {userRole === 'VOLUNTEER' ? (
        <div style={styles.instructions}>
          <h3 style={styles.instructionTitle}>Your Instructions:</h3>

          {myPosition ? (
            <>
              <div style={styles.positionCard}>
                <span style={styles.positionIcon}>📍</span>
                <span style={styles.positionLabel}>
                  Move to {myPosition.position} position
                </span>
              </div>

              <div style={styles.steps}>
                <p style={styles.step}>1. Move SLOWLY and QUIETLY</p>
                <p style={styles.step}>2. Do NOT approach the pet</p>
                <p style={styles.step}>3. Position yourself to watch, not chase</p>
                <p style={styles.step}>4. Wait for leader's signal</p>
              </div>

              {!arrivedAtPosition ? (
                <button onClick={confirmArrival} style={styles.arriveButton}>
                  I'm In Position
                </button>
              ) : (
                <div style={styles.holdingMessage}>
                  <span style={styles.holdingIcon}>✓</span>
                  Hold position. Wait for instructions.
                </div>
              )}
            </>
          ) : (
            <div style={styles.waitingMessage}>
              <p>Stand by for position assignment...</p>
              <p style={styles.subText}>
                If you're far from the sighting, continue your current search.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Leader view
        <div style={styles.leaderView}>
          <h3 style={styles.instructionTitle}>Perimeter Status:</h3>

          <div style={styles.perimeterGrid}>
            {mission.containment?.positions?.map((pos, i) => (
              <div
                key={i}
                style={{
                  ...styles.perimeterPosition,
                  backgroundColor: pos.assigned ? '#4CAF50' : '#333',
                }}
              >
                <span style={styles.positionName}>{pos.position}</span>
                <span style={styles.positionStatus}>
                  {pos.assigned ? pos.volunteerName || 'Assigned' : 'Open'}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.leaderActions}>
            <button style={styles.verifyButton}>
              ✓ Verify Sighting
            </button>
            <button style={styles.standDownButton}>
              ✕ False Alarm
            </button>
          </div>
        </div>
      )}

      {/* Quiet reminder */}
      <div style={styles.quietReminder}>
        <span style={styles.quietIcon}>🤫</span>
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
    backgroundColor: '#1A1A1A',
    zIndex: 9000,
    overflow: 'auto',
    padding: '16px',
  },

  header: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },

  alertBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#FF5722',
    borderRadius: '24px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    animation: 'pulse 1.5s infinite',
  },

  alertIcon: {
    fontSize: '20px',
  },

  petReminder: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#2A2A2A',
    borderRadius: '12px',
    marginBottom: '24px',
  },

  petPhoto: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #4CAF50',
  },

  petName: {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 4px 0',
    color: '#fff',
  },

  petDesc: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },

  instructions: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },

  instructionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 16px 0',
    color: '#fff',
  },

  positionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#2196F3',
    borderRadius: '12px',
    marginBottom: '16px',
  },

  positionIcon: {
    fontSize: '24px',
  },

  positionLabel: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
  },

  steps: {
    marginBottom: '20px',
  },

  step: {
    fontSize: '16px',
    color: '#fff',
    margin: '12px 0',
    paddingLeft: '8px',
    borderLeft: '3px solid #4CAF50',
  },

  arriveButton: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  holdingMessage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: '12px',
    color: '#4CAF50',
    fontSize: '18px',
    fontWeight: 600,
  },

  holdingIcon: {
    fontSize: '24px',
  },

  waitingMessage: {
    textAlign: 'center',
    color: '#888',
    fontSize: '16px',
  },

  subText: {
    fontSize: '14px',
    marginTop: '8px',
  },

  leaderView: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },

  perimeterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '20px',
  },

  perimeterPosition: {
    padding: '12px 8px',
    borderRadius: '8px',
    textAlign: 'center',
  },

  positionName: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
  },

  positionStatus: {
    display: 'block',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '4px',
  },

  leaderActions: {
    display: 'flex',
    gap: '12px',
  },

  verifyButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  standDownButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#666',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  quietReminder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: '12px',
    color: '#FF9800',
    fontSize: '14px',
  },

  quietIcon: {
    fontSize: '20px',
  },
};
