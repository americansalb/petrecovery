'use client';

/**
 * useCaseOutcome - Hook for case closure and outcome recording
 *
 * Per Actions_Guide.md Phase 6 specification.
 */

import { useState, useCallback } from 'react';

export default function useCaseOutcome(caseId) {
  const [metrics, setMetrics] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch case metrics for display
   */
  const fetchMetrics = useCallback(async () => {
    if (!caseId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/mission/${caseId}/close`);
      if (!res.ok) throw new Error('Failed to fetch metrics');

      const data = await res.json();
      setMetrics(data.metrics);
      setOutcome(data.outcome);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  /**
   * Close the case with outcome
   */
  const closeCase = useCallback(
    async (outcomeData) => {
      if (!caseId) return { success: false, error: 'No case ID' };

      setClosing(true);
      try {
        const res = await fetch(`/api/mission/${caseId}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outcomeData),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to close case');
        }

        // Refresh metrics after closure
        await fetchMetrics();

        return { success: true, outcomeId: data.outcomeId };
      } catch (err) {
        console.error('Error closing case:', err);
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setClosing(false);
      }
    },
    [caseId, fetchMetrics]
  );

  return {
    metrics,
    outcome,
    loading,
    closing,
    error,
    fetchMetrics,
    closeCase,
    isClosed: !!outcome,
  };
}
