'use client';

/**
 * usePOIs - Hook to fetch Points of Interest near a mission
 *
 * Fetches shelters, vets, and animal control near the last seen location
 */

import { useState, useEffect, useCallback } from 'react';

export default function usePOIs(missionId, radiusMiles = 10) {
  const [pois, setPois] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPOIs = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/missions/${missionId}/pois?radius=${radiusMiles}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch POIs');
      }

      const data = await res.json();
      setPois(data.pois || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching POIs:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [missionId, radiusMiles]);

  useEffect(() => {
    fetchPOIs();
  }, [fetchPOIs]);

  return {
    pois,
    isLoading,
    error,
    refetch: fetchPOIs,
  };
}
