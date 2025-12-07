'use client';

/**
 * useFlyerTracking - Flyer tracking hook for Mission Control
 *
 * Manages flyer posting, cold spot detection, and progress tracking.
 * Per Actions_Guide.md Phase 4 specification.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithRetry } from '@/app/lib/utils';

// Points per flyer (per spec)
const FLYER_BASE_POINTS = 8;
const PHOTO_BONUS_POINTS = 3;

export default function useFlyerTracking(caseId, options = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  // ==========================================================================
  // STATE
  // ==========================================================================
  const [flyers, setFlyers] = useState([]);
  const [coldSpots, setColdSpots] = useState([]);
  const [coverage, setCoverage] = useState({ totalFlyers: 0, uniqueCells: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // Stats
  const [userStats, setUserStats] = useState({ flyersPosted: 0, pointsEarned: 0 });
  const [teamStats, setTeamStats] = useState({ totalFlyers: 0, uniqueContributors: 0 });

  // Refs for cleanup
  const watchIdRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // ==========================================================================
  // FETCH FLYERS DATA
  // ==========================================================================
  const fetchFlyers = useCallback(async () => {
    if (!caseId) return;

    try {
      const res = await fetchWithRetry(`/api/mission/${caseId}/flyers`);
      if (!res.ok) {
        throw new Error('Failed to fetch flyers');
      }

      const data = await res.json();
      setFlyers(data.flyers || []);
      setColdSpots(data.coldSpots || []);
      setCoverage(data.coverage || { totalFlyers: 0, uniqueCells: 0 });

      // Calculate team stats
      const contributors = new Set(data.flyers?.map(f => f.postedBy?.id) || []);
      setTeamStats({
        totalFlyers: data.flyers?.length || 0,
        uniqueContributors: contributors.size,
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching flyers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // ==========================================================================
  // LOCATION TRACKING
  // ==========================================================================
  const startLocationTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('GPS not available on this device');
      return false;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        });
        setLocationError(null);
      },
      (err) => {
        console.error('Location error:', err);
        setLocationError('Unable to get your location. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch position for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        });
        setLocationError(null);
      },
      (err) => {
        console.error('Location watch error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return true;
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ==========================================================================
  // POST FLYER
  // ==========================================================================
  const postFlyer = useCallback(async (photoUrl = null, notes = null) => {
    if (!caseId) {
      return { success: false, error: 'No case selected' };
    }

    if (!userLocation) {
      return { success: false, error: 'Location not available. Please enable GPS.' };
    }

    setPosting(true);

    try {
      const res = await fetchWithRetry(`/api/mission/${caseId}/flyers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          photoUrl,
          notes,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to post flyer');
      }

      const data = await res.json();

      // Update local state immediately
      setUserStats(prev => ({
        flyersPosted: prev.flyersPosted + 1,
        pointsEarned: prev.pointsEarned + (data.pointsEarned || FLYER_BASE_POINTS),
      }));

      // Refresh full data
      await fetchFlyers();

      return {
        success: true,
        flyerId: data.flyerId,
        pointsEarned: data.pointsEarned,
        isVerified: data.isVerified,
      };
    } catch (err) {
      console.error('Error posting flyer:', err);
      return { success: false, error: err.message };
    } finally {
      setPosting(false);
    }
  }, [caseId, userLocation, fetchFlyers]);

  // ==========================================================================
  // FETCH USER STATS
  // ==========================================================================
  const fetchUserStats = useCallback(async () => {
    if (!caseId) return;

    try {
      // Get user's flyers for this case
      const flyersRes = await fetchWithRetry(`/api/mission/${caseId}/flyers`);
      if (flyersRes.ok) {
        const data = await flyersRes.json();
        // Count current user's flyers
        // Note: This requires knowing the current user's ID
        // For now, we'll track locally via postFlyer
      }
    } catch (err) {
      console.error('Error fetching user stats:', err);
    }
  }, [caseId]);

  // ==========================================================================
  // GET NEAREST COLD SPOT
  // ==========================================================================
  const getNearestColdSpot = useCallback(() => {
    if (!userLocation || coldSpots.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;

    for (const spot of coldSpots) {
      const dist = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        spot.center.lat,
        spot.center.lng
      );

      if (dist < minDist) {
        minDist = dist;
        nearest = { ...spot, distanceFromUser: dist };
      }
    }

    return nearest;
  }, [userLocation, coldSpots]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initial fetch and location tracking
  useEffect(() => {
    if (caseId) {
      fetchFlyers();
      startLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [caseId, fetchFlyers, startLocationTracking, stopLocationTracking]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && caseId) {
      refreshIntervalRef.current = setInterval(fetchFlyers, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, caseId, fetchFlyers]);

  // ==========================================================================
  // RETURN HOOK API
  // ==========================================================================
  return {
    // Data
    flyers,
    coldSpots,
    coverage,
    userLocation,

    // Stats
    userStats,
    teamStats,

    // Status
    loading,
    error,
    posting,
    locationError,

    // Actions
    fetchFlyers,
    postFlyer,
    startLocationTracking,
    stopLocationTracking,
    getNearestColdSpot,

    // Computed
    hasLocation: !!userLocation,
    canPost: !!userLocation && !posting,
  };
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

/**
 * Calculate distance between two points in miles using Haversine formula
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
