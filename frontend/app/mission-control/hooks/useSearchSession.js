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

import { getPointsMultiplier } from '@/app/lib/searchProbability';
import { useGPS, GPS_MODE } from '@/app/lib/gpsService';

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

export default function useSearchSession(missionId, lastSeenLocation, probabilityZones = null) {
  // Centralized GPS service
  const { location: gpsLocation, startTracking, subscribe, getPosition, isSupported: gpsSupported, error: gpsServiceError } = useGPS();
  const gpsUnsubscribeRef = useRef(null);

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
    zoneMultiplier: 1.0, // Average zone multiplier for searched area
  });

  // Path for map visualization
  const [path, setPath] = useState([]);

  // Refs for session management
  const timerRef = useRef(null);
  const lastPingRef = useRef(null);
  const currentMissionRef = useRef(missionId);
  const isSearchingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const sessionStartedAtRef = useRef(null); // Track when session started for accurate duration
  const isEndingRef = useRef(false); // Prevent race condition with checkSession

  // Keep refs in sync with state - still needed for async callbacks
  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Check for existing session on mount
  useEffect(() => {
    if (!missionId) return;

    // Reset if mission changed
    if (missionId !== currentMissionRef.current) {
      currentMissionRef.current = missionId;
      // Clear refs first
      isSearchingRef.current = false;
      sessionIdRef.current = null;
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
      // Don't check if we're in the middle of ending a session (race condition prevention)
      if (isEndingRef.current) {
        console.log('[useSearchSession] Skipping checkSession - ending in progress');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/mission/${missionId}/search`);
        if (res.ok) {
          const data = await res.json();
          // Double-check we're still not ending (API call took time)
          if (data.activeSession && !isEndingRef.current) {
            // Resume existing session - set refs FIRST
            sessionIdRef.current = data.activeSession.id;
            isSearchingRef.current = true;
            sessionStartedAtRef.current = new Date(data.activeSession.startedAt).getTime();

            setSessionId(data.activeSession.id);
            setIsSearching(true);

            // Use server's distance values (they're accumulated on server)
            setStats(prev => ({
              ...prev,
              durationSeconds: Math.floor((Date.now() - sessionStartedAtRef.current) / 1000),
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

  // Duration timer - calculates from session start time (works even after backgrounding)
  useEffect(() => {
    if (isSearching && sessionStartedAtRef.current) {
      timerRef.current = setInterval(() => {
        // Calculate from actual start time, not incremental
        // This ensures accurate time even if app was backgrounded
        const elapsed = Math.floor((Date.now() - sessionStartedAtRef.current) / 1000);
        setStats(prev => ({
          ...prev,
          durationSeconds: elapsed,
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

  // Calculate average zone multiplier from path
  useEffect(() => {
    if (!path.length || !probabilityZones) {
      setStats(prev => ({ ...prev, zoneMultiplier: 1.0 }));
      return;
    }

    // Calculate multiplier for each valid point in path
    const validPoints = path.filter(p => p.valid);
    if (!validPoints.length) return;

    const totalMultiplier = validPoints.reduce((sum, point) => {
      const mult = getPointsMultiplier([point.lat, point.lng], probabilityZones);
      return sum + mult;
    }, 0);

    const avgMultiplier = totalMultiplier / validPoints.length;
    setStats(prev => ({ ...prev, zoneMultiplier: avgMultiplier }));
  }, [path, probabilityZones]);

  // Estimated points calculation - only show if minimum requirements met
  useEffect(() => {
    const durationMinutes = stats.durationSeconds / 60;
    const meetsMinimum = durationMinutes >= CONFIG.MIN_SESSION_MINUTES &&
                         stats.validatedDistanceMiles >= CONFIG.MIN_SESSION_MILES;

    if (!meetsMinimum) {
      setStats(prev => ({ ...prev, estimatedPoints: 0 }));
      return;
    }

    const basePoints = stats.validatedDistanceMiles * CONFIG.POINTS_PER_MILE;
    const gridBonus = stats.gridCellsCovered * 5;
    const timeBonus = Math.min(Math.floor(stats.durationSeconds / 900) * 10, 40);

    // Apply zone multiplier to base points
    const zoneBonus = basePoints * (stats.zoneMultiplier - 1); // Only the bonus part

    setStats(prev => ({
      ...prev,
      estimatedPoints: Math.round(basePoints + zoneBonus + gridBonus + timeBonus),
    }));
  }, [stats.validatedDistanceMiles, stats.gridCellsCovered, stats.durationSeconds, stats.zoneMultiplier]);

  // Process GPS update
  const processLocation = useCallback(async (position) => {
    // CRITICAL: Check refs, not state! State values are stale in watchPosition callback
    const currentSessionId = sessionIdRef.current;
    const currentlySearching = isSearchingRef.current;

    if (!currentSessionId || !currentlySearching) {
      console.log('[GPS] Ignoring ping - search not active (session:', currentSessionId, 'searching:', currentlySearching, ')');
      return;
    }

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

    // Skip obvious GPS glitches (but update lastPingRef so we can recover)
    if (distance > 0.5 || speedMph > 20) {
      console.log('GPS glitch detected, skipping (but updating baseline for next ping)');
      // Still update lastPingRef so subsequent pings have a valid baseline
      lastPingRef.current = { lat: latitude, lng: longitude, timestamp };
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
          sessionId: currentSessionId,
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
  }, [missionId, lastSeenLocation]); // Removed sessionId, isSearching - we use refs now

  // GPS watching effect - uses centralized GPS service
  useEffect(() => {
    if (!isSearching || !sessionId) {
      // Unsubscribe from GPS service
      if (gpsUnsubscribeRef.current) {
        gpsUnsubscribeRef.current();
        gpsUnsubscribeRef.current = null;
      }
      return;
    }

    if (!gpsSupported) {
      setError('GPS not available');
      return;
    }

    // Start high accuracy tracking for search sessions
    startTracking(GPS_MODE.HIGH_ACCURACY);

    // Subscribe to location updates from centralized service
    gpsUnsubscribeRef.current = subscribe((location) => {
      // Create a position-like object for processLocation
      const position = {
        coords: {
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy || 50,
          heading: null,
          speed: null,
        },
      };
      processLocation(position);
    });

    return () => {
      if (gpsUnsubscribeRef.current) {
        gpsUnsubscribeRef.current();
        gpsUnsubscribeRef.current = null;
      }
    };
  }, [isSearching, sessionId, gpsSupported, startTracking, subscribe, processLocation]);

  // Start search
  const startSearch = useCallback(async () => {
    console.log('[useSearchSession] startSearch called, missionId:', missionId, 'isStarting:', isStarting);

    if (!missionId || isStarting) {
      console.log('[useSearchSession] Cannot start - no missionId or already starting');
      return { success: false };
    }

    if (!gpsSupported) {
      setError('GPS not available on this device');
      return { success: false, error: 'GPS not available' };
    }

    setIsStarting(true);
    setError(null);
    console.log('[useSearchSession] Set isStarting to true');

    try {
      // Get current position from centralized GPS service
      const location = await getPosition();
      console.log('[useSearchSession] Got position via GPS service:', location.lat, location.lng);

      const { lat: latitude, lng: longitude } = location;

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
      console.log('[useSearchSession] Start API response:', data);

      // Set refs FIRST - ensures callbacks see correct values immediately
      const startTime = Date.now();
      sessionIdRef.current = data.sessionId;
      isSearchingRef.current = true;
      sessionStartedAtRef.current = startTime;
      console.log('[useSearchSession] Set refs, sessionId:', data.sessionId);

      // Set state
      setSessionId(data.sessionId);
      setIsSearching(true);
      console.log('[useSearchSession] Set state, isSearching now true');
      setStats({
        durationSeconds: 0,
        totalDistanceMiles: 0,
        validatedDistanceMiles: 0,
        estimatedPoints: 0,
        gridCellsCovered: 0, // Start at 0 - earn by moving
        zoneMultiplier: 1.0,
      });
      setPath([{ lat: latitude, lng: longitude, valid: true, timestamp: startTime }]);
      lastPingRef.current = { lat: latitude, lng: longitude, timestamp: startTime };

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
  }, [missionId, isStarting, gpsSupported, getPosition]);

  // End search
  const endSearch = useCallback(async () => {
    console.log('[useSearchSession] endSearch called, isEnding:', isEnding, 'sessionIdRef:', sessionIdRef.current);

    if (isEnding || isEndingRef.current) {
      console.log('[useSearchSession] Already ending, returning early');
      return { success: false };
    }

    // Set BOTH state and ref to prevent race conditions
    setIsEnding(true);
    isEndingRef.current = true;
    console.log('[useSearchSession] Set isEnding to true (both state and ref)');

    // CRITICAL: Update refs FIRST - this stops pending callbacks immediately
    const currentSessionId = sessionIdRef.current;
    isSearchingRef.current = false;
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    console.log('[useSearchSession] Cleared refs, currentSessionId:', currentSessionId);

    // Unsubscribe from GPS service
    if (gpsUnsubscribeRef.current) {
      gpsUnsubscribeRef.current();
      gpsUnsubscribeRef.current = null;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Capture stats before resetting
    const currentStats = { ...stats };

    // Reset UI state
    setIsSearching(false);
    setSessionId(null);
    console.log('[useSearchSession] Reset UI state, isSearching now false');

    // Call API and WAIT for it to complete before clearing isEnding flag
    try {
      console.log('[useSearchSession] Calling end API for session:', currentSessionId);
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId: currentSessionId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.log('[useSearchSession] API response:', data);

      // Only clear the ending flag AFTER API confirms session is ended
      setIsEnding(false);
      isEndingRef.current = false;
      console.log('[useSearchSession] endSearch complete, success - cleared isEnding flag');

      return {
        success: true,
        stats: data.stats || currentStats,
        points: data.points || { total: currentStats.estimatedPoints },
        meetsMinimum: data.meetsMinimum,
      };
    } catch (err) {
      console.error('[useSearchSession] End search error:', err);
      // Still clear the flag on error so user can retry
      setIsEnding(false);
      isEndingRef.current = false;
      return { success: false, error: err.message };
    }
  }, [missionId, isEnding, stats]); // Removed sessionId - we use ref now

  // Force stop (used for cleanup)
  const forceStop = useCallback(async () => {
    // Set ending flag to prevent race conditions
    isEndingRef.current = true;

    // CRITICAL: Update refs FIRST - stops pending callbacks immediately
    const currentSessionId = sessionIdRef.current;
    isSearchingRef.current = false;
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;

    // Unsubscribe from GPS service
    if (gpsUnsubscribeRef.current) {
      gpsUnsubscribeRef.current();
      gpsUnsubscribeRef.current = null;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // End on server and wait for it
    if (currentSessionId) {
      try {
        await fetch(`/api/mission/${missionId}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', sessionId: currentSessionId }),
        });
      } catch (e) {
        console.error('[useSearchSession] forceStop API error:', e);
      }
    }

    // Reset state
    setIsSearching(false);
    setSessionId(null);
    setIsEnding(false);
    isEndingRef.current = false;
    setStats({
      durationSeconds: 0,
      totalDistanceMiles: 0,
      validatedDistanceMiles: 0,
      estimatedPoints: 0,
      gridCellsCovered: 0,
    });
    setPath([]);
    lastPingRef.current = null;
  }, [missionId]); // Removed sessionId - we use ref now

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear refs first to stop any pending callbacks
      isSearchingRef.current = false;
      sessionIdRef.current = null;

      // Unsubscribe from GPS service
      if (gpsUnsubscribeRef.current) {
        gpsUnsubscribeRef.current();
        gpsUnsubscribeRef.current = null;
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
