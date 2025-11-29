'use client';

/**
 * ActionBar - Bottom Action Bar with "God Button"
 *
 * Always visible. Contains:
 * - The massive "I SEE ONE" sighting button (accessible from anywhere)
 * - Check In/Out toggle
 * - Alert broadcast (leaders only)
 */

import { useState } from 'react';
import { useSquad, VIEW_MODES, ALERT_LEVELS } from '../context/SquadContext';

export default function ActionBar() {
  const {
    squad,
    userRole,
    viewMode,
    selectedCase,
    isCheckedIn,
    alertLevel,
    checkIn,
    checkOut,
    triggerContainment,
  } = useSquad();

  const [sightingPressed, setSightingPressed] = useState(false);
  const [sightingProgress, setSightingProgress] = useState(0);
  const [showSightingConfirm, setShowSightingConfirm] = useState(false);

  const isLeader = ['FOUNDER', 'LEADER'].includes(userRole);

  // Long press to activate sighting (prevents accidents)
  let pressTimer = null;
  let progressInterval = null;

  const handleSightingPressStart = () => {
    setSightingPressed(true);
    let progress = 0;

    progressInterval = setInterval(() => {
      progress += 5;
      setSightingProgress(progress);
      if (progress >= 100) {
        clearInterval(progressInterval);
        handleSightingActivate();
      }
    }, 50);

    pressTimer = setTimeout(() => {
      // Haptic feedback would go here
    }, 100);
  };

  const handleSightingPressEnd = () => {
    setSightingPressed(false);
    setSightingProgress(0);
    clearTimeout(pressTimer);
    clearInterval(progressInterval);
  };

  const handleSightingActivate = () => {
    setSightingPressed(false);
    setSightingProgress(0);
    setShowSightingConfirm(true);
  };

  const confirmSighting = async (confidence) => {
    setShowSightingConfirm(false);

    // Trigger containment mode
    triggerContainment({
      confidence,
      timestamp: new Date().toISOString(),
      caseId: selectedCase?.id,
    });

    // TODO: API call to report sighting
    try {
      if (selectedCase?.id) {
        await fetch(`/api/mission/${selectedCase.id}/sighting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'REPORT',
            confidence,
            // location would come from geolocation
          }),
        });
      }
    } catch (err) {
      console.error('Sighting report error:', err);
    }
  };

  const handleCheckIn = async () => {
    if (isCheckedIn) {
      checkOut();
      // TODO: API call
    } else {
      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            checkIn({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            // TODO: API call
          },
          (error) => {
            console.error('Geolocation error:', error);
            checkIn(null);
          }
        );
      } else {
        checkIn(null);
      }
    }
  };

  // Sighting confirmation modal
  if (showSightingConfirm) {
    return (
      <div style={styles.confirmOverlay}>
        <div style={styles.confirmModal}>
          <h2 style={styles.confirmTitle}>
            {selectedCase ? `I see ${selectedCase.petName}!` : 'I see a lost pet!'}
          </h2>
          <p style={styles.confirmSubtitle}>How sure are you?</p>

          <div style={styles.confidenceButtons}>
            <button
              onClick={() => confirmSighting('CONFIRMED')}
              style={styles.confirmedBtn}
            >
              <span style={styles.confidenceIcon}>✓</span>
              <span style={styles.confidenceLabel}>CONFIRMED</span>
              <span style={styles.confidenceDesc}>I'm with them right now</span>
            </button>

            <button
              onClick={() => confirmSighting('HIGH')}
              style={styles.highBtn}
            >
              <span style={styles.confidenceIcon}>👁</span>
              <span style={styles.confidenceLabel}>Pretty Sure</span>
              <span style={styles.confidenceDesc}>Looks like the photo</span>
            </button>

            <button
              onClick={() => confirmSighting('MAYBE')}
              style={styles.maybeBtn}
            >
              <span style={styles.confidenceIcon}>❓</span>
              <span style={styles.confidenceLabel}>Maybe</span>
              <span style={styles.confidenceDesc}>Could be them</span>
            </button>
          </div>

          <button
            onClick={() => setShowSightingConfirm(false)}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Left: Check In/Out */}
      <button
        onClick={handleCheckIn}
        style={{
          ...styles.actionButton,
          background: isCheckedIn
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            : '#334155',
        }}
      >
        <span style={styles.actionIcon}>{isCheckedIn ? '✓' : '📍'}</span>
        <span style={styles.actionLabel}>
          {isCheckedIn ? 'Active' : 'Check In'}
        </span>
      </button>

      {/* Center: THE GOD BUTTON */}
      <button
        onTouchStart={handleSightingPressStart}
        onTouchEnd={handleSightingPressEnd}
        onMouseDown={handleSightingPressStart}
        onMouseUp={handleSightingPressEnd}
        onMouseLeave={handleSightingPressEnd}
        style={styles.sightingButton}
      >
        {/* Progress ring */}
        <svg style={styles.progressRing} viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#333"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#ef4444"
            strokeWidth="4"
            strokeDasharray={`${sightingProgress * 2.89} 289`}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }}
          />
        </svg>

        <div style={styles.sightingContent}>
          <span style={styles.sightingIcon}>👁</span>
          <span style={styles.sightingText}>I SEE ONE</span>
          <span style={styles.sightingHint}>Hold to report</span>
        </div>
      </button>

      {/* Right: Alert (leaders) or Help */}
      {isLeader ? (
        <button style={{
          ...styles.actionButton,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        }}>
          <span style={styles.actionIcon}>📢</span>
          <span style={styles.actionLabel}>Alert</span>
        </button>
      ) : (
        <button style={styles.actionButton}>
          <span style={styles.actionIcon}>🆘</span>
          <span style={styles.actionLabel}>Help</span>
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80px',
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 16px',
    zIndex: 100,
  },

  actionButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '70px',
    height: '56px',
    background: '#334155',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  actionIcon: {
    fontSize: '20px',
    marginBottom: '2px',
  },

  actionLabel: {
    color: '#fff',
    fontSize: '11px',
    fontWeight: '600',
  },

  // God Button
  sightingButton: {
    position: 'relative',
    width: '88px',
    height: '88px',
    marginTop: '-30px',
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    border: '4px solid #0f172a',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)',
    transition: 'transform 0.1s',
  },

  progressRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },

  sightingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },

  sightingIcon: {
    fontSize: '24px',
    marginBottom: '2px',
  },

  sightingText: {
    color: '#fff',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.5px',
  },

  sightingHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '8px',
    marginTop: '2px',
  },

  // Confirmation Modal
  confirmOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },

  confirmModal: {
    background: '#1e293b',
    borderRadius: '20px',
    padding: '24px',
    width: '100%',
    maxWidth: '360px',
    textAlign: 'center',
  },

  confirmTitle: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '800',
    margin: '0 0 8px 0',
  },

  confirmSubtitle: {
    color: '#94a3b8',
    fontSize: '16px',
    margin: '0 0 24px 0',
  },

  confidenceButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  confirmedBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },

  highBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },

  maybeBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },

  confidenceIcon: {
    fontSize: '28px',
    marginBottom: '4px',
  },

  confidenceLabel: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
  },

  confidenceDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '12px',
    marginTop: '2px',
  },

  cancelBtn: {
    marginTop: '16px',
    padding: '14px 24px',
    background: 'transparent',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
