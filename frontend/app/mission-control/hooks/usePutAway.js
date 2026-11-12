'use client';

/**
 * What this person has put away on this computer or phone, for one pet:
 * a "Needs you" card on the desk, a helper's word on the owner's phone
 * card ("Got it"). Kept in the browser, so it is this device's own. A card
 * put away stays away; a new sighting, a new word or someone newly free is
 * a new card.
 */
import { useCallback, useState } from 'react';

const read = (key) => {
  try {
    const kept = JSON.parse(window.localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(kept) ? kept.map(String) : []);
  } catch {
    // Nothing kept, or a browser that keeps nothing: every card shows.
    return new Set();
  }
};

export default function usePutAway(caseId) {
  const key = `rp_mc_put_${caseId}`;
  // Read once, as the screen is first drawn, so a card put away does not show for a moment on the way in.
  const [state, setState] = useState(() => ({ key, put: typeof window === 'undefined' ? new Set() : read(key) }));
  // Another pet is another list.
  const put = state.key === key ? state.put : typeof window === 'undefined' ? new Set() : read(key);
  if (state.key !== key) setState({ key, put });
  const putAway = useCallback(
    (what) =>
      setState((was) => {
        const next = new Set(was.key === key ? was.put : []);
        next.add(String(what));
        try {
          // The newest couple of hundred are plenty: an old card's reason has long passed.
          window.localStorage.setItem(key, JSON.stringify([...next].slice(-200)));
        } catch {
          // Not kept: the card stays away until the page is closed.
        }
        return { key, put: next };
      }),
    [key]
  );
  return [put, putAway];
}
