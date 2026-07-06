'use client';

/**
 * useWizardHistory — make the browser back button navigate wizard steps
 * instead of unloading the page (and losing the report).
 *
 * The wizard's internal step stack stays the source of truth. Every forward
 * step pushes one history entry carrying its depth; popstate diffs the
 * landed-on depth against the internal one and replays the difference
 * through goBack(). The browser forward button has no redo stack to map to,
 * so it bounces straight back to the current entry. On the first step no
 * extra entries exist, so back leaves the page normally.
 *
 * Steps stay plain React state — no routes are added, so the
 * report/layout.js share-metadata contract is untouched.
 *
 * Returns { recordPush, browserBack, unwind }:
 *  - call recordPush() alongside every internal forward navigation
 *  - use browserBack() as the in-app Back button handler (it routes through
 *    popstate so both back paths behave identically)
 *  - call unwind() after a successful submit to drop the pushed entries so
 *    back from the success screen exits in one press
 */

import { useEffect, useRef } from 'react';

export default function useWizardHistory(goBack) {
  const depthRef = useRef(0); // entries this wizard has pushed
  const suppressRef = useRef(false); // true while unwinding after submit
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    const onPopState = (e) => {
      const target = e.state?.wizardDepth ?? 0;
      if (suppressRef.current) {
        depthRef.current = target;
        if (target === 0) suppressRef.current = false;
        return;
      }
      const current = depthRef.current;
      if (target < current) {
        for (let i = 0; i < current - target; i++) goBackRef.current();
        depthRef.current = target;
      } else if (target > current) {
        // Forward button: no redo stack — bounce back to where we were.
        window.history.go(current - target);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const recordPush = () => {
    depthRef.current += 1;
    window.history.pushState({ wizardDepth: depthRef.current }, '');
  };

  const browserBack = () => {
    window.history.back();
  };

  const unwind = () => {
    if (depthRef.current > 0) {
      suppressRef.current = true;
      window.history.go(-depthRef.current);
    }
  };

  return { recordPush, browserBack, unwind };
}
