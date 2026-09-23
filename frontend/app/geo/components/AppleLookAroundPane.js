'use client';

/**
 * Look Around imagery for an Apple round. Tries the round's candidate
 * coordinates in order until one loads, reports which one, and can put
 * the player back at the start.
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { findLookAround, openLookAround } from '../lib/lookAround';

const AppleLookAroundPane = forwardRef(function AppleLookAroundPane(
  { mapkit, candidates, roundKey, allowMove = true, allowPan = true, allowZoom = true, onLocated, onAttempt, onFailed },
  ref
) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const stageRef = useRef(null);
  const locatedRef = useRef(null);
  const restartingRef = useRef(false);
  const callbacks = useRef({ onLocated, onAttempt, onFailed });
  callbacks.current = { onLocated, onAttempt, onFailed };

  useEffect(() => {
    if (!mapkit || !containerRef.current || !candidates?.length) return undefined;
    let stopped = false;
    // Each search draws into an element of its own. A search that is
    // abandoned while a view is still loading (the player leaves, the
    // round is retried) leaves that element, and the view in it, alone
    // until the view has answered: destroying an unanswered view, or
    // pulling it out of the page, wedges MapKit's Look Around for every
    // view after it (lib/lookAround.js, STALL_MS).
    const stage = document.createElement('div');
    stage.className = 'absolute inset-0';
    stage.dataset.unanswered = '';
    containerRef.current.appendChild(stage);

    findLookAround(mapkit, stage, candidates, {
      onAttempt: (i) => callbacks.current.onAttempt?.(i),
      shouldStop: () => stopped,
    })
      .then(({ view, index }) => {
        delete stage.dataset.unanswered;
        if (stopped) {
          view.destroy?.();
          stage.remove();
          return;
        }
        viewRef.current = view;
        stageRef.current = stage;
        locatedRef.current = candidates[index];
        applyRules(view, { allowMove, allowPan, allowZoom });
        callbacks.current.onLocated?.(index);
      })
      .catch((error) => {
        // Every view in a search that ran out of spots has answered, so
        // its element can go. A hung one stays until it answers.
        if (error?.kind !== 'unresponsive') {
          delete stage.dataset.unanswered;
          stage.remove();
        }
        if (!stopped) callbacks.current.onFailed?.(error);
      });

    return () => {
      stopped = true;
      // The round's view has answered - it is the round - so it can go.
      if (stageRef.current === stage) {
        try {
          viewRef.current?.destroy?.();
        } catch {
          /* gone */
        }
        viewRef.current = null;
        stageRef.current = null;
        if (!('unanswered' in stage.dataset)) stage.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapkit, candidates, roundKey]);

  // Leaving the round while a spot is still loading. React is about to
  // take the pane out of the page, and a view taken out before it has
  // answered never answers, and every view after it waits behind it:
  // the next game in this tab would never start. A layout cleanup runs
  // while the pane is still in the page, so the unanswered search moves,
  // whole, to a parking place of its own, out of sight, where its view
  // can finish; its own handlers above destroy it once it has.
  useLayoutEffect(() => {
    const pane = containerRef.current;
    return () => {
      for (const stage of [...(pane?.children || [])]) {
        if ('unanswered' in stage.dataset) park(stage);
      }
    };
  }, []);

  useEffect(() => {
    if (viewRef.current) applyRules(viewRef.current, { allowMove, allowPan, allowZoom });
  }, [allowMove, allowPan, allowZoom]);

  useImperativeHandle(
    ref,
    () => ({
      async returnToStart() {
        const stage = stageRef.current;
        const start = locatedRef.current;
        // One at a time: a second press while the first view is still
        // loading would make a view that waits behind it for good.
        if (!mapkit || !stage || !start || restartingRef.current) return;
        restartingRef.current = true;
        try {
          viewRef.current?.destroy?.();
        } catch {
          /* gone */
        }
        viewRef.current = null;
        stage.replaceChildren();
        stage.dataset.unanswered = '';
        try {
          const view = await openLookAround(mapkit, stage, start);
          delete stage.dataset.unanswered;
          if (stageRef.current === stage) {
            viewRef.current = view;
            applyRules(view, { allowMove, allowPan, allowZoom });
          } else {
            view.destroy?.();
            stage.remove();
          }
        } catch (error) {
          /* the imagery vanished; the round keeps its token */
          if (error?.kind !== 'hang') {
            delete stage.dataset.unanswered;
            if (stageRef.current !== stage) stage.remove();
          }
        } finally {
          restartingRef.current = false;
        }
      },
    }),
    [mapkit, allowMove, allowPan, allowZoom]
  );

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 bg-pe-canvas" />
      {!allowPan ? <div className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden="true" title="Panning is off for this game" /> : null}
    </div>
  );
});

/**
 * Somewhere in the page for a search to finish after its round has gone:
 * fixed, full size and invisible, so MapKit keeps loading it as it would
 * on screen, and nothing in it can be seen or touched.
 */
function park(stage) {
  let lot = document.getElementById('pe-look-around-parking');
  if (!lot) {
    lot = document.createElement('div');
    lot.id = 'pe-look-around-parking';
    lot.setAttribute('aria-hidden', 'true');
    lot.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:-1;overflow:hidden';
    document.body.appendChild(lot);
  }
  lot.appendChild(stage);
}

function applyRules(view, { allowMove, allowPan, allowZoom }) {
  try {
    if ('isNavigationEnabled' in view) view.isNavigationEnabled = allowMove;
    if ('isZoomEnabled' in view) view.isZoomEnabled = allowZoom;
    if ('isScrollEnabled' in view) view.isScrollEnabled = allowPan;
    if ('showsRoadLabels' in view) view.showsRoadLabels = false;
    if ('showsPointsOfInterest' in view) view.showsPointsOfInterest = false;
  } catch {
    /* older MapKit builds */
  }
}

export default AppleLookAroundPane;
