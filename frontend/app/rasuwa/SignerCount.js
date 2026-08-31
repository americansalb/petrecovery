'use client';

/**
 * The one live sentence on the /rasuwa landing pages: how many people
 * have signed the families' letter so far. Renders the truthful floor
 * ("More than 1,189") immediately, for bots, no-JS, and any failure,
 * and upgrades in place when /api/rasuwa/roster-count answers with a
 * live number. Never renders an error: the floor is always right.
 */

import { useEffect, useState } from 'react';
import { signerCountSentence } from './rosterCount';

export default function SignerCount() {
  const [state, setState] = useState({ count: null, live: false });

  useEffect(() => {
    let stop = false;
    fetch('/api/rasuwa/roster-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!stop && data && data.live && typeof data.count === 'number') {
          setState({ count: data.count, live: true });
        }
      })
      .catch(() => {
        // the floor sentence is already showing
      });
    return () => {
      stop = true;
    };
  }, []);

  return <span>{signerCountSentence(state)}</span>;
}
