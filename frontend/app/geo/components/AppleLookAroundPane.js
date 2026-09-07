'use client';

/**
 * Look Around imagery for an Apple round. Tries the round's candidate
 * coordinates in order until one loads, reports which one, and can put
 * the player back at the start.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { findLookAround, openLookAround } from '../lib/lookAround';

const AppleLookAroundPane = forwardRef(function AppleLookAroundPane(
  { mapkit, candidates, roundKey, allowMove = true, allowPan = true, allowZoom = true, onLocated, onAttempt, onFailed },
  ref
) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const locatedRef = useRef(null);
  const callbacks = useRef({ onLocated, onAttempt, onFailed });
  callbacks.current = { onLocated, onAttempt, onFailed };

  useEffect(() => {
    if (!mapkit || !containerRef.current || !candidates?.length) return undefined;
    let stopped = false;
    const container = containerRef.current;
    try {
      viewRef.current?.destroy?.();
    } catch {
      /* gone */
    }
    viewRef.current = null;
    container.replaceChildren();

    findLookAround(mapkit, container, candidates, {
      onAttempt: (i) => callbacks.current.onAttempt?.(i),
      shouldStop: () => stopped,
    })
      .then(({ view, index }) => {
        if (stopped) {
          view.destroy?.();
          return;
        }
        viewRef.current = view;
        locatedRef.current = candidates[index];
        applyRules(view, { allowMove, allowPan, allowZoom });
        callbacks.current.onLocated?.(index);
      })
      .catch((error) => {
        if (!stopped) callbacks.current.onFailed?.(error);
      });

    return () => {
      stopped = true;
      try {
        viewRef.current?.destroy?.();
      } catch {
        /* gone */
      }
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapkit, candidates, roundKey]);

  useEffect(() => {
    if (viewRef.current) applyRules(viewRef.current, { allowMove, allowPan, allowZoom });
  }, [allowMove, allowPan, allowZoom]);

  useImperativeHandle(
    ref,
    () => ({
      async returnToStart() {
        const container = containerRef.current;
        const start = locatedRef.current;
        if (!mapkit || !container || !start) return;
        try {
          viewRef.current?.destroy?.();
        } catch {
          /* gone */
        }
        viewRef.current = null;
        container.replaceChildren();
        try {
          const view = await openLookAround(mapkit, container, start);
          viewRef.current = view;
          applyRules(view, { allowMove, allowPan, allowZoom });
        } catch {
          /* the imagery vanished; the round keeps its token */
        }
      },
      zoomBy() {
        /* Look Around zooms by pinch and wheel only */
      },
    }),
    [mapkit, allowMove, allowPan, allowZoom]
  );

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 bg-midnight-950" />
      {!allowPan ? <div className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden="true" title="Panning is off for this game" /> : null}
    </div>
  );
});

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
