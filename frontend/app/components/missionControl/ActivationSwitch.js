'use client';

/**
 * Activation Switch
 *
 * The visual transition from static case page to live operation.
 * Only owner or force leaders can activate.
 */

import { useState } from 'react';
import { TOUCH_TARGETS, triggerHaptic } from '@/app/lib/missionControl/accessibility';

export default function ActivationSwitch({ missionId, mission, userRole, onActivated }) {
  const [activating, setActivating] = useState(false);
  const [radius, setRadius] = useState(1.0);

  const canActivate = ['OWNER', 'LEADER', 'ADMIN'].includes(userRole);

  const handleActivate = async () => {
    if (!canActivate || activating) return;

    setActivating(true);
    triggerHaptic('warning');

    try {
      const res = await fetch(`/api/mission/${missionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACTIVATE',
          radiusMiles: radius,
        }),
      });

      const data = await res.json();

      if (data.success) {
        triggerHaptic('success');
        onActivated?.();
      } else {
        alert(data.error || 'Failed to activate');
      }
    } catch (err) {
      console.error('Activation error:', err);
      alert('Failed to activate mission');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Case info summary */}
      <div style={styles.caseInfo}>
        {mission.pet.photoUrl && (
          <img
            src={mission.pet.photoUrl}
            alt={`Photo of ${mission.pet.name}`}
            style={styles.petPhoto}
          />
        )}
        <div style={styles.petDetails}>
          <h1 style={styles.petName}>{mission.pet.name}</h1>
          <p style={styles.petDesc}>
            {mission.pet.color} {mission.pet.species}
            {mission.pet.breed && ` • ${mission.pet.breed}`}
          </p>
          {mission.lastSeen.address && (
            <p style={styles.location}>Last seen: {mission.lastSeen.address}</p>
          )}
        </div>
      </div>

      {/* Activation section */}
      <div style={styles.activationSection}>
        <h2 style={styles.sectionTitle}>Start Live Search</h2>
        <p style={styles.description}>
          Activate Mission Control to coordinate volunteers in real-time.
          Nearby force members will be notified.
        </p>

        {/* Radius selector */}
        <div style={styles.radiusSelector}>
          <label style={styles.radiusLabel}>Search Radius</label>
          <div style={styles.radiusButtons}>
            {[0.5, 1.0, 1.5, 2.0].map(r => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                style={{
                  ...styles.radiusButton,
                  ...(radius === r ? styles.radiusButtonActive : {}),
                }}
              >
                {r} mi
              </button>
            ))}
          </div>
        </div>

        {canActivate ? (
          <button
            onClick={handleActivate}
            disabled={activating}
            style={styles.activateButton}
            aria-busy={activating}
          >
            {activating ? (
              <>
                <span style={styles.spinner} aria-hidden="true" />
                Activating...
              </>
            ) : (
              <>
                <span style={styles.liveIcon} aria-hidden="true">●</span>
                GO LIVE
              </>
            )}
          </button>
        ) : (
          <p style={styles.cannotActivate}>
            Only the pet owner or force leaders can activate live search.
          </p>
        )}
      </div>

      {/* What happens section */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>What happens when you go live?</h3>
        <ul style={styles.infoList}>
          <li>Nearby force members get notified</li>
          <li>A search grid is generated around last seen location</li>
          <li>Volunteers can join with one tap</li>
          <li>Real-time coordination begins</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    padding: '24px',
    color: '#fff',
  },

  caseInfo: {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
  },

  petPhoto: {
    width: '80px',
    height: '80px',
    borderRadius: '12px',
    objectFit: 'cover',
  },

  petDetails: {
    flex: 1,
  },

  petName: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 4px 0',
  },

  petDesc: {
    fontSize: '14px',
    color: '#888',
    margin: '0 0 8px 0',
  },

  location: {
    fontSize: '13px',
    color: '#2196F3',
    margin: 0,
  },

  activationSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  },

  sectionTitle: {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  description: {
    fontSize: '14px',
    color: '#888',
    margin: '0 0 24px 0',
  },

  radiusSelector: {
    marginBottom: '24px',
  },

  radiusLabel: {
    display: 'block',
    fontSize: '14px',
    color: '#888',
    marginBottom: '8px',
  },

  radiusButtons: {
    display: 'flex',
    gap: '8px',
  },

  radiusButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  radiusButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },

  activateButton: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#D32F2F',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minHeight: TOUCH_TARGETS.large,
  },

  liveIcon: {
    color: '#fff',
    animation: 'pulse 1s infinite',
  },

  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  cannotActivate: {
    textAlign: 'center',
    color: '#888',
    fontSize: '14px',
    padding: '16px',
    backgroundColor: '#2A2A2A',
    borderRadius: '8px',
  },

  infoSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    padding: '20px',
  },

  infoTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },

  infoList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#888',
    fontSize: '14px',
    lineHeight: 1.8,
  },
};
