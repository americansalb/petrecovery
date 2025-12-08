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
};

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
 * Validate movement between two pings
 */
function validateMovement(prevPing, currentPing) {
  if (!prevPing) return { valid: true, distance: 0, speed: 0 };

  const timeDeltaHours = (currentPing.timestamp - prevPing.timestamp) / 3600000;
  if (timeDeltaHours <= 0) return { valid: false, reason: 'INVALID_TIME', distance: 0, speed: 0 };

  const distance = haversineDistance(
    prevPing.latitude,
    prevPing.longitude,
    currentPing.latitude,
    currentPing.longitude
  );

  const speed = distance / timeDeltaHours;

  if (speed > CONFIG.MAX_WALKING_SPEED_MPH) {
    return { valid: false, reason: 'DRIVING', distance, speed };
  }

  if (speed < CONFIG.MIN_MOVEMENT_SPEED_MPH && distance < 0.001) {
    return { valid: false, reason: 'STATIONARY', distance: 0, speed: 0 };
  }

  return { valid: true, distance, speed };
}

export default function useSearchSession(caseId, lastSeenLocation) {
  // Session state
  const [session, setSession] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    durationSeconds: 0,
    totalDistanceMiles: 0,
    validatedDistanceMiles: 0,
    estimatedPoints: 0,
    gridCellsCovered: 0,
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
    if (!caseId) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/search`);
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
  }, [caseId]);

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

    // Add to path
    setPath(prev => [...prev, {
      lat: currentPing.latitude,
      lng: currentPing.longitude,
      valid: inZone && movementValidation.valid,
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

    // Update distance stats
    if (movementValidation.valid) {
      setStats(prev => ({
        ...prev,
        totalDistanceMiles: prev.totalDistanceMiles + movementValidation.distance,
        validatedDistanceMiles: inZone
          ? prev.validatedDistanceMiles + movementValidation.distance
          : prev.validatedDistanceMiles,
      }));
    }

    // Store as last ping
    lastPingRef.current = currentPing;

    // Send ping to server
    try {
      await fetch(`/api/mission/${caseId}/search`, {
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
    } catch (err) {
      console.error('Error sending ping:', err);
    }
  }, [session?.id, isActive, caseId, isWithinSearchZone, lastSeenLocation]);

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
        setValidation(prev => ({
          ...prev,
          lastWarning: 'GPS_ERROR',
        }));
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
    if (!caseId) return { success: false, error: 'No case ID' };

    setIsStarting(true);
    setError(null);

    try {
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

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
      const res = await fetch(`/api/mission/${caseId}/search`, {
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start search');
      }

      const data = await res.json();

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
      });
      setPath([{ lat: latitude, lng: longitude, valid: inZone }]);
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
      const errorMsg = err.message === 'User denied Geolocation'
        ? 'Please enable location access to track your search'
        : err.message || 'Failed to start search';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsStarting(false);
    }
  }, [caseId, isWithinSearchZone, lastSeenLocation]);

  // End the search session
  const endSearch = useCallback(async () => {
    if (!session?.id) return { success: false, error: 'No active session' };

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
      const res = await fetch(`/api/mission/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId: session.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to end search');
      }

      const data = await res.json();

      // Clear session
      setSession(null);
      setIsActive(false);

      return {
        success: true,
        stats: data.stats,
        points: data.points,
      };
    } catch (err) {
      setError(err.message || 'Failed to end search');
      return { success: false, error: err.message };
    } finally {
      setIsEnding(false);
    }
  }, [session?.id, caseId]);

  // Cancel search (no points)
  const cancelSearch = useCallback(async () => {
    if (!session?.id) return;

    // Stop watching
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Stop timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    try {
      await fetch(`/api/mission/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          sessionId: session.id,
        }),
      });
    } catch (err) {
      console.error('Error cancelling search:', err);
    }

    setSession(null);
    setIsActive(false);
    setStats({
      durationSeconds: 0,
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      estimatedPoints: 0,
      gridCellsCovered: 0,
    });
    setPath([]);
  }, [session?.id, caseId]);

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

    // Helpers
    isWithinSearchZone,
  };
}
