'use client';

/**
 * The Street View panorama for a round, with the game's rules applied:
 * no address box, no road labels, no date, and movement, panning and
 * zoom each switchable; in Kidnapped mode the car drives itself. One
 * panorama instance lives for the whole game and is repointed per round.
 *
 * Google's logo and copyright line are drawn by the panorama itself
 * and must stay visible; the HUD keeps clear of the bottom edge.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { haversineKm } from '@/app/lib/geo/distance';
import { DRIVE_STEP_MS, angleDiff, normalizeHeading, pickLink } from '../lib/drive';

const GoogleStreetViewPane = forwardRef(function GoogleStreetViewPane(
  { api, panoId, heading = 0, allowMove = true, allowPan = true, allowZoom = true, drive = false, onHeading, onDrive },
  ref
) {
  const containerRef = useRef(null);
  const panoRef = useRef(null);
  const startRef = useRef({ panoId, heading });
  const onHeadingRef = useRef(onHeading);
  onHeadingRef.current = onHeading;
  const onDriveRef = useRef(onDrive);
  onDriveRef.current = onDrive;

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
      // The arrow keys also walk along links, so No Move means no
      // keyboard at all; the mouse still pans.
      keyboardShortcuts: allowPan && allowMove,
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
      keyboardShortcuts: allowPan && allowMove,
    });
  }, [allowMove, allowPan, allowZoom]);

  // Kidnapped: the car drives itself (app/geo/lib/drive.js). Every step
  // takes the link closest to the direction of travel and keeps the way
  // the passenger is looking relative to the road; the distance driven
  // is reported from the panorama's position changes.
  useEffect(() => {
    const pano = panoRef.current;
    if (!drive || !pano || !panoId) return undefined;
    const trip = { travelHeading: normalizeHeading(heading), km: 0, last: null };
    const here = () => {
      const p = pano.getPosition?.();
      return p && typeof p.lat === 'function' ? { lat: p.lat(), lng: p.lng() } : null;
    };
    trip.last = here();
    const moved = pano.addListener('position_changed', () => {
      const now = here();
      if (!now) return;
      if (trip.last) trip.km += haversineKm(trip.last, now);
      trip.last = now;
      onDriveRef.current?.(trip.km);
    });
    const step = () => {
      const link = pickLink(pano.getLinks?.(), trip.travelHeading);
      if (!link) return;
      const pov = pano.getPov?.() || { heading: trip.travelHeading, pitch: 0 };
      const look = angleDiff(pov.heading, trip.travelHeading);
      trip.travelHeading = normalizeHeading(link.heading);
      pano.setPano(link.pano);
      pano.setPov({ heading: normalizeHeading(trip.travelHeading + look), pitch: pov.pitch || 0 });
    };
    const id = setInterval(step, DRIVE_STEP_MS);
    onDriveRef.current?.(0);
    return () => {
      clearInterval(id);
      moved?.remove?.();
    };
  }, [api, drive, panoId, heading]);

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
