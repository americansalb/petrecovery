'use client';

/**
 * The Street View panorama for a round, with the game's rules applied:
 * no address box, no road labels, no date, and movement, panning and
 * zoom each switchable. One panorama instance lives for the whole game
 * and is repointed per round.
 *
 * Google's logo and copyright line are drawn by the panorama itself
 * and must stay visible; the HUD keeps clear of the bottom edge.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const GoogleStreetViewPane = forwardRef(function GoogleStreetViewPane(
  { api, panoId, heading = 0, allowMove = true, allowPan = true, allowZoom = true, onHeading },
  ref
) {
  const containerRef = useRef(null);
  const panoRef = useRef(null);
  const startRef = useRef({ panoId, heading });
  const onHeadingRef = useRef(onHeading);
  onHeadingRef.current = onHeading;

  // Create once. React strict mode runs this twice in development
  // (mount, cleanup, mount); the instance is kept across that, and only
  // rebuilt if the container element itself changed.
  useEffect(() => {
    if (!api || !containerRef.current) return undefined;
    if (panoRef.current && panoRef.current.__container === containerRef.current) {
      panoRef.current.setVisible(Boolean(startRef.current.panoId));
      return undefined;
    }
    const pano = new api.StreetViewPanorama(containerRef.current, {
      pano: panoId || undefined,
      pov: { heading, pitch: 0 },
      zoom: 0,
      visible: Boolean(panoId),
      addressControl: false,
      showRoadLabels: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      enableCloseButton: false,
      imageDateControl: false,
      panControl: false,
      zoomControl: false,
      linksControl: allowMove,
      clickToGo: allowMove,
      scrollwheel: allowZoom,
      disableDoubleClickZoom: !allowZoom,
      keyboardShortcuts: allowPan,
    });
    pano.addListener('pov_changed', () => {
      const pov = pano.getPov();
      if (pov) onHeadingRef.current?.(pov.heading);
    });
    pano.__container = containerRef.current;
    panoRef.current = pano;
    return () => {
      pano.setVisible(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Repoint per round.
  useEffect(() => {
    const pano = panoRef.current;
    if (!pano) return;
    startRef.current = { panoId, heading };
    if (!panoId) {
      pano.setVisible(false);
      return;
    }
    pano.setPano(panoId);
    pano.setPov({ heading, pitch: 0 });
    pano.setZoom(0);
    pano.setVisible(true);
    onHeadingRef.current?.(heading);
  }, [panoId, heading]);

  // Rules can change between games without a new instance.
  useEffect(() => {
    const pano = panoRef.current;
    if (!pano) return;
    pano.setOptions({
      linksControl: allowMove,
      clickToGo: allowMove,
      scrollwheel: allowZoom,
      disableDoubleClickZoom: !allowZoom,
      keyboardShortcuts: allowPan,
    });
  }, [allowMove, allowPan, allowZoom]);

  useImperativeHandle(
    ref,
    () => ({
      returnToStart() {
        const pano = panoRef.current;
        if (!pano || !startRef.current.panoId) return;
        pano.setPano(startRef.current.panoId);
        pano.setPov({ heading: startRef.current.heading, pitch: 0 });
        pano.setZoom(0);
      },
      zoomBy(delta) {
        const pano = panoRef.current;
        if (!pano) return;
        const next = Math.max(0, Math.min(4, (pano.getZoom() || 0) + delta));
        pano.setZoom(next);
      },
    }),
    []
  );

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 bg-midnight-950" />
      {!allowPan ? (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          aria-hidden="true"
          onWheel={(e) => e.preventDefault()}
          title="Panning is off for this game"
        />
      ) : null}
    </div>
  );
});

export default GoogleStreetViewPane;
