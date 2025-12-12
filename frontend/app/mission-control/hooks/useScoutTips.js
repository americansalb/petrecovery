'use client';

/**
 * useScoutTips - Scout tips hook for Mission Control
 *
 * Manages Scout mascot tips including fetching, generating, and dismissing.
 * Per Actions_Guide.md Phase 5 specification.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithRetry } from '@/app/lib/utils';

// Tip type icons
export const TIP_TYPE_ICONS = {
  TIME: '\u{1F315}',      // Full moon (for time)
  WEATHER: '\u{1F327}',   // Rain cloud
  PROGRESS: '\u{1F3C6}',  // Trophy
  LOCATION: '\u{1F4CD}',  // Pin
  COLD_SPOT: '\u{1F534}', // Red circle
  STRATEGY: '\u{1F4A1}',  // Light bulb
  ENCOURAGE: '\u{1F49A}', // Green heart
  SIGHTING: '\u{1F6A8}',  // Alert
};

// Tip type labels
export const TIP_TYPE_LABELS = {
  TIME: 'Time Alert',
  WEATHER: 'Weather Tip',
  PROGRESS: 'Milestone',
  LOCATION: 'Location Tip',
  COLD_SPOT: 'Coverage Gap',
  STRATEGY: 'Search Strategy',
  ENCOURAGE: 'Encouragement',
  SIGHTING: 'Sighting Alert',
};

export default function useScoutTips(missionId, options = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 60000, // 1 minute
    autoGenerate = true,
    coldSpotsCount = 0,
  } = options;

  // ==========================================================================
  // STATE
  // ==========================================================================
  const [tips, setTips] = useState([]);
  const [petName, setPetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [dismissing, setDismissing] = useState(null);

  // Track visible tip for banner
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Refs
  const refreshIntervalRef = useRef(null);
  const lastGenerateRef = useRef(0);

  // ==========================================================================
  // FETCH TIPS
  // ==========================================================================
  const fetchTips = useCallback(async () => {
    if (!missionId) return;

    try {
      const res = await fetchWithRetry(`/api/mission/${missionId}/tips`);
      if (!res.ok) {
        throw new Error('Failed to fetch tips');
      }

      const data = await res.json();
      setTips(data.tips || []);
      setPetName(data.petName || '');
      setError(null);
    } catch (err) {
      console.error('Error fetching tips:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  // ==========================================================================
  // GENERATE TIPS
  // ==========================================================================
  const generateTips = useCallback(async (forceRefresh = false) => {
    if (!missionId) return;

    // Throttle generation to once per 5 minutes unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastGenerateRef.current < 5 * 60 * 1000) {
      return;
    }

    setGenerating(true);

    try {
      const res = await fetchWithRetry(`/api/mission/${missionId}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coldSpotsCount }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate tips');
      }

      const data = await res.json();
      setTips(data.tips || []);
      lastGenerateRef.current = now;
      setError(null);
    } catch (err) {
      console.error('Error generating tips:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [missionId, coldSpotsCount]);

  // ==========================================================================
  // DISMISS TIP
  // ==========================================================================
  const dismissTip = useCallback(async (tipId) => {
    if (!missionId || !tipId) return;

    setDismissing(tipId);

    try {
      const res = await fetchWithRetry(`/api/mission/${missionId}/tips/${tipId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to dismiss tip');
      }

      // Remove from local state
      setTips((prev) => prev.filter((t) => t.id !== tipId));

      // Reset current tip index if needed
      setCurrentTipIndex((prev) => Math.max(0, Math.min(prev, tips.length - 2)));
    } catch (err) {
      console.error('Error dismissing tip:', err);
    } finally {
      setDismissing(null);
    }
  }, [missionId, tips.length]);

  // ==========================================================================
  // POST TO CHAT
  // ==========================================================================
  const postToChat = useCallback(async (tipId) => {
    if (!missionId || !tipId) return { success: false };

    try {
      const res = await fetchWithRetry(`/api/mission/${missionId}/tips/${tipId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post_to_chat' }),
      });

      if (!res.ok) {
        throw new Error('Failed to post tip to chat');
      }

      const data = await res.json();
      return { success: true, tip: data.tip };
    } catch (err) {
      console.error('Error posting tip to chat:', err);
      return { success: false, error: err.message };
    }
  }, [missionId]);

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================
  const nextTip = useCallback(() => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
  }, [tips.length]);

  const prevTip = useCallback(() => {
    setCurrentTipIndex((prev) => (prev - 1 + tips.length) % tips.length);
  }, [tips.length]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  const currentTip = tips[currentTipIndex] || null;
  const highPriorityTips = tips.filter((t) => t.priority >= 70);
  const hasHighPriorityTips = highPriorityTips.length > 0;

  // Get icon for tip type
  const getTipIcon = useCallback((tipType) => {
    return TIP_TYPE_ICONS[tipType] || '\u{1F4AC}'; // Default: speech bubble
  }, []);

  // Get label for tip type
  const getTipLabel = useCallback((tipType) => {
    return TIP_TYPE_LABELS[tipType] || 'Tip';
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initial fetch
  useEffect(() => {
    if (missionId) {
      fetchTips();
      if (autoGenerate) {
        generateTips();
      }
    }
  }, [missionId, fetchTips, generateTips, autoGenerate]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && missionId) {
      refreshIntervalRef.current = setInterval(() => {
        fetchTips();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, missionId, fetchTips]);

  // ==========================================================================
  // RETURN HOOK API
  // ==========================================================================
  return {
    // Data
    tips,
    petName,
    currentTip,
    currentTipIndex,
    highPriorityTips,

    // Status
    loading,
    error,
    generating,
    dismissing,
    hasHighPriorityTips,
    hasTips: tips.length > 0,

    // Actions
    fetchTips,
    generateTips,
    dismissTip,
    postToChat,
    nextTip,
    prevTip,

    // Helpers
    getTipIcon,
    getTipLabel,
  };
}
