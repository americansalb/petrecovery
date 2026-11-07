'use client';

/**
 * useRecoveryKit - the durable read behind the page after posting and the
 * case page's share kit. Reads /recovery-kit (so it renders fully on a cold
 * reload with no live connection) and layers the SSE stream plus a 3s poll
 * on top until the cascade settles, so flyers and share images appear as
 * each one lands.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import useRecoveryKitStream from './useRecoveryKitStream';

export function isTerminal(status) {
  return ['COMPLETE', 'PARTIAL', 'FAILED'].includes(status);
}

export default function useRecoveryKit(caseNumber, { initialStatus = 'PENDING' } = {}) {
  const [kit, setKit] = useState(null);
  const [status, setStatus] = useState(initialStatus);
  const pollRef = useRef(null);

  const fetchKit = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseNumber)}/recovery-kit`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setKit(data);
      if (data.status) setStatus(data.status);
    } catch {
      /* transient - the poll retries */
    }
  }, [caseNumber]);

  useEffect(() => {
    if (caseNumber) fetchKit();
  }, [caseNumber, fetchKit]);

  // Nothing more is coming: the cascade finished, or the case never had
  // one (older cases answer exists:false with status 'unknown').
  const settled = isTerminal(status) || Boolean(kit && kit.exists === false);

  useEffect(() => {
    if (!caseNumber || settled) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchKit, 3000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [caseNumber, settled, fetchKit]);

  const debRef = useRef(null);
  useRecoveryKitStream(
    caseNumber,
    () => {
      if (debRef.current) clearTimeout(debRef.current);
      debRef.current = setTimeout(fetchKit, 400);
    },
    { enabled: Boolean(caseNumber) && !settled }
  );

  return { kit, status, settled, working: !settled, refetch: fetchKit };
}
