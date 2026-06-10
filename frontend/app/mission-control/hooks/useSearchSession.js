'use client';

/**
 * useSearchSession - Search Path Tracking
 *
 * Tracks search paths as connected points. Two modes:
 *
 * 1. MOBILE MODE (Live GPS):
 *    - User taps "Mark Here" to drop a pin at their current GPS location
 *    - Points connect to form a path showing where they walked
 *    - Great for in-the-field searching
 *
 * 2. DESKTOP MODE (Planning/Retrospective):
 *    - User clicks on map to add points
 *    - Can plan a search route before going out
 *    - Or mark areas they already searched after the fact
 *
 * The path is visualized as connected lines with a coverage corridor.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS } from '@/app/lib/gpsService';

const CONFIG = {
  SEARCH_RADIUS_MILES: 2,
  POINTS_PER_MARK: 5, // Points per marked location
  POINTS_PER_MILE: 50, // Bonus points per mile walked
  MIN_DISTANCE_BETWEEN_MARKS_FEET: 50, // Minimum distance between marks
  COVERAGE_CORRIDOR_METERS: 50, // Width of coverage corridor (25m each side)
};

// Calculate distance between two points (miles)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total path distance
function calculatePathDistance(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
  }
  return total;
}

export default function useSearchSession(missionId, lastSeenLocation) {
  // GPS service for mobile mode
  const { getPosition, isSupported: gpsSupported, error: gpsServiceError, isLoading: gpsLoading } = useGPS();

  // Session state
  const [isActive, setIsActive] = useState(false); // Is a search session active?
  const [sessionId, setSessionId] = useState(null);
  const [path, setPath] = useState([]); // Array of {lat, lng, timestamp, inZone}
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    pointsMarked: 0,
    distanceMiles: 0,
    estimatedPoints: 0,
    durationMinutes: 0,
  });

  // Session start time for duration tracking
  const sessionStartRef = useRef(null);
  const currentMissionRef = useRef(missionId);

  // Update stats when path changes
  useEffect(() => {
    const distance = calculatePathDistance(path);
    const pointsInZone = path.filter(p => p.inZone !== false).length;
    const markPoints = pointsInZone * CONFIG.POINTS_PER_MARK;
    const distancePoints = Math.floor(distance * CONFIG.POINTS_PER_MILE);

    let duration = 0;
    if (sessionStartRef.current && isActive) {
      duration = Math.floor((Date.now() - sessionStartRef.current) / 60000);
    }

    setStats({
      pointsMarked: path.length,
      distanceMiles: distance,
      estimatedPoints: markPoints + distancePoints,
      durationMinutes: duration,
    });
  }, [path, isActive]);

  // Duration timer
  useEffect(() => {
    if (!isActive || !sessionStartRef.current) return;

    const timer = setInterval(() => {
      setStats(prev => ({
        ...prev,
        durationMinutes: Math.floor((Date.now() - sessionStartRef.current) / 60000),
      }));
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [isActive]);

  // Reset when mission changes
  useEffect(() => {
    if (missionId !== currentMissionRef.current) {
      currentMissionRef.current = missionId;
      setPath([]);
      setIsActive(false);
      setSessionId(null);
      setError(null);
      sessionStartRef.current = null;
    }
  }, [missionId]);

  // Load existing session from server
  useEffect(() => {
    if (!missionId) {
      setIsLoading(false);
      return;
    }

    const loadSession = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/search`);
        if (res.ok) {
          const data = await res.json();
          if (data.activeSession) {
            setSessionId(data.activeSession.id);
            setIsActive(true);
            setPath(data.activeSession.path || []);
            sessionStartRef.current = new Date(data.activeSession.startedAt).getTime();
          }
          // Also load any marked locations from previous sessions for display
          if (data.markedLocations) {
            // These are historical, not part of active session
          }
        }
      } catch (err) {
        console.error('Error loading search session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [missionId]);

  // Check if a point is within the search zone
  const isInSearchZone = useCallback((lat, lng) => {
    if (!lastSeenLocation?.lat || !lastSeenLocation?.lng) return true;
    const dist = haversineDistance(lat, lng, lastSeenLocation.lat, lastSeenLocation.lng);
    return dist <= CONFIG.SEARCH_RADIUS_MILES;
  }, [lastSeenLocation]);

  // Check if point is too close to last marked point
  const isTooClose = useCallback((lat, lng) => {
    if (path.length === 0) return false;
    const lastPoint = path[path.length - 1];
    const dist = haversineDistance(lat, lng, lastPoint.lat, lastPoint.lng);
    const distFeet = dist * 5280;
    return distFeet < CONFIG.MIN_DISTANCE_BETWEEN_MARKS_FEET;
  }, [path]);

  // Start a new search session
  const startSession = useCallback(async () => {
    if (!missionId || isActive) return { success: false };

    setError(null);

    try {
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start session');
      }

      const data = await res.json();

      setSessionId(data.sessionId);
      setIsActive(true);
      setPath([]);
      sessionStartRef.current = Date.now();

      return { success: true, sessionId: data.sessionId };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [missionId, isActive]);

  // End the current search session
  const endSession = useCallback(async () => {
    if (!missionId || !isActive) return { success: false };

    try {
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId,
          path,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Reset local state
      const finalStats = { ...stats };
      setIsActive(false);
      setSessionId(null);
      sessionStartRef.current = null;
      // Keep path visible for review, but mark session as ended

      return {
        success: true,
        stats: finalStats,
        pointsEarned: data.pointsEarned || finalStats.estimatedPoints,
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [missionId, isActive, sessionId, path, stats]);

  // Mark current GPS location (Mobile mode)
  const markCurrentLocation = useCallback(async () => {
    if (!missionId || !gpsSupported || isMarking) {
      return { success: false, error: 'Cannot mark location' };
    }

    // Auto-start session if not active
    if (!isActive) {
      const startResult = await startSession();
      if (!startResult.success) {
        return startResult;
      }
    }

    setIsMarking(true);
    setError(null);

    try {
      const location = await getPosition();
      const { lat, lng, accuracy } = location;

      // Validate
      if (isTooClose(lat, lng)) {
        setError('Move a bit further before marking again');
        return { success: false, error: 'Too close to last mark' };
      }

      const inZone = isInSearchZone(lat, lng);

      const newPoint = {
        id: Date.now().toString(),
        lat,
        lng,
        accuracy,
        inZone,
        timestamp: Date.now(),
      };

      // Add to path
      setPath(prev => [...prev, newPoint]);

      // Send to server
      await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark',
          sessionId,
          point: newPoint,
        }),
      });

      return { success: true, point: newPoint };
    } catch (err) {
      const msg = err.code === 1 ? 'Location permission denied' :
                  err.code === 2 ? 'GPS unavailable' :
                  err.message || 'Failed to mark location';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsMarking(false);
    }
  }, [missionId, gpsSupported, isMarking, isActive, startSession, getPosition, isTooClose, isInSearchZone, sessionId]);

  // Add a point by clicking on map (Desktop mode)
  const addPointAtLocation = useCallback(async (lat, lng) => {
    if (!missionId) {
      return { success: false, error: 'No mission selected' };
    }

    // Auto-start session if not active
    if (!isActive) {
      const startResult = await startSession();
      if (!startResult.success) {
        return startResult;
      }
    }

    setError(null);

    // Validate distance (more lenient for desktop planning)
    if (path.length > 0) {
      const lastPoint = path[path.length - 1];
      const dist = haversineDistance(lat, lng, lastPoint.lat, lastPoint.lng);
      const distFeet = dist * 5280;
      if (distFeet < 20) { // Very close clicks likely accidents
        return { success: false, error: 'Point too close' };
      }
    }

    const inZone = isInSearchZone(lat, lng);

    const newPoint = {
      id: Date.now().toString(),
      lat,
      lng,
      accuracy: null, // No GPS accuracy for manual points
      inZone,
      timestamp: Date.now(),
      isManual: true, // Flag that this was manually placed
    };

    setPath(prev => [...prev, newPoint]);

    // Send to server
    try {
      await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark',
          sessionId,
          point: newPoint,
        }),
      });
    } catch (err) {
      console.error('Failed to sync point to server:', err);
    }

    return { success: true, point: newPoint };
  }, [missionId, isActive, startSession, path, isInSearchZone, sessionId]);

  // Remove the last point (undo)
  const undoLastPoint = useCallback(() => {
    if (path.length === 0) return;
    setPath(prev => prev.slice(0, -1));
  }, [path.length]);

  // Clear all points (with confirmation expected from UI)
  const clearPath = useCallback(() => {
    setPath([]);
  }, []);

  // Cancel session without saving
  const cancelSession = useCallback(async () => {
    if (!isActive) return;

    try {
      await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          sessionId,
        }),
      });
    } catch (err) {
      console.error('Failed to cancel session:', err);
    }

    setIsActive(false);
    setSessionId(null);
    setPath([]);
    sessionStartRef.current = null;
  }, [missionId, isActive, sessionId]);

  return {
    // Session state
    isActive,
    sessionId,
    path,
    isLoading,
    isMarking,
    error,
    stats,
    // Epoch ms the active session started (null when idle); lets callers
    // run their own second-level timers without re-render churn here
    startedAt: sessionStartRef.current,

    // Session actions
    startSession,
    endSession,
    cancelSession,

    // Point actions (Mobile)
    markCurrentLocation,
    canMarkLocation: gpsSupported && !isMarking && !gpsLoading,
    gpsLoading,

    // Point actions (Desktop)
    addPointAtLocation,

    // Edit actions
    undoLastPoint,
    clearPath,
    canUndo: path.length > 0,

    // Computed
    hasPath: path.length > 0,
    pathDistance: stats.distanceMiles,

    // Config
    config: CONFIG,

    // GPS status
    gpsSupported,
    gpsError: gpsServiceError,
  };
}
