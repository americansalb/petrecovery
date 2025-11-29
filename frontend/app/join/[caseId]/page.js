'use client';

/**
 * Zero-Friction Volunteer Join Page
 *
 * Opened via SMS/share link. No account required.
 * Gets you into the search in under 30 seconds.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TOUCH_TARGETS, triggerHaptic, announce } from '@/app/lib/missionControl/accessibility';

export default function JoinMissionPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId;

  const [stage, setStage] = useState('LOADING'); // LOADING, INFO, NAME, LOCATION, READY, JOINING, ACTIVE
  const [mission, setMission] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  // Generate or retrieve device ID
  useEffect(() => {
    let id = localStorage.getItem('petrecovery_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('petrecovery_device_id', id);
    }
    setDeviceId(id);

    // Check if already in a mission
    const existingVolunteerId = localStorage.getItem(`mission_${caseId}_volunteer`);
    if (existingVolunteerId) {
      setVolunteerId(existingVolunteerId);
      setStage('ACTIVE');
    }
  }, [caseId]);

  // Fetch mission info
  useEffect(() => {
    if (stage === 'LOADING') {
      fetchMissionInfo();
    }
  }, [stage, caseId]);

  const fetchMissionInfo = async () => {
    try {
      const res = await fetch(`/api/mission/${caseId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('NO_MISSION');
        } else {
          setError('FETCH_ERROR');
        }
        return;
      }

      const data = await res.json();
      setMission(data);

      if (data.mode === 'INACTIVE' || data.mode === 'RESOLVED' || data.mode === 'CLOSED') {
        setError('NOT_ACTIVE');
      } else {
        setStage('INFO');
      }
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError('FETCH_ERROR');
    }
  };

  const requestLocation = () => {
    setStage('LOCATION');

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setLocationError(null);
        setStage('READY');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError('Could not get location. Please enable location services.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleJoin = async () => {
    if (!location) {
      setLocationError('Location required to join');
      return;
    }

    setStage('JOINING');
    triggerHaptic('tap');

    try {
      const res = await fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN',
          deviceId,
          location,
          name: name.trim() || 'Anonymous Helper',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setVolunteerId(data.volunteerId);
        localStorage.setItem(`mission_${caseId}_volunteer`, data.volunteerId);
        triggerHaptic('success');
        announce('You have joined the search. Thank you!', 'polite');
        setStage('ACTIVE');
      } else {
        setError('JOIN_FAILED');
        setStage('READY');
      }
    } catch (err) {
      console.error('Join error:', err);
      setError('JOIN_FAILED');
      setStage('READY');
    }
  };

  // Go to full mission control
  const goToMission = () => {
    router.push(`/cases/${caseId}?volunteer=${volunteerId}`);
  };

  // Error states
  if (error === 'NO_MISSION') {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>🔍</span>
          <h1 style={styles.errorTitle}>No Active Search</h1>
          <p style={styles.errorText}>
            This search isn't active right now. The pet may have been found already!
          </p>
          <a href={`/cases/${caseId}`} style={styles.linkButton}>
            View Case Details
          </a>
        </div>
      </div>
    );
  }

  if (error === 'NOT_ACTIVE') {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <span style={styles.successIcon}>🎉</span>
          <h1 style={styles.successTitle}>Good News!</h1>
          <p style={styles.successText}>
            This search has ended. The pet may have been found!
          </p>
          <a href={`/cases/${caseId}`} style={styles.linkButton}>
            View Case Details
          </a>
        </div>
      </div>
    );
  }

  if (error === 'FETCH_ERROR') {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>⚠️</span>
          <h1 style={styles.errorTitle}>Connection Error</h1>
          <p style={styles.errorText}>
            Couldn't load search details. Please check your connection.
          </p>
          <button onClick={() => { setError(null); setStage('LOADING'); }} style={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (stage === 'LOADING') {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading search details...</p>
        </div>
      </div>
    );
  }

  // Already active as volunteer
  if (stage === 'ACTIVE') {
    return (
      <div style={styles.container}>
        <div style={styles.activeCard}>
          <span style={styles.activeIcon}>✓</span>
          <h1 style={styles.activeTitle}>You're In!</h1>
          <p style={styles.activeText}>
            You're part of the search team.
          </p>
          <button onClick={goToMission} style={styles.goButton}>
            Open Mission Control
          </button>
        </div>
      </div>
    );
  }

  // Info stage - show pet and mission details
  if (stage === 'INFO') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.liveBadge}>
            <span style={styles.liveIcon}>●</span>
            LIVE SEARCH
          </div>
        </div>

        <div style={styles.petCard}>
          {mission.pet?.photoUrl && (
            <img
              src={mission.pet.photoUrl}
              alt={mission.pet.name}
              style={styles.petPhoto}
            />
          )}
          <div style={styles.petInfo}>
            <h1 style={styles.petName}>{mission.pet?.name || 'Lost Pet'}</h1>
            <p style={styles.petDesc}>
              {mission.pet?.color} {mission.pet?.species}
              {mission.pet?.breed && ` • ${mission.pet.breed}`}
            </p>
          </div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <span style={styles.statNumber}>{mission.stats?.activeVolunteers || 0}</span>
            <span style={styles.statLabel}>Searching</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statNumber}>{mission.stats?.zonesSearched || 0}</span>
            <span style={styles.statLabel}>Areas Done</span>
          </div>
        </div>

        <div style={styles.infoBox}>
          <h2 style={styles.infoTitle}>How You Can Help</h2>
          <ul style={styles.infoList}>
            <li>Walk assigned areas and look for {mission.pet?.name || 'the pet'}</li>
            <li>Report any sightings immediately</li>
            <li>No experience needed - we'll guide you</li>
          </ul>
        </div>

        <button onClick={() => setStage('NAME')} style={styles.joinButton}>
          Join The Search
        </button>

        <p style={styles.disclaimer}>
          No account required. Your location is only shared during the search.
        </p>
      </div>
    );
  }

  // Name stage - optional name entry
  if (stage === 'NAME') {
    return (
      <div style={styles.container}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>1/2</span>
          <h1 style={styles.stepTitle}>What's your name?</h1>
          <p style={styles.stepSubtitle}>So team leaders can coordinate</p>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name (optional)"
          style={styles.nameInput}
          autoFocus
        />

        <button onClick={requestLocation} style={styles.continueButton}>
          {name.trim() ? 'Continue' : 'Skip - Stay Anonymous'}
        </button>
      </div>
    );
  }

  // Location stage - getting GPS
  if (stage === 'LOCATION') {
    return (
      <div style={styles.container}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>2/2</span>
          <h1 style={styles.stepTitle}>Getting your location...</h1>
          <p style={styles.stepSubtitle}>So we can assign you a search area</p>
        </div>

        {!locationError ? (
          <div style={styles.locationLoading}>
            <div style={styles.locationSpinner} />
            <p>Acquiring GPS...</p>
          </div>
        ) : (
          <div style={styles.locationError}>
            <span style={styles.errorIcon}>📍</span>
            <p>{locationError}</p>
            <button onClick={requestLocation} style={styles.retryButton}>
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // Ready stage - confirm join
  if (stage === 'READY') {
    return (
      <div style={styles.container}>
        <div style={styles.readyCard}>
          <span style={styles.readyIcon}>📍</span>
          <h1 style={styles.readyTitle}>Ready to Join!</h1>
          <p style={styles.readyText}>
            {name.trim() ? `${name.trim()}, you're` : "You're"} about to join the search for{' '}
            <strong>{mission?.pet?.name || 'the lost pet'}</strong>.
          </p>
        </div>

        <div style={styles.commitmentBox}>
          <h3 style={styles.commitmentTitle}>Quick Guidelines:</h3>
          <ul style={styles.commitmentList}>
            <li>Stay in assigned areas</li>
            <li>If you see the pet, DON'T chase - freeze and report</li>
            <li>You can leave anytime by tapping "Check Out"</li>
          </ul>
        </div>

        <button
          onClick={handleJoin}
          style={styles.finalJoinButton}
          disabled={stage === 'JOINING'}
        >
          {stage === 'JOINING' ? 'Joining...' : "I'm Ready - Start Searching"}
        </button>
      </div>
    );
  }

  // Joining stage
  if (stage === 'JOINING') {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Joining the search...</p>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },

  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#D32F2F',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 600,
  },

  liveIcon: {
    animation: 'pulse 1s infinite',
  },

  petCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#1E1E1E',
    borderRadius: '16px',
    marginBottom: '20px',
  },

  petPhoto: {
    width: '80px',
    height: '80px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '3px solid #4CAF50',
  },

  petInfo: {
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
    margin: 0,
  },

  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },

  stat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
  },

  statNumber: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#4CAF50',
  },

  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
  },

  infoBox: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },

  infoTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },

  infoList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
    color: '#ccc',
    lineHeight: 1.8,
  },

  joinButton: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
    marginBottom: '16px',
  },

  disclaimer: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#666',
    margin: 0,
  },

  // Step screens
  stepHeader: {
    textAlign: 'center',
    marginBottom: '32px',
    marginTop: '40px',
  },

  stepNumber: {
    fontSize: '14px',
    color: '#888',
  },

  stepTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '8px 0',
  },

  stepSubtitle: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },

  nameInput: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#1E1E1E',
    border: '2px solid #333',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    textAlign: 'center',
    marginBottom: '24px',
  },

  continueButton: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  locationLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    color: '#888',
  },

  locationSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #333',
    borderTop: '4px solid #2196F3',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  locationError: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center',
    color: '#FF5252',
  },

  // Ready screen
  readyCard: {
    textAlign: 'center',
    marginBottom: '24px',
    marginTop: '20px',
  },

  readyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  readyTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  readyText: {
    fontSize: '16px',
    color: '#ccc',
    margin: 0,
  },

  commitmentBox: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },

  commitmentTitle: {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 12px 0',
    color: '#888',
  },

  commitmentList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
    color: '#ccc',
    lineHeight: 1.8,
  },

  finalJoinButton: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },

  // Active state
  activeCard: {
    textAlign: 'center',
    marginTop: '60px',
  },

  activeIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
    fontSize: '40px',
    margin: '0 auto 24px',
  },

  activeTitle: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  activeText: {
    fontSize: '16px',
    color: '#888',
    margin: '0 0 32px 0',
  },

  goButton: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  // Error states
  errorCard: {
    textAlign: 'center',
    marginTop: '60px',
  },

  errorIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  errorTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 8px 0',
  },

  errorText: {
    fontSize: '16px',
    color: '#888',
    margin: '0 0 24px 0',
  },

  successCard: {
    textAlign: 'center',
    marginTop: '60px',
  },

  successIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },

  successTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    color: '#4CAF50',
  },

  successText: {
    fontSize: '16px',
    color: '#888',
    margin: '0 0 24px 0',
  },

  linkButton: {
    display: 'inline-block',
    padding: '14px 28px',
    backgroundColor: '#2196F3',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    textDecoration: 'none',
  },

  retryButton: {
    padding: '14px 28px',
    backgroundColor: '#333',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  // Loading
  loadingCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '16px',
  },

  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #333',
    borderTop: '4px solid #4CAF50',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    fontSize: '16px',
    color: '#888',
  },
};
