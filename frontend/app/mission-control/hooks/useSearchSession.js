'use client';

/**
 * useSearchSession - GPS Search Session Management Hook
 *
 * Handles all GPS search functionality:
 * - Start/end search sessions
 * - Location pings with validation
 * - Real-time stats (distance, time, points)
 * - Proximity and speed validation
 * - Grid cell tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const CONFIG = {
  PING_INTERVAL_MS: 15000, // 15 seconds between pings
  MAX_WALKING_SPEED_MPH: 5, // Above this = driving
  MIN_MOVEMENT_SPEED_MPH: 0.05, // Below this = stationary
  SEARCH_RADIUS_MILES: 2, // Default search zone radius
  MIN_SESSION_MINUTES: 5,
  MIN_SESSION_MILES: 0.1,
  POINTS_PER_MILE: 100,
  GRID_CELL_SIZE_METERS: 100,
  PING_RETRY_ATTEMPTS: 3,
  PING_RETRY_DELAY_MS: 2000,
};

// Geolocation error codes
const GEO_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

// Check if browser is online
function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine !== false;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get grid cell ID for a location
 */
function getGridCellId(lat, lng, baseLat, baseLng) {
  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos(baseLat * Math.PI / 180);

  const latOffset = Math.floor((lat - baseLat) * metersPerDegreeLat / CONFIG.GRID_CELL_SIZE_METERS);
  const lngOffset = Math.floor((lng - baseLng) * metersPerDegreeLng / CONFIG.GRID_CELL_SIZE_METERS);

  return `${latOffset}_${lngOffset}`;
}

/**
 * Determine transportation method based on average speed
 */
function getTransportMethod(avgSpeedMph) {
  if (avgSpeedMph < 0.5) return 'stationary';
  if (avgSpeedMph < 4) return 'walking';
  if (avgSpeedMph < 7) return 'jogging';
  if (avgSpeedMph < 15) return 'cycling';
  return 'driving';
}

/**
 * Get transportation method display info
 */
function getTransportInfo(method) {
  const info = {
    stationary: { label: 'Stationary', icon: '⏸️', color: 'text-slate-400', thorough: 'N/A' },
    walking: { label: 'Walking', icon: '🚶', color: 'text-green-400', thorough: 'Excellent' },
    jogging: { label: 'Jogging', icon: '🏃', color: 'text-amber-400', thorough: 'Good' },
    cycling: { label: 'Cycling', icon: '🚴', color: 'text-orange-400', thorough: 'Fair' },
    driving: { label: 'Driving', icon: '🚗', color: 'text-red-400', thorough: 'Low' },
  };
  return info[method] || info.stationary;
}

/**
 * Validate movement between two pings
 * Also detects GPS glitches (teleportation) when connection drops
 */
function validateMovement(prevPing, currentPing) {
  if (!prevPing) return { valid: true, distance: 0, speed: 0, isGpsGlitch: false };

  const timeDeltaHours = (currentPing.timestamp - prevPing.timestamp) / 3600000;
  const timeDeltaSeconds = (currentPing.timestamp - prevPing.timestamp) / 1000;

  if (timeDeltaHours <= 0) {
    return { valid: false, reason: 'INVALID_TIME', distance: 0, speed: 0, isGpsGlitch: false };
  }

  const distance = haversineDistance(
    prevPing.latitude,
    prevPing.longitude,
    currentPing.latitude,
    currentPing.longitude
  );

  const speed = distance / timeDeltaHours;

  // GPS glitch detection: If moved > 0.2 miles in < 30 seconds, it's a GPS jump
  // (0.2 miles in 30 seconds = 24 mph, impossible for walking)
  if (distance > 0.2 && timeDeltaSeconds < 30) {
    return { valid: false, reason: 'GPS_GLITCH', distance, speed, isGpsGlitch: true };
  }

  // Also check for poor GPS accuracy (> 100 meters = unreliable)
  if (currentPing.accuracy && currentPing.accuracy > 100) {
    return { valid: false, reason: 'LOW_ACCURACY', distance, speed, isGpsGlitch: true };
  }

  if (speed > CONFIG.MAX_WALKING_SPEED_MPH) {
    return { valid: false, reason: 'DRIVING', distance, speed, isGpsGlitch: false };
  }

  if (speed < CONFIG.MIN_MOVEMENT_SPEED_MPH && distance < 0.001) {
    return { valid: false, reason: 'STATIONARY', distance: 0, speed: 0, isGpsGlitch: false };
  }

  return { valid: true, distance, speed, isGpsGlitch: false };
}

export default function useSearchSession(missionId, lastSeenLocation) {
  // Session state
  const [session, setSession] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState(null);

  // Track which mission this session belongs to
  const currentMissionIdRef = useRef(missionId);

  // Stats
  const [stats, setStats] = useState({
    durationSeconds: 0,
    totalDistanceMiles: 0,
    validatedDistanceMiles: 0,
    estimatedPoints: 0,
    gridCellsCovered: 0,
    // Rolling speed tracking (last 30 seconds)
    recentSpeeds: [], // Array of { speed, timestamp }
    avgSpeed30s: 0, // Average speed over last 30 seconds (mph)
    transportMethod: 'stationary', // 'stationary', 'walking', 'jogging', 'cycling', 'driving'
  });

  // Path for visualization
  const [path, setPath] = useState([]);

  // Validation state
  const [validation, setValidation] = useState({
    inZone: true,
    validSpeed: true,
    distanceFromZone: 0,
    currentSpeed: 0,
    lastWarning: null,
  });

  // Refs for intervals
  const pingIntervalRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const lastPingRef = useRef(null);
  const visitedCellsRef = useRef(new Set());
  const watchIdRef = useRef(null);

  // Helper to reset all state
  const resetState = useCallback(() => {
    // Stop GPS watcher
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Stop timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Reset refs
    lastPingRef.current = null;
    visitedCellsRef.current = new Set();

    // Reset state
    setSession(null);
    setIsActive(false);
    setIsStarting(false);
    setIsEnding(false);
    setError(null);
    setStats({
      durationSeconds: 0,
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      estimatedPoints: 0,
      gridCellsCovered: 0,
      recentSpeeds: [],
      avgSpeed30s: 0,
      transportMethod: 'stationary',
    });
    setPath([]);
    setValidation({
      inZone: true,
      validSpeed: true,
      distanceFromZone: 0,
      currentSpeed: 0,
      lastWarning: null,
    });
  }, []);

  // Reset state when mission changes
  useEffect(() => {
    if (missionId !== currentMissionIdRef.current) {
      console.log('Mission changed, resetting search session state');
      resetState();
      currentMissionIdRef.current = missionId;
      setIsLoading(true);
    }
  }, [missionId, resetState]);

  // Check if location is within search zone
  const isWithinSearchZone = useCallback((lat, lng) => {
    if (!lastSeenLocation?.lat || !lastSeenLocation?.lng) return true;

    const distance = haversineDistance(
      lat, lng,
      lastSeenLocation.lat, lastSeenLocation.lng
    );

    return distance <= CONFIG.SEARCH_RADIUS_MILES;
  }, [lastSeenLocation]);

  // Fetch active session on mount
  useEffect(() => {
    if (!missionId) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/search`);
        if (res.ok) {
          const data = await res.json();
          if (data.activeSession) {
            setSession(data.activeSession);
            setIsActive(true);

            // Restore stats
            const elapsed = Math.floor(
              (Date.now() - new Date(data.activeSession.startedAt).getTime()) / 1000
            );
            setStats(prev => ({
              ...prev,
              durationSeconds: elapsed,
              validatedDistanceMiles: data.activeSession.validatedDistanceMiles || 0,
              totalDistanceMiles: data.activeSession.totalDistanceMiles || 0,
              gridCellsCovered: data.activeSession.gridCellsCovered || 0,
            }));

            // Restore path if available
            if (data.activeSession.path) {
              setPath(data.activeSession.path);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching search session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [missionId]);

  // Duration timer
  useEffect(() => {
    if (isActive) {
      durationIntervalRef.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
        }));
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isActive]);

  // Calculate estimated points
  useEffect(() => {
    const basePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
    const gridBonus = stats.gridCellsCovered * 5;
    const timeBonus = Math.min(Math.floor(stats.durationSeconds / 900) * 10, 40); // 10 pts per 15 min

    setStats(prev => ({
      ...prev,
      estimatedPoints: Math.round(basePoints + gridBonus + timeBonus),
    }));
  }, [stats.validatedDistanceMiles, stats.gridCellsCovered, stats.durationSeconds]);

  // Process a location update
  const processLocationUpdate = useCallback(async (position) => {
    if (!session?.id || !isActive) return;

    const currentPing = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: Date.now(),
    };

    // Check if within search zone
    const inZone = isWithinSearchZone(currentPing.latitude, currentPing.longitude);
    const distanceFromLastSeen = lastSeenLocation
      ? haversineDistance(
          currentPing.latitude, currentPing.longitude,
          lastSeenLocation.lat, lastSeenLocation.lng
        )
      : 0;

    // Validate movement
    const movementValidation = validateMovement(lastPingRef.current, currentPing);

    // Update validation state
    setValidation({
      inZone,
      validSpeed: movementValidation.valid || movementValidation.reason !== 'DRIVING',
      distanceFromZone: Math.max(0, distanceFromLastSeen - CONFIG.SEARCH_RADIUS_MILES),
      currentSpeed: movementValidation.speed,
      lastWarning: !inZone ? 'OUTSIDE_ZONE' :
                   movementValidation.reason === 'DRIVING' ? 'DRIVING' : null,
    });

    // Skip GPS glitches entirely - don't add them to the visual path
    // This prevents "teleportation" lines when connection drops and reconnects
    if (movementValidation.isGpsGlitch) {
      console.log('GPS glitch detected, skipping point:', movementValidation.reason);
      return; // Don't add to path, don't update stats, don't send to server
    }

    // Add to path with timestamp for duration calculation
    setPath(prev => [...prev, {
      lat: currentPing.latitude,
      lng: currentPing.longitude,
      valid: inZone && movementValidation.valid,
      timestamp: currentPing.timestamp,
      speed: movementValidation.speed,
      distance: movementValidation.distance,
    }]);

    // Update grid cells
    if (inZone && lastSeenLocation) {
      const cellId = getGridCellId(
        currentPing.latitude,
        currentPing.longitude,
        lastSeenLocation.lat,
        lastSeenLocation.lng
      );

      if (!visitedCellsRef.current.has(cellId)) {
        visitedCellsRef.current.add(cellId);
        setStats(prev => ({
          ...prev,
          gridCellsCovered: visitedCellsRef.current.size,
        }));
      }
    }

    // Update distance stats and rolling speed
    setStats(prev => {
      // Add new speed to recent speeds (with safeguard for undefined)
      const now = Date.now();
      const previousSpeeds = prev.recentSpeeds || [];
      const newSpeeds = [
        ...previousSpeeds.filter(s => now - s.timestamp < 30000), // Keep last 30 seconds
        { speed: movementValidation.speed, timestamp: now }
      ];

      // Calculate average speed over last 30 seconds
      const avgSpeed30s = newSpeeds.length > 0
        ? newSpeeds.reduce((sum, s) => sum + s.speed, 0) / newSpeeds.length
        : 0;

      // Determine transportation method
      const transportMethod = getTransportMethod(avgSpeed30s);

      return {
        ...prev,
        totalDistanceMiles: prev.totalDistanceMiles + movementValidation.distance,
        validatedDistanceMiles: movementValidation.valid && inZone
          ? prev.validatedDistanceMiles + movementValidation.distance
          : prev.validatedDistanceMiles,
        recentSpeeds: newSpeeds,
        avgSpeed30s,
        transportMethod,
      };
    });

    // Store as last ping
    lastPingRef.current = currentPing;

    // Send ping to server with retry logic
    const sendPingWithRetry = async (attempts = 0) => {
      // Check if online first
      if (!isOnline()) {
        console.warn('Offline - ping will be retried when online');
        setValidation(prev => ({ ...prev, lastWarning: 'OFFLINE' }));
        return;
      }

      try {
        const res = await fetch(`/api/mission/${missionId}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ping',
            sessionId: session.id,
            latitude: currentPing.latitude,
            longitude: currentPing.longitude,
            accuracy: currentPing.accuracy,
            heading: currentPing.heading,
            speed: currentPing.speed,
            isValid: inZone && movementValidation.valid,
            invalidReason: !inZone ? 'OUTSIDE_ZONE' : movementValidation.reason,
            gridCellId: lastSeenLocation
              ? getGridCellId(currentPing.latitude, currentPing.longitude, lastSeenLocation.lat, lastSeenLocation.lng)
              : null,
          }),
        });

        if (!res.ok && attempts < CONFIG.PING_RETRY_ATTEMPTS) {
          // Retry on server error
          setTimeout(() => sendPingWithRetry(attempts + 1), CONFIG.PING_RETRY_DELAY_MS);
        }
      } catch (err) {
        console.error('Error sending ping:', err);
        if (attempts < CONFIG.PING_RETRY_ATTEMPTS) {
          // Retry on network error
          setTimeout(() => sendPingWithRetry(attempts + 1), CONFIG.PING_RETRY_DELAY_MS);
        } else {
          setValidation(prev => ({ ...prev, lastWarning: 'SYNC_ERROR' }));
        }
      }
    };

    sendPingWithRetry();
  }, [session?.id, isActive, missionId, isWithinSearchZone, lastSeenLocation]);

  // Start GPS watching
  useEffect(() => {
    if (!isActive || !session?.id) return;

    if (!('geolocation' in navigator)) {
      setError('GPS not available on this device');
      return;
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      processLocationUpdate,
      (err) => {
        console.error('Geolocation error:', err);
        // Handle specific error codes
        let warningType = 'GPS_ERROR';
        let errorMessage = 'GPS error occurred';

        switch (err.code) {
          case GEO_ERROR.PERMISSION_DENIED:
            warningType = 'GPS_PERMISSION_DENIED';
            errorMessage = 'Location permission denied. Please enable in settings.';
            break;
          case GEO_ERROR.POSITION_UNAVAILABLE:
            warningType = 'GPS_UNAVAILABLE';
            errorMessage = 'GPS signal unavailable. Try moving to an open area.';
            break;
          case GEO_ERROR.TIMEOUT:
            warningType = 'GPS_TIMEOUT';
            errorMessage = 'GPS timed out. Retrying...';
            break;
        }

        setValidation(prev => ({
          ...prev,
          lastWarning: warningType,
          errorMessage,
        }));
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isActive, session?.id, processLocationUpdate]);

  // Start a new search session
  const startSearch = useCallback(async () => {
    if (!missionId) return { success: false, error: 'No case ID' };

    console.log('[Search] Starting...');
    const startTime = Date.now();
    setIsStarting(true);
    setError(null);

    try {
      // Get current position with shorter timeout
      const position = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('GPS_TIMEOUT'));
        }, 8000); // 8 second timeout

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeoutId);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 10000, // Accept cached position up to 10 seconds old
          }
        );
      });

      console.log(`[Search] GPS acquired: ${Date.now() - startTime}ms`);

      const { latitude, longitude } = position.coords;

      // Check if within search zone
      const inZone = isWithinSearchZone(latitude, longitude);
      if (!inZone) {
        const distance = lastSeenLocation
          ? haversineDistance(latitude, longitude, lastSeenLocation.lat, lastSeenLocation.lng)
          : 0;

        setValidation(prev => ({
          ...prev,
          inZone: false,
          distanceFromZone: distance - CONFIG.SEARCH_RADIUS_MILES,
        }));

        // Still allow starting, but warn
      }

      // Call API to start session
      const apiStart = Date.now();
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          latitude,
          longitude,
          lastSeenLat: lastSeenLocation?.lat,
          lastSeenLng: lastSeenLocation?.lng,
        }),
      });

      console.log(`[Search] API call: ${Date.now() - apiStart}ms`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start search');
      }

      const data = await res.json();
      console.log(`[Search] Total start time: ${Date.now() - startTime}ms`);

      // Initialize session
      setSession({
        id: data.sessionId,
        status: 'ACTIVE',
        startedAt: data.startedAt,
      });
      setIsActive(true);
      setStats({
        durationSeconds: 0,
        totalDistanceMiles: 0,
        validatedDistanceMiles: 0,
        estimatedPoints: 0,
        gridCellsCovered: 0,
        recentSpeeds: [],
        avgSpeed30s: 0,
        transportMethod: 'stationary',
      });
      setPath([{ lat: latitude, lng: longitude, valid: inZone, timestamp: Date.now(), speed: 0, distance: 0 }]);
      visitedCellsRef.current = new Set();
      lastPingRef.current = {
        latitude,
        longitude,
        timestamp: Date.now(),
      };

      // Add initial grid cell
      if (lastSeenLocation) {
        const cellId = getGridCellId(latitude, longitude, lastSeenLocation.lat, lastSeenLocation.lng);
        visitedCellsRef.current.add(cellId);
        setStats(prev => ({ ...prev, gridCellsCovered: 1 }));
      }

      return { success: true, sessionId: data.sessionId };
    } catch (err) {
      // Handle specific geolocation error codes
      let errorMsg = err.message || 'Failed to start search';

      if (err.code === GEO_ERROR.PERMISSION_DENIED || err.message === 'User denied Geolocation') {
        errorMsg = 'Location permission denied. Please enable in your device settings.';
      } else if (err.code === GEO_ERROR.POSITION_UNAVAILABLE) {
        errorMsg = 'GPS unavailable. Please move to an open area and try again.';
      } else if (err.code === GEO_ERROR.TIMEOUT) {
        errorMsg = 'GPS timed out. Please wait a moment and try again.';
      }

      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsStarting(false);
    }
  }, [missionId, isWithinSearchZone, lastSeenLocation]);

  // End the search session
  const endSearch = useCallback(async () => {
    console.log('[Search] Ending...');
    const startTime = Date.now();

    // Get session ID - from state or try to fetch it
    let sessionId = session?.id;

    // If no session ID in state but we think we're active, try to fetch it
    if (!sessionId && isActive) {
      console.log('[Search] No session ID, fetching from API...');
      try {
        const checkRes = await fetch(`/api/mission/${missionId}/search`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.activeSession?.id) {
            sessionId = checkData.activeSession.id;
          }
        }
        console.log(`[Search] Session lookup: ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error('Error fetching session to end:', err);
      }
    }

    if (!sessionId) {
      // No session to end - just reset local state
      console.log('[Search] No session to end, clearing state');
      resetState();
      return { success: true, message: 'Session cleared' };
    }

    setIsEnding(true);

    try {
      // Stop watching position
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Stop timers
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Call API to end session
      const apiStart = Date.now();
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId: sessionId,
        }),
      });

      console.log(`[Search] End API call: ${Date.now() - apiStart}ms`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // If session not found, still clear local state
        if (res.status === 404 || data.error?.includes('not found')) {
          resetState();
          return { success: true, message: 'Session cleared' };
        }
        throw new Error(data.error || 'Failed to end search');
      }

      const data = await res.json();
      console.log(`[Search] Total end time: ${Date.now() - startTime}ms`);

      // Clear session
      setSession(null);
      setIsActive(false);

      // Include meetsMinimum for summary screen
      const meetsMinimum = (data.stats?.durationMinutes >= CONFIG.MIN_SESSION_MINUTES) &&
                           (data.stats?.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES);

      return {
        success: true,
        stats: data.stats || stats,
        points: data.points || { total: stats.estimatedPoints, distance: 0, gridBonus: 0, timeBonus: 0, multiplier: 1 },
        meetsMinimum,
      };
    } catch (err) {
      setError(err.message || 'Failed to end search');
      // Even on error, clear local state to allow starting new session
      resetState();
      return { success: false, error: err.message };
    } finally {
      setIsEnding(false);
    }
  }, [session?.id, isActive, missionId, resetState, stats]);

  // Cancel search (no points)
  const cancelSearch = useCallback(async () => {
    // Get session ID - from state or try to fetch it
    let sessionId = session?.id;

    // If no session ID in state but we think we're active, try to fetch it
    if (!sessionId && isActive) {
      try {
        const checkRes = await fetch(`/api/mission/${missionId}/search`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.activeSession?.id) {
            sessionId = checkData.activeSession.id;
          }
        }
      } catch (err) {
        console.error('Error fetching session to cancel:', err);
      }
    }

    // Stop watching
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Stop timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Try to cancel on server if we have a session ID
    if (sessionId) {
      try {
        await fetch(`/api/mission/${missionId}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            sessionId: sessionId,
          }),
        });
      } catch (err) {
        console.error('Error cancelling search:', err);
      }
    }

    // Always reset local state
    resetState();
  }, [session?.id, isActive, missionId, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop GPS watcher
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      // Stop timers
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  // Format duration for display
  const formatDuration = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Check if session meets minimum requirements
  const meetsMinimumRequirements = stats.durationSeconds >= CONFIG.MIN_SESSION_MINUTES * 60 &&
    stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES;

  return {
    // State
    session,
    isActive,
    isLoading,
    isStarting,
    isEnding,
    error,

    // Stats
    stats,
    formattedDuration: formatDuration(stats.durationSeconds),

    // Path for map
    path,

    // Validation
    validation,
    meetsMinimumRequirements,

    // Config (for UI)
    config: CONFIG,

    // Actions
    startSearch,
    endSearch,
    cancelSearch,
    resetState, // Force reset all state

    // Helpers
    isWithinSearchZone,
  };
}
