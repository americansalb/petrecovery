'use client';

/**
 * useSearchCoverage - Hook to fetch and manage search coverage data
 *
 * Fetches historical and active search sessions for map visualization
 * Provides data for:
 * - Individual team member trails (colored)
 * - Purple coverage overlay
 * - Active searcher indicators
 * - Highlights current user's paths
 */

import { useState, useEffect, useCallback } from 'react';
import { getTeamColorByUserId, getCoverageOpacity, getDecayedOpacity } from '@/app/lib/teamColors';

export default function useSearchCoverage(missionId, currentUserId = null) {
  const [coverage, setCoverage] = useState({
    completed: [],
    active: [],
    stats: { totalSessions: 0, totalSearchers: 0, activeSearchers: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch coverage data
  const fetchCoverage = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/missions/${missionId}/coverage`);
      if (!res.ok) {
        throw new Error('Failed to fetch coverage');
      }

      const data = await res.json();

      // Enrich with colors and decay calculations
      const enrichedData = {
        ...data,
        completed: data.completed.map(session => ({
          ...session,
          color: getTeamColorByUserId(session.userId),
          // Calculate hours since search ended
          hoursAgo: session.endedAt
            ? (Date.now() - new Date(session.endedAt).getTime()) / 3600000
            : 0,
        })),
        active: data.active.map(session => ({
          ...session,
          color: getTeamColorByUserId(session.userId),
        })),
      };

      setCoverage(enrichedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching coverage:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [missionId]);

  // Initial fetch
  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Refresh every 30 seconds for active searches
  useEffect(() => {
    if (!missionId) return;

    const interval = setInterval(fetchCoverage, 30000);
    return () => clearInterval(interval);
  }, [missionId, fetchCoverage]);

  /**
   * Get coverage data formatted for map rendering
   * Includes decay-adjusted opacity calculations
   * Highlights current user's paths (isCurrentUser flag)
   */
  const getMapCoverageData = useCallback(() => {
    const now = Date.now();

    // Separate current user's paths from others for proper rendering order
    const allTrails = [
      ...coverage.completed.map(session => ({
        id: session.id,
        userId: session.userId,
        userName: session.userName,
        color: session.color.hex,
        path: session.path,
        isActive: false,
        isCurrentUser: currentUserId && session.userId === currentUserId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        hoursAgo: session.hoursAgo,
      })),
      ...coverage.active.map(session => ({
        id: session.id,
        userId: session.userId,
        userName: session.userName,
        color: session.color.hex,
        path: session.path,
        isActive: true,
        isCurrentUser: currentUserId && session.userId === currentUserId,
        startedAt: session.startedAt,
        endedAt: null,
        hoursAgo: 0,
      })),
    ];

    // Sort so current user's trails render LAST (on top)
    // And active trails render after completed ones
    allTrails.sort((a, b) => {
      // Current user's trails come last (render on top)
      if (a.isCurrentUser !== b.isCurrentUser) {
        return a.isCurrentUser ? 1 : -1;
      }
      // Active trails come after completed
      if (a.isActive !== b.isActive) {
        return a.isActive ? 1 : -1;
      }
      return 0;
    });

    return {
      trails: allTrails,
      // Stats
      activeSearchersCount: coverage.stats.activeSearchers,
      totalSearchers: coverage.stats.totalSearchers,
      totalSessions: coverage.stats.totalSessions,
      // Current user's search count
      currentUserSearches: allTrails.filter(t => t.isCurrentUser).length,
    };
  }, [coverage, currentUserId]);

  return {
    coverage,
    isLoading,
    error,
    refetch: fetchCoverage,
    getMapCoverageData,
  };
}
