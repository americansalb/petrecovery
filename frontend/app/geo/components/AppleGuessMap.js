'use client';

/**
 * The guess map for Apple games: a MapKit map, tap to place the pin,
 * result pairs drawn as annotations and a polyline. Same contract as
 * GoogleGuessMap so the play page does not care which it has.
 */

import { useEffect, useRef } from 'react';

export default function AppleGuessMap({ mapkit, pin, onPin, results = [], mode = 'guess', interactive = true, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef({ annotations: [], overlays: [] });
  const onPinRef = useRef(onPin);
  const interactiveRef = useRef(interactive);
  onPinRef.current = onPin;
  interactiveRef.current = interactive && mode === 'guess';

  useEffect(() => {
    if (!mapkit || !containerRef.current || mapRef.current) return undefined;
    const map = new mapkit.Map(containerRef.current, {
      showsCompass: mapkit.FeatureVisibility.Hidden,
      showsScale: mapkit.FeatureVisibility.Hidden,
      showsMapTypeControl: false,
      showsZoomControl: true,
      showsUserLocationControl: false,
      isRotationEnabled: false,
      colorScheme: mapkit.Map.ColorSchemes.Light,
    });
    try {
      map.showsPointsOfInterest = false;
    } catch {
      /* not on this build */
    }
    map.region = worldRegion(mapkit);
    map.addEventListener('single-tap', (event) => {
      if (!interactiveRef.current) return;
      const coordinate = map.convertPointOnPageToCoordinate(event.pointOnPage);
      if (coordinate) onPinRef.current?.({ lat: coordinate.latitude, lng: coordinate.longitude });
    });
    mapRef.current = map;
    return () => {
      try {
        map.destroy();
      } catch {
        /* gone */
      }
      mapRef.current = null;
    };
  }, [mapkit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    if (pinRef.current) {
      map.removeAnnotation(pinRef.current);
      pinRef.current = null;
    }
    if (!pin || mode !== 'guess') return;
    pinRef.current = new mapkit.MarkerAnnotation(new mapkit.Coordinate(pin.lat, pin.lng), { color: '#facc15', title: 'Your guess' });
    map.addAnnotation(pinRef.current);
  }, [mapkit, pin, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    const drawn = drawnRef.current;
    if (drawn.annotations.length) map.removeAnnotations(drawn.annotations);
    if (drawn.overlays.length) map.removeOverlays(drawn.overlays);
    drawnRef.current = { annotations: [], overlays: [] };
    if (mode !== 'result' || !results.length) {
      map.region = worldRegion(mapkit);
      return;
    }
    const annotations = [];
    const overlays = [];
    results.forEach((r, i) => {
      // Solo play draws every answer; a room's reveal draws the one place
      // once (answerMarker) and every player's guess in their colour.
      if (r.answer && (r.answerMarker ?? true)) {
        annotations.push(
          new mapkit.MarkerAnnotation(new mapkit.Coordinate(r.answer.lat, r.answer.lng), {
            color: '#22c55e',
            glyphText: r.answerLabel || r.label || String(i + 1),
            title: r.answerTitle || 'Where you were',
          })
        );
      }
      if (r.guess) {
        annotations.push(
          new mapkit.MarkerAnnotation(new mapkit.Coordinate(r.guess.lat, r.guess.lng), {
            color: r.color || '#facc15',
            glyphText: r.color && r.label ? r.label : undefined,
            title: r.title || 'Your guess',
          })
        );
      }
      if (r.guess && r.answer) {
        overlays.push(
          new mapkit.PolylineOverlay(
            [new mapkit.Coordinate(r.guess.lat, r.guess.lng), new mapkit.Coordinate(r.answer.lat, r.answer.lng)],
            { style: new mapkit.Style({ lineWidth: 2, strokeColor: r.color || '#facc15' }) }
          )
        );
      }
    });
    map.addAnnotations(annotations);
    map.addOverlays(overlays);
    drawnRef.current = { annotations, overlays };
    try {
      map.showItems([...annotations, ...overlays], { animate: true, padding: new mapkit.Padding(48, 48, 48, 48) });
    } catch {
      /* single item; fall back to centring on it */
      if (annotations[0]) map.center = annotations[0].coordinate;
    }
  }, [mapkit, results, mode]);

  return <div ref={containerRef} className={`h-full w-full bg-midnight-900 ${className}`} />;
}

function worldRegion(mapkit) {
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(20, 0), new mapkit.CoordinateSpan(150, 300));
}
