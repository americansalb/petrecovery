'use client';

/**
 * useFlyerTracking - Flyer tracking hook for Mission Control
 *
 * Manages flyer posting, cold spot detection, and progress tracking.
 * Uses one-time location capture (not continuous tracking).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithRetry } from '@/app/lib/utils';
import { useGPS } from '@/app/lib/gpsService';

// Points per flyer (per spec)
const FLYER_BASE_POINTS = 8;
const PHOTO_BONUS_POINTS = 3;

export default function useFlyerTracking(missionId, options = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  // GPS service for one-time location capture
  const { location: gpsLocation, error: gpsServiceError, getPosition, isSupported: gpsSupported, isLoading: gpsLoading } = useGPS();

  // ==========================================================================
  // STATE
  // ==========================================================================
  const [flyers, setFlyers] = useState([]);
  const [coldSpots, setColdSpots] = useState([]);
  const [coverage, setCoverage] = useState({ totalFlyers: 0, uniqueCells: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);

  // User location from GPS service (last captured location)
  const userLocation = gpsLocation ? {
    lat: gpsLocation.lat,
    lng: gpsLocation.lng,
    accuracy: gpsLocation.accuracy,
    timestamp: gpsLocation.timestamp,
  } : null;

  const locationError = gpsServiceError;

  // Stats
  const [userStats, setUserStats] = useState({ flyersPosted: 0, pointsEarned: 0 });
  const [teamStats, setTeamStats] = useState({ totalFlyers: 0, uniqueContributors: 0 });

  // Refs for cleanup
  const refreshIntervalRef = useRef(null);

  // ==========================================================================
  // FETCH FLYERS DATA
  // ==========================================================================
  const fetchFlyers = useCallback(async () => {
    if (!missionId) return;

    try {
      const res = await fetchWithRetry(`/api/mission/${missionId}/flyers`);
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
  }, [missionId]);

  // ==========================================================================
  // LOCATION REFRESH (one-time capture)
  // ==========================================================================
  const refreshLocation = useCallback(async () => {
    if (!gpsSupported) {
      return { success: false, error: 'GPS not supported' };
    }

    try {
      const location = await getPosition();
      return { success: true, location };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [gpsSupported, getPosition]);

  // ==========================================================================
  // POST FLYER
  // ==========================================================================
  const postFlyer = useCallback(async (photoUrl = null, notes = null) => {
    if (!missionId) {
      return { success: false, error: 'No case selected' };
    }

    setPosting(true);

    try {
      // Get fresh location for the flyer
      let location = userLocation;
      if (!location) {
        const result = await refreshLocation();
        if (!result.success) {
          throw new Error(result.error || 'Location not available. Please enable GPS.');
        }
        location = {
          lat: result.location.lat,
          lng: result.location.lng,
        };
      }

      const res = await fetchWithRetry(`/api/mission/${missionId}/flyers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
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
  }, [missionId, userLocation, fetchFlyers, refreshLocation]);

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

  // Initial fetch
  useEffect(() => {
    if (missionId) {
      fetchFlyers();
    }
  }, [missionId, fetchFlyers]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && missionId) {
      refreshIntervalRef.current = setInterval(fetchFlyers, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, missionId, fetchFlyers]);

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
    gpsLoading,

    // Actions
    fetchFlyers,
    postFlyer,
    refreshLocation,
    getNearestColdSpot,

    // Computed
    hasLocation: !!userLocation,
    canPost: gpsSupported && !posting,
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
