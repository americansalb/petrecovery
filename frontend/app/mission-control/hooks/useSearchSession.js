'use client';

/**
 * useSearchSession - Mark Location as Searched
 *
 * IMPORTANT: Continuous GPS tracking does not work reliably in web browsers.
 * For real-time GPS tracking, users should download the native mobile app.
 *
 * This hook provides a "Mark Location as Searched" feature:
 * - User taps a button to mark their current location
 * - Location is captured once and sent to the server
 * - Locations are displayed as markers on the map
 *
 * This approach works well on mobile web browsers since it only requires
 * a single location capture per action (not continuous tracking).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS } from '@/app/lib/gpsService';

const CONFIG = {
  SEARCH_RADIUS_MILES: 2,
  POINTS_PER_MARK: 10, // Points earned per marked location
  MIN_DISTANCE_BETWEEN_MARKS_FEET: 100, // Minimum distance between marks to count
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
  // GPS service for one-time location capture
  const { getPosition, isSupported: gpsSupported, error: gpsServiceError } = useGPS();

  // State
  const [markedLocations, setMarkedLocations] = useState([]);
  const [isMarking, setIsMarking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    locationsMarked: 0,
    estimatedPoints: 0,
  });

  // Ref for current mission
  const currentMissionRef = useRef(missionId);

  // Reset when mission changes
  useEffect(() => {
    if (missionId !== currentMissionRef.current) {
      currentMissionRef.current = missionId;
      setMarkedLocations([]);
      setStats({ locationsMarked: 0, estimatedPoints: 0 });
      setError(null);
    }
  }, [missionId]);

  // Load existing marked locations from server
  useEffect(() => {
    if (!missionId) {
      setIsLoading(false);
      return;
    }

    const loadMarkedLocations = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/search`);
        if (res.ok) {
          const data = await res.json();
          if (data.markedLocations) {
            setMarkedLocations(data.markedLocations);
            setStats({
              locationsMarked: data.markedLocations.length,
              estimatedPoints: data.markedLocations.length * CONFIG.POINTS_PER_MARK,
            });
          }
        }
      } catch (err) {
        console.error('Error loading marked locations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMarkedLocations();
  }, [missionId]);

  // Mark current location as searched
  const markLocation = useCallback(async (notes = null) => {
    if (!missionId) {
      setError('No mission selected');
      return { success: false, error: 'No mission selected' };
    }

    if (!gpsSupported) {
      setError('GPS not available on this device');
      return { success: false, error: 'GPS not available' };
    }

    if (isMarking) {
      return { success: false, error: 'Already marking location' };
    }

    setIsMarking(true);
    setError(null);

    try {
      // Get current location (one-time capture)
      const location = await getPosition();
      const { lat, lng, accuracy } = location;

      // Check if in search zone
      let inZone = true;
      if (lastSeenLocation?.lat && lastSeenLocation?.lng) {
        const distFromLastSeen = haversineDistance(
          lat, lng,
          lastSeenLocation.lat, lastSeenLocation.lng
        );
        inZone = distFromLastSeen <= CONFIG.SEARCH_RADIUS_MILES;
      }

      // Check distance from last marked location
      let tooClose = false;
      if (markedLocations.length > 0) {
        const lastMark = markedLocations[markedLocations.length - 1];
        const distFromLast = haversineDistance(lat, lng, lastMark.lat, lastMark.lng);
        const distFeet = distFromLast * 5280; // Convert miles to feet
        tooClose = distFeet < CONFIG.MIN_DISTANCE_BETWEEN_MARKS_FEET;
      }

      if (tooClose) {
        setError('You already marked this area. Move at least 100 feet before marking again.');
        return { success: false, error: 'Too close to last marked location' };
      }

      // Send to server
      const res = await fetch(`/api/mission/${missionId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark',
          latitude: lat,
          longitude: lng,
          accuracy,
          inZone,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark location');
      }

      const data = await res.json();

      // Update local state
      const newMark = {
        id: data.markId || Date.now().toString(),
        lat,
        lng,
        accuracy,
        inZone,
        notes,
        timestamp: Date.now(),
      };

      setMarkedLocations(prev => [...prev, newMark]);
      setStats(prev => ({
        locationsMarked: prev.locationsMarked + 1,
        estimatedPoints: prev.estimatedPoints + (data.pointsEarned || CONFIG.POINTS_PER_MARK),
      }));

      return {
        success: true,
        markId: data.markId,
        pointsEarned: data.pointsEarned || CONFIG.POINTS_PER_MARK,
        inZone,
      };
    } catch (err) {
      const msg = err.code === 1 ? 'Location permission denied. Please enable GPS access.' :
                  err.code === 2 ? 'GPS unavailable. Please check your location settings.' :
                  err.message || 'Failed to mark location';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsMarking(false);
    }
  }, [missionId, gpsSupported, getPosition, lastSeenLocation, markedLocations, isMarking]);

  // Clear all marked locations (local only - doesn't delete from server)
  const clearMarks = useCallback(() => {
    setMarkedLocations([]);
    setStats({ locationsMarked: 0, estimatedPoints: 0 });
  }, []);

  return {
    // State
    markedLocations,
    isLoading,
    isMarking,
    error,
    stats,

    // Actions
    markLocation,
    clearMarks,

    // Computed
    hasMarks: markedLocations.length > 0,
    canMark: gpsSupported && !isMarking,

    // GPS error from service
    gpsError: gpsServiceError,

    // Config
    config: CONFIG,
  };
}
