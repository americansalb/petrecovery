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
import { describePet } from '@/app/lib/species';

export default function JoinMissionPage() {
  const params = useParams();
  const router = useRouter();
  const missionId = params.missionId;

  const [stage, setStage] = useState('LOADING'); // LOADING, INFO, NAME, LOCATION, READY, JOINING, ACTIVE
  const [mission, setMission] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [sightingOpen, setSightingOpen] = useState(false);
  const [sightingNotes, setSightingNotes] = useState('');
  const [sightingStatus, setSightingStatus] = useState('idle'); // idle, sending, sent, failed
  const [sightingProtocol, setSightingProtocol] = useState(null);

  // Generate or retrieve device ID
  useEffect(() => {
    let id = localStorage.getItem('petrecovery_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('petrecovery_device_id', id);
    }
    setDeviceId(id);

    // Check if already in a mission
    const existingVolunteerId = localStorage.getItem(`mission_${missionId}_volunteer`);
    if (existingVolunteerId) {
      setVolunteerId(existingVolunteerId);
      setStage('ACTIVE');
    }
  }, [missionId]);

  // Fetch mission info
  useEffect(() => {
    if (stage === 'LOADING') {
      fetchMissionInfo();
    }
  }, [stage, missionId]);

  const fetchMissionInfo = async () => {
    try {
      // join-info is the anonymous-safe subset; the bare mission GET is
      // auth-gated (exact coords + live GPS) and 401s for guests, which
      // used to render this page as a Connection Error for every share link.
      const res = await fetch(`/api/mission/${missionId}/join-info`);
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

  // The waiver, fetched so the text is readable right here rather than
  // behind a link nobody follows on a phone at dusk.
  const [waiver, setWaiver] = useState(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverOpen, setWaiverOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/legal/documents/liability-waiver')
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => { if (!cancelled && doc) setWaiver(doc); })
      .catch(() => { /* the checkbox still gates joining */ });
    return () => { cancelled = true; };
  }, []);

  const handleJoin = async () => {
    if (!location) {
      setLocationError('Location required to join');
      return;
    }

    setStage('JOINING');
    triggerHaptic('tap');

    try {
      const res = await fetch(`/api/mission/${missionId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN',
          deviceId,
          location,
          name: name.trim() || 'Anonymous Helper',
          waiverAccepted,
          waiverVersion: waiver?.version || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setVolunteerId(data.volunteerId);
        localStorage.setItem(`mission_${missionId}_volunteer`, data.volunteerId);
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

  // Report a sighting as this volunteer. No account: the volunteerId from
  // the join IS the credential. Uses the location captured at join time;
  // otherwise asks the browser once, and still submits without one.
  const submitSighting = async () => {
    setSightingStatus('sending');
    let where = location;
    if (!where && typeof navigator !== 'undefined' && navigator.geolocation) {
      where = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 6000, maximumAge: 60000 }
        );
      });
    }
    try {
      const res = await fetch(`/api/mission/${missionId}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPORT',
          volunteerId,
          location: where,
          notes: sightingNotes.trim(),
          confidence: 'MEDIUM',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSightingStatus('sent');
        setSightingProtocol(data.protocol || null);
        triggerHaptic('success');
        announce('Sighting reported. Hold your position and keep watching.', 'assertive');
      } else {
        setSightingStatus('failed');
      }
    } catch (err) {
      console.error('Sighting report error:', err);
      setSightingStatus('failed');
    }
  };

  // Go to squad coordination page
  const goToMission = () => {
    // Try to redirect to squad page if available
    const squadId = mission?.case?.assignments?.[0]?.rescueSquad?.id;
    if (squadId) {
      router.push(`/rescue-forces/${squadId}?joined=true`);
    } else {
      // Fallback to case page if no squad
      router.push(`/cases/${mission?.case?.caseNumber || missionId}?volunteer=${volunteerId}`);
    }
  };

  // Error states
  if (error === 'NO_MISSION') {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>🔍</span>
          <h1 style={styles.errorTitle}>This link doesn't match a search</h1>
          <p style={styles.errorText}>
            Ask whoever sent it for a fresh link, or browse the reports near you.
          </p>
          <a href="/lost-and-found" style={styles.linkButton}>
            Browse lost &amp; found
          </a>
        </div>
      </div>
    );
  }

  if (error === 'NOT_ACTIVE') {
    // RESOLVED is a reunion; anything else closed without one. Only the
    // first deserves confetti.
    const reunited = mission?.mode === 'RESOLVED';
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <span style={styles.successIcon}>{reunited ? '🎉' : '🐾'}</span>
          <h1 style={reunited ? styles.successTitle : styles.errorTitle}>
            {reunited ? 'Good news' : 'This search has closed'}
          </h1>
          <p style={styles.successText}>
            {reunited
              ? `This search has ended - ${mission?.pet?.name || 'the pet'} may be home already.`
              : 'The owner closed this search. Thank you for wanting to help.'}
          </p>
          <a href={`/cases/${missionId}`} style={styles.linkButton}>
            View the case
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
    const petName = mission?.pet?.name || 'the pet';
    return (
      <div style={styles.container}>
        <div style={styles.activeCard}>
          <span style={styles.activeIcon}>✓</span>
          <h1 style={styles.activeTitle}>You're in</h1>
          <p style={styles.activeText}>
            You're part of the search team. If you spot {petName}, report it
            here - it reaches everyone searching right away.
          </p>

          {sightingStatus === 'sent' ? (
            <div style={styles.protocolCard}>
              <h2 style={styles.protocolTitle}>Sighting reported. Now:</h2>
              <ul style={styles.protocolList}>
                {(sightingProtocol?.instructions || [
                  'Stay where you are',
                  'Keep eyes on the pet if you can',
                  'Do not approach or call out',
                ]).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : sightingOpen ? (
            <div style={styles.sightingForm}>
              <textarea
                value={sightingNotes}
                onChange={(e) => setSightingNotes(e.target.value)}
                placeholder={`What did you see? Where is ${petName} headed?`}
                rows={3}
                style={styles.sightingTextarea}
                autoFocus
              />
              {sightingStatus === 'failed' && (
                <p style={styles.sightingError}>
                  That didn't send. Check your connection and try again.
                </p>
              )}
              <button
                onClick={submitSighting}
                disabled={sightingStatus === 'sending'}
                style={styles.sightingSubmit}
              >
                {sightingStatus === 'sending' ? 'Sending...' : 'Send sighting'}
              </button>
              <button
                onClick={() => setSightingOpen(false)}
                style={styles.sightingCancel}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setSightingOpen(true)} style={styles.sightingButton}>
              I see {petName} - report a sighting
            </button>
          )}

          <button onClick={goToMission} style={styles.goButton}>
            Open the search page →
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
            {/* Was `{color} {species}`, which printed the enum raw: "Golden
                DOG - Golden Retriever" on the page a stranger opens from a
                text message. */}
            <p style={styles.petDesc}>
              {describePet({
                species: mission.pet?.species,
                breed: mission.pet?.breed,
                color: mission.pet?.color,
              })}
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

        <div style={styles.waiverBox}>
          <label style={styles.waiverLabel}>
            <input
              type="checkbox"
              checked={waiverAccepted}
              onChange={(e) => setWaiverAccepted(e.target.checked)}
              style={styles.waiverCheckbox}
            />
            <span>
              I have read and accept the{' '}
              <button
                type="button"
                onClick={() => setWaiverOpen((open) => !open)}
                style={styles.waiverToggle}
              >
                Liability Waiver
              </button>
              {waiver?.version ? ` (v${waiver.version})` : ''}. I am searching
              voluntarily and at my own risk.
            </span>
          </label>

          {waiverOpen && (
            <div style={styles.waiverText}>
              {waiver?.content || 'Loading the waiver...'}
            </div>
          )}
        </div>

        <button
          onClick={handleJoin}
          style={{
            ...styles.finalJoinButton,
            ...(waiverAccepted ? {} : styles.finalJoinButtonDisabled),
          }}
          disabled={stage === 'JOINING' || !waiverAccepted}
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
    backgroundColor: '#020617',
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
    border: '3px solid #facc15',
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
    color: '#facc15',
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
    backgroundColor: '#facc15',
    border: 'none',
    borderRadius: '12px',
    color: '#020617',
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
    backgroundColor: '#facc15',
    border: 'none',
    borderRadius: '12px',
    color: '#020617',
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
    borderTop: '4px solid #facc15',
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
    backgroundColor: '#facc15',
    border: 'none',
    borderRadius: '12px',
    color: '#020617',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
  },
  finalJoinButtonDisabled: {
    backgroundColor: '#3b3a2a',
    color: 'rgba(255,255,255,0.65)',
    cursor: 'not-allowed',
  },
  waiverBox: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '14px',
  },
  waiverLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#e7ebf1',
    cursor: 'pointer',
  },
  waiverCheckbox: {
    width: '22px',
    height: '22px',
    marginTop: '1px',
    flexShrink: 0,
    accentColor: '#facc15',
    cursor: 'pointer',
  },
  waiverToggle: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#facc15',
    fontSize: '14px',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  waiverText: {
    marginTop: '12px',
    maxHeight: '240px',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.25)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '12.5px',
    lineHeight: 1.6,
    color: '#c8d0da',
    whiteSpace: 'pre-wrap',
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
    backgroundColor: '#facc15',
    color: '#020617',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '12px',
    color: '#e2e8f0',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  // Sighting reporting from the joined state
  sightingButton: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#facc15',
    border: 'none',
    borderRadius: '12px',
    color: '#020617',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.large,
    marginBottom: '12px',
  },

  sightingForm: {
    textAlign: 'left',
    marginBottom: '12px',
  },

  sightingTextarea: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#0f172a',
    border: '2px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    resize: 'vertical',
    marginBottom: '10px',
    boxSizing: 'border-box',
  },

  sightingSubmit: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#facc15',
    border: 'none',
    borderRadius: '12px',
    color: '#020617',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
    marginBottom: '8px',
  },

  sightingCancel: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
  },

  sightingError: {
    color: '#fca5a5',
    fontSize: '14px',
    margin: '0 0 10px 0',
  },

  protocolCard: {
    textAlign: 'left',
    backgroundColor: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.35)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  },

  protocolTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: '0 0 10px 0',
    color: '#facc15',
  },

  protocolList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14.5px',
    color: '#e2e8f0',
    lineHeight: 1.8,
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
    backgroundColor: '#facc15',
    borderRadius: '8px',
    color: '#020617',
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
    borderTop: '4px solid #facc15',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  loadingText: {
    fontSize: '16px',
    color: '#888',
  },
};
