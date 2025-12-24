'use client';

/**
 * useSearchSession - Simplified GPS Search Hook
 *
 * Simple state machine:
 * - IDLE: No active search
 * - SEARCHING: GPS tracking active
 *
 * Server is ALWAYS the source of truth.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const CONFIG = {
  MAX_WALKING_SPEED_MPH: 5,
  SEARCH_RADIUS_MILES: 2,
  MIN_SESSION_MINUTES: 5,
  MIN_SESSION_MILES: 0.1,
  POINTS_PER_MILE: 100,
};

// Calculate distance between two points (miles)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function useSearchSession(missionId, lastSeenLocation) {
  // Core state - kept minimal
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState(null);
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

  // Path for map visualization
  const [path, setPath] = useState([]);

  // Refs
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastPingRef = useRef(null);
  const currentMissionRef = useRef(missionId);

  // Check for existing session on mount
  useEffect(() => {
    if (!missionId) return;

    // Reset if mission changed
    if (missionId !== currentMissionRef.current) {
      currentMissionRef.current = missionId;
      setIsSearching(false);
      setSessionId(null);
      setStats({
        durationSeconds: 0,
        totalDistanceMiles: 0,
        validatedDistanceMiles: 0,
        estimatedPoints: 0,
        gridCellsCovered: 0,
      });
      setPath([]);
      setError(null);
    }

    const checkSession = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/search`);
        if (res.ok) {
          const data = await res.json();
          if (data.activeSession) {
            // Resume existing session
            setSessionId(data.activeSession.id);
            setIsSearching(true);
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
          }
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [missionId]);

  // Duration timer
  useEffect(() => {
    if (isSearching) {
      timerRef.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSearching]);

  // Estimated points calculation
  useEffect(() => {
    const basePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
    const gridBonus = stats.gridCellsCovered * 5;
    const timeBonus = Math.min(Math.floor(stats.durationSeconds / 900) * 10, 40);

    setStats(prev => ({
      ...prev,
      estimatedPoints: Math.round(basePoints + gridBonus + timeBonus),
    }));
  }, [stats.validatedDistanceMiles, stats.gridCellsCovered, stats.durationSeconds]);

  // Process GPS update
  const processLocation = useCallback(async (position) => {
    if (!sessionId || !isSearching) return;

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const timestamp = Date.now();

    // Calculate distance from previous
    let distance = 0;
    let speedMph = 0;
    if (lastPingRef.current) {
      distance = haversineDistance(
        lastPingRef.current.lat, lastPingRef.current.lng,
        latitude, longitude
      );
      const timeDeltaHours = (timestamp - lastPingRef.current.timestamp) / 3600000;
      if (timeDeltaHours > 0) {
        speedMph = distance / timeDeltaHours;
      }
    }

    // Check if in search zone
    let inZone = true;
    if (lastSeenLocation?.lat && lastSeenLocation?.lng) {
      const distFromLastSeen = haversineDistance(
        latitude, longitude,
        lastSeenLocation.lat, lastSeenLocation.lng
      );
      inZone = distFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES;
    }

    // Validate speed (ignore GPS glitches)
    const isValid = speedMph <= CONFIG.MAX_WALKING_SPEED_MPH && inZone && distance < 0.5;

    // Skip obvious GPS glitches
    if (distance > 0.5 || speedMph > 20) {
      console.log('GPS glitch detected, skipping');
      return;
    }

    // Update local path
    setPath(prev => [...prev, {
      lat: latitude,
      lng: longitude,
      valid: isValid,
      timestamp,
    }]);

    // Update local stats
    if (isValid && distance > 0.001) {
      setStats(prev => ({
        ...prev,
        totalDistanceMiles: prev.totalDistanceMiles + distance,
        validatedDistanceMiles: prev.validatedDistanceMiles + distance,
      }));
    }

    // Store as last ping
    lastPingRef.current = { lat: latitude, lng: longitude, timestamp };

    // Send to server (fire and forget)
    try {
      await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          sessionId,
          latitude,
          longitude,
          accuracy,
          heading,
          speed,
          isValid,
        }),
      });
    } catch (err) {
      console.error('Ping failed:', err);
    }
  }, [sessionId, isSearching, missionId, lastSeenLocation]);

  // GPS watching effect
  useEffect(() => {
    if (!isSearching || !sessionId) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('GPS not available');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      processLocation,
      (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) {
          setError('Location permission denied');
        } else if (err.code === 2) {
          setError('GPS unavailable');
        } else {
          setError('GPS timeout');
        }
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
        watchIdRef.current = null;
      }
    };
  }, [isSearching, sessionId, processLocation]);

  // Start search
  const startSearch = useCallback(async () => {
    if (!missionId || isStarting) return { success: false };

    setIsStarting(true);
    setError(null);

    try {
      // Get current position
      const position = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('GPS timeout')), 10000);
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(timeout); resolve(pos); },
          (err) => { clearTimeout(timeout); reject(err); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
      });

      const { latitude, longitude } = position.coords;

      // Call API - it will force-end any existing sessions
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          latitude,
          longitude,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start');
      }

      const data = await res.json();

      // Set state
      setSessionId(data.sessionId);
      setIsSearching(true);
      setStats({
        durationSeconds: 0,
        totalDistanceMiles: 0,
        validatedDistanceMiles: 0,
        estimatedPoints: 0,
        gridCellsCovered: 1,
      });
      setPath([{ lat: latitude, lng: longitude, valid: true, timestamp: Date.now() }]);
      lastPingRef.current = { lat: latitude, lng: longitude, timestamp: Date.now() };

      return { success: true, sessionId: data.sessionId };
    } catch (err) {
      const msg = err.code === 1 ? 'Location permission denied' :
                  err.code === 2 ? 'GPS unavailable' :
                  err.message || 'Failed to start';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsStarting(false);
    }
  }, [missionId, isStarting]);

  // End search
  const endSearch = useCallback(async () => {
    if (isEnding) return { success: false };

    setIsEnding(true);

    // Stop GPS immediately
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Stop timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Capture current values before resetting
    const currentSessionId = sessionId;
    const currentStats = { ...stats };

    // Reset UI state IMMEDIATELY - don't wait for API
    setIsSearching(false);
    setSessionId(null);

    // Fire API call in background (don't block UI)
    try {
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId: currentSessionId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      setIsEnding(false);
      return {
        success: true,
        stats: data.stats || currentStats,
        points: data.points || { total: currentStats.estimatedPoints },
        meetsMinimum: data.meetsMinimum,
      };
    } catch (err) {
      console.error('End search error:', err);
      setIsEnding(false);
      return { success: false, error: err.message };
    }
  }, [missionId, sessionId, isEnding, stats]);

  // Force stop (used for cleanup)
  const forceStop = useCallback(async () => {
    // Stop GPS
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // End on server (don't wait)
    if (sessionId) {
      fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId }),
      }).catch(() => {});
    }

    // Reset state
    setIsSearching(false);
    setSessionId(null);
    setStats({
      durationSeconds: 0,
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      estimatedPoints: 0,
      gridCellsCovered: 0,
    });
    setPath([]);
    lastPingRef.current = null;
  }, [missionId, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format duration
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    // State
    isSearching,
    isLoading,
    isStarting,
    isEnding,
    error,
    session: sessionId ? { id: sessionId } : null,
    isActive: isSearching, // Alias for compatibility

    // Stats
    stats,
    formattedDuration: formatDuration(stats.durationSeconds),
    path,

    // Validation state (simplified - always valid for now)
    validation: {
      inZone: true,
      validSpeed: true,
      distanceFromZone: 0,
      currentSpeed: 0,
      lastWarning: error,
    },

    // Actions
    startSearch,
    endSearch,
    cancelSearch: forceStop, // Alias for compatibility
    forceStop,

    // Config
    config: CONFIG,
    meetsMinimumRequirements:
      stats.durationSeconds >= CONFIG.MIN_SESSION_MINUTES * 60 &&
      stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES,
  };
}
