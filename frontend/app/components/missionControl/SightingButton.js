'use client';

/**
 * Sighting Button - The Critical UI Element
 *
 * Design:
 * - HUGE button (88px minimum)
 * - Accessible but prevents accidents
 * - Initiates FREEZE protocol on press
 * - High contrast, works in sunlight
 */

import { useState, useRef } from 'react';
import { TOUCH_TARGETS, triggerHaptic, announce } from '@/app/lib/missionControl/accessibility';
import { useToast } from '@/app/components/ui/Toast';

export default function SightingButton({
  missionId,
  volunteerId,
  location,
  petName,
  onSightingReported,
}) {
  const toast = useToast();
  const [stage, setStage] = useState('READY'); // READY, CONFIRM, REPORTING, FREEZE
  const [confidence, setConfidence] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef(null);
  const progressInterval = useRef(null);

  // Long press to activate (prevents accidents)
  const handlePressStart = () => {
    triggerHaptic('tap');

    // Start progress animation
    let progress = 0;
    progressInterval.current = setInterval(() => {
      progress += 5;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(progressInterval.current);
      }
    }, 50);

    // Trigger after 1 second hold
    holdTimer.current = setTimeout(() => {
      triggerHaptic('sighting');
      setStage('CONFIRM');
      announce('Sighting confirmation. Select confidence level.', 'assertive');
    }, 1000);
  };

  const handlePressEnd = () => {
    clearTimeout(holdTimer.current);
    clearInterval(progressInterval.current);
    setHoldProgress(0);
  };

  const selectConfidence = (level) => {
    setConfidence(level);
    triggerHaptic('warning');
    setStage('FREEZE');
    reportSighting(level);
  };

  const reportSighting = async (level) => {
    announce(
      level === 'CONFIRMED'
        ? 'FREEZE! Stay completely still. Do not approach. Help is coming.'
        : 'Sighting reported. Hold position if possible.',
      'assertive'
    );

    try {
      const res = await fetch(`/api/mission/${missionId}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPORT',
          volunteerId,
          location,
          confidence: level,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStage('FREEZE');
        onSightingReported?.();
      }
    } catch (err) {
      console.error('Sighting report error:', err);
      toast.error('Failed to report sighting. Please try again.');
    }
  };

  const cancel = () => {
    setStage('READY');
    setConfidence(null);
    setHoldProgress(0);
  };

  // FREEZE stage - full screen takeover
  if (stage === 'FREEZE') {
    return (
      <div style={styles.freezeOverlay} role="alert" aria-live="assertive">
        <div style={styles.freezeIcon} aria-hidden="true">🛑</div>
        <h1 style={styles.freezeTitle}>FREEZE</h1>
        <div style={styles.freezeInstructions}>
          <p style={styles.freezeStep}>Do NOT move</p>
          <p style={styles.freezeStep}>Do NOT approach {petName}</p>
          <p style={styles.freezeStep}>Do NOT make eye contact</p>
          <p style={styles.freezeStep}>Stay very quiet</p>
        </div>
        <div style={styles.freezeStatus}>
          <div style={styles.pulseRing} aria-hidden="true" />
          <p style={styles.freezeStatusText}>Notifying team...</p>
        </div>
        <p style={styles.freezeHelp}>Help is on the way. Stay calm.</p>
      </div>
    );
  }

  // Confirmation stage - select confidence
  if (stage === 'CONFIRM') {
    return (
      <div style={styles.confirmContainer} role="dialog" aria-label="Confirm sighting">
        <h2 style={styles.confirmTitle}>I see {petName}!</h2>
        <p style={styles.confirmSubtitle}>How sure are you?</p>

        <div style={styles.confidenceGrid}>
          <button
            onClick={() => selectConfidence('CONFIRMED')}
            style={styles.confirmedButton}
            aria-label={`Confirmed - I am with ${petName}`}
          >
            <span style={styles.confidenceIcon}>✓</span>
            <span style={styles.confidenceLabel}>CONFIRMED</span>
            <span style={styles.confidenceDesc}>I'm with them</span>
          </button>

          <button
            onClick={() => selectConfidence('HIGH')}
            style={styles.highButton}
            aria-label="High confidence - Pretty sure this is them"
          >
            <span style={styles.confidenceIcon}>👁</span>
            <span style={styles.confidenceLabel}>Pretty Sure</span>
            <span style={styles.confidenceDesc}>Looks like them</span>
          </button>

          <button
            onClick={() => selectConfidence('MEDIUM')}
            style={styles.mediumButton}
            aria-label="Maybe - Could be them"
          >
            <span style={styles.confidenceIcon}>❓</span>
            <span style={styles.confidenceLabel}>Maybe</span>
            <span style={styles.confidenceDesc}>Could be them</span>
          </button>
        </div>

        <button onClick={cancel} style={styles.cancelButton}>
          Cancel
        </button>
      </div>
    );
  }

  // Ready stage - the big button
  return (
    <div style={styles.buttonContainer}>
      <button
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        style={styles.sightingButton}
        aria-label={`Report sighting of ${petName}. Hold for 1 second to activate.`}
      >
        {/* Progress ring */}
        <svg style={styles.progressRing} viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#333"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#FF5252"
            strokeWidth="4"
            strokeDasharray={`${holdProgress * 2.83} 283`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>

        <div style={styles.buttonContent}>
          <span style={styles.buttonIcon} aria-hidden="true">👁</span>
          <span style={styles.buttonText}>I SEE THEM</span>
          <span style={styles.buttonHint}>Hold to report</span>
        </div>
      </button>
    </div>
  );
}

const styles = {
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 0',
  },

  sightingButton: {
    position: 'relative',
    width: TOUCH_TARGETS.xlarge * 2,
    height: TOUCH_TARGETS.xlarge * 2,
    borderRadius: '50%',
    backgroundColor: '#D32F2F',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(211, 47, 47, 0.4)',
  },

  progressRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },

  buttonContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },

  buttonIcon: {
    fontSize: '40px',
    marginBottom: '4px',
  },

  buttonText: {
    fontSize: '18px',
    fontWeight: 700,
  },

  buttonHint: {
    fontSize: '12px',
    opacity: 0.8,
    marginTop: '4px',
  },

  // Confirmation stage
  confirmContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
  },

  confirmTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  confirmSubtitle: {
    fontSize: '16px',
    color: '#888',
    margin: '0 0 24px 0',
  },

  confidenceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  confirmedButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  highButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  mediumButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  confidenceIcon: {
    fontSize: '28px',
    marginBottom: '4px',
  },

  confidenceLabel: {
    fontSize: '16px',
    fontWeight: 600,
  },

  confidenceDesc: {
    fontSize: '13px',
    opacity: 0.9,
  },

  cancelButton: {
    marginTop: '16px',
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  // Freeze stage
  freezeOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#B71C1C',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 9999,
  },

  freezeIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },

  freezeTitle: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 24px 0',
    letterSpacing: '4px',
  },

  freezeInstructions: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
  },

  freezeStep: {
    fontSize: '18px',
    color: '#fff',
    margin: '12px 0',
    fontWeight: 500,
  },

  freezeStatus: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },

  pulseRing: {
    width: '60px',
    height: '60px',
    border: '4px solid #fff',
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  freezeStatusText: {
    fontSize: '16px',
    color: '#fff',
    marginTop: '16px',
  },

  freezeHelp: {
    fontSize: '20px',
    color: '#fff',
    fontWeight: 600,
  },
};
