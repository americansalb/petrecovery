'use client';

/**
 * Subscribes to the per-case cascade SSE and calls onEvent for each message.
 * Purely additive: the RecoveryKit also polls the durable read, so if this
 * stream never connects (proxy, scaling, closed tab) nothing is lost.
 */

import { useEffect, useRef } from 'react';

export default function useRecoveryKitStream(caseNumber, onEvent, { enabled = true } = {}) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !caseNumber || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let es;
    try {
      es = new EventSource(`/api/cases/${encodeURIComponent(caseNumber)}/activation/stream`);
    } catch {
      return;
    }
    es.onmessage = (e) => {
      try {
        cbRef.current?.(JSON.parse(e.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    es.onerror = () => {
      // Let the browser retry; the poll covers any gap. Give up only if closed.
      if (es.readyState === EventSource.CLOSED) es.close();
    };
    return () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
    };
  }, [caseNumber, enabled]);
}
