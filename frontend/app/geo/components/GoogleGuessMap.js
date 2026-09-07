'use client';

/**
 * The guess map for Google games. One Google Map for the whole game
 * (each map instance is a billable load), moved between the corner and
 * the results panel by its container's size, never re-created.
 *
 * mode 'guess': click places the pin.
 * mode 'result': draws guess/answer pairs with lines and fits them.
 */

import { useEffect, useRef } from 'react';

const WORLD = { center: { lat: 20, lng: 0 }, zoom: 1 };

function circleIcon(api, fill) {
  return {
    path: api.maps.SymbolPath.CIRCLE,
    scale: 9,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#0f172a',
    strokeWeight: 2,
  };
}

export default function GoogleGuessMap({ api, pin, onPin, results = [], mode = 'guess', interactive = true, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef([]);
  const boundsRef = useRef(null);
  const onPinRef = useRef(onPin);
  const interactiveRef = useRef(interactive);
  onPinRef.current = onPin;
  interactiveRef.current = interactive && mode === 'guess';

  // Create once; kept across React strict mode's double mount in
  // development, rebuilt only if the container element changed.
  useEffect(() => {
    if (!api || !containerRef.current) return;
    if (mapRef.current && mapRef.current.__container === containerRef.current) return;
    const map = new api.Map(containerRef.current, {
      ...WORLD,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
      minZoom: 1,
      keyboardShortcuts: false,
      backgroundColor: '#0f172a',
    });
    map.addListener('click', (event) => {
      if (!interactiveRef.current || !event.latLng) return;
      onPinRef.current?.({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
    map.__container = containerRef.current;
    mapRef.current = map;
  }, [api]);

  // The container changes size as the map moves between the corner and
  // the results panel; tell the map, and keep results in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!api || !map || !containerRef.current) return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        api.event.trigger(map, 'resize');
        if (boundsRef.current) map.fitBounds(boundsRef.current, 48);
      });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [api]);

  // The pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!api || !map) return;
    if (!pin || mode !== 'guess') {
      pinRef.current?.setMap(null);
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      pinRef.current = new api.Marker({ map, position: pin, icon: circleIcon(api, '#facc15'), zIndex: 20 });
    } else {
      pinRef.current.setPosition(pin);
    }
  }, [api, pin, mode]);

  // Results.
  useEffect(() => {
    const map = mapRef.current;
    if (!api || !map) return;
    for (const item of drawnRef.current) item.setMap(null);
    drawnRef.current = [];
    boundsRef.current = null;

    if (mode !== 'result' || !results.length) {
      map.setCenter(WORLD.center);
      map.setZoom(WORLD.zoom);
      return;
    }

    const bounds = new api.LatLngBounds();
    results.forEach((r, i) => {
      // Items may share one answer (a room reveal): draw its marker once.
      if (r.answer && r.answerMarker !== false) {
        const label = r.answerLabel || (r.label && !r.color ? r.label : String(i + 1));
        drawnRef.current.push(
          new api.Marker({
            map,
            position: r.answer,
            icon: circleIcon(api, '#22c55e'),
            label: { text: label, color: '#0f172a', fontSize: '11px', fontWeight: '700' },
            zIndex: 30,
            title: r.answerTitle || 'Where you were',
          })
        );
        bounds.extend(r.answer);
      }
      if (r.guess) {
        drawnRef.current.push(
          new api.Marker({
            map,
            position: r.guess,
            icon: circleIcon(api, r.color || '#facc15'),
            label: r.color && r.label ? { text: r.label, color: '#0f172a', fontSize: '10px', fontWeight: '700' } : undefined,
            zIndex: 25,
            title: r.title || 'Your guess',
          })
        );
        bounds.extend(r.guess);
      }
      if (r.guess && r.answer) {
        drawnRef.current.push(
          new api.Polyline({
            map,
            path: [r.guess, r.answer],
            geodesic: true,
            strokeColor: r.color || '#facc15',
            strokeOpacity: 0.9,
            strokeWeight: 2,
          })
        );
      }
    });
    if (!bounds.isEmpty()) {
      boundsRef.current = bounds;
      map.fitBounds(bounds, 48);
      const single = results.length === 1 && !(results[0].guess && results[0].answer);
      if (single) map.setZoom(Math.min(map.getZoom() || 5, 6));
    }
  }, [api, results, mode]);

  return <div ref={containerRef} className={`h-full w-full bg-midnight-900 ${className}`} />;
}
