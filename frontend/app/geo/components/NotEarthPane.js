'use client';

/**
 * The picture for a Not Earth round (app/lib/geo/notEarth.js).
 *
 * A NASA panorama, scaled to fill the height and dragged sideways, with
 * the far edge wrapping round to the near one. Every one of these is a
 * full circle shot from a fixed spot, so sideways is the only direction
 * there is to look, and that is the same thing Look Around gives you on
 * a No Move round.
 *
 * The view is held as a fraction of the way across the panorama rather
 * than a pixel offset, so zooming keeps what you were looking at in the
 * middle and a resized window does not throw the view somewhere else.
 *
 * Same handle as the Look Around pane, so the HUD's return-to-start and
 * zoom work here without knowing which kind of round is on.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const wrap = (f) => ((f % 1) + 1) % 1;

const NotEarthPane = forwardRef(function NotEarthPane({ place, roundKey, allowPan = true, allowZoom = true, onReady }, ref) {
  const frameRef = useRef(null);
  const start = Number.isFinite(place?.start) ? place.start : 0.5;
  const [centre, setCentre] = useState(start);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const dragRef = useRef(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // A new round is a new picture, at its own opening view.
  useEffect(() => {
    setCentre(start);
    setZoom(MIN_ZOOM);
    setLoaded(false);
  }, [roundKey, place?.src, start]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => setSize({ w: frame.clientWidth, h: frame.clientHeight });
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!place?.src) return undefined;
    let alive = true;
    const settle = () => {
      if (!alive) return;
      setLoaded(true);
      readyRef.current?.();
    };
    const img = new window.Image();
    img.onload = settle;
    // A picture we ship ourselves that will not decode is not something
    // the player can do anything about, so the round goes on and they
    // see the background rather than a spinner that never stops.
    img.onerror = settle;
    img.src = place.src;
    return () => {
      alive = false;
    };
  }, [place?.src]);

  /** Width of the panorama once it has been scaled to the pane's height. */
  const scaledWidth = size.h && place?.height ? (size.h * zoom * place.width) / place.height : 0;

  const moveBy = useCallback(
    (dx) => {
      if (!scaledWidth) return;
      setCentre((prev) => wrap(prev + dx / scaledWidth));
    },
    [scaledWidth]
  );

  useImperativeHandle(
    ref,
    () => ({
      returnToStart() {
        setCentre(start);
        setZoom(MIN_ZOOM);
      },
      zoomBy(delta) {
        if (!allowZoom) return;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta * 0.5)));
      },
    }),
    [allowZoom, start]
  );

  const onPointerDown = (event) => {
    if (!allowPan) return;
    dragRef.current = { x: event.clientX, id: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    moveBy(drag.x - event.clientX);
    dragRef.current = { ...drag, x: event.clientX };
  };
  const endDrag = (event) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  useEffect(() => {
    if (!allowPan) return undefined;
    const onKey = (event) => {
      if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const step = (size.w || 600) / 8;
      if (event.key === 'ArrowLeft') moveBy(-step);
      else if (event.key === 'ArrowRight') moveBy(step);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowPan, moveBy, size.w]);

  if (!place?.src) return null;

  // repeat-x tiles the panorama, so the left edge of the view can be
  // anywhere, including negative, and the far side wraps round.
  const left = scaledWidth ? centre * scaledWidth - size.w / 2 : 0;

  return (
    <div
      ref={frameRef}
      className={`absolute inset-0 overflow-hidden bg-ocean-950 ${allowPan ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-not-earth-pane
    >
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: loaded ? 1 : 0,
          backgroundImage: `url(${place.src})`,
          backgroundSize: `auto ${zoom * 100}%`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: `${-left}px center`,
        }}
      />
    </div>
  );
});

export default NotEarthPane;
