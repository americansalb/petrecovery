'use client';

/**
 * The map a script round is answered on.
 *
 * Same tap-to-pin contract as the panorama game's guess map, with one
 * difference that is the whole point of the mode: the answer is not a
 * dot, it is an area. On the reveal this draws every heartland the
 * language has as a circle, so a player who pinned the wrong side of a
 * border can see that the language was on both sides of it. Punjabi
 * drawn as two discs teaches something a dropped pin never could.
 */

import { useEffect, useRef } from 'react';

const ANSWER = '#22c55e';
const GUESS = '#facc15';

export default function ScriptMap({ mapkit, pin, onPin, answer = null, guess = null, mode = 'guess', className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef({ annotations: [], overlays: [] });
  const onPinRef = useRef(onPin);
  const interactiveRef = useRef(mode === 'guess');
  onPinRef.current = onPin;
  interactiveRef.current = mode === 'guess';

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
      // Place labels are the answer key. A round whose sentence is in
      // Devanagari is not much of a puzzle if the map is captioned.
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

  // The pin the player is placing, while they are still placing it.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    if (pinRef.current) {
      map.removeAnnotation(pinRef.current);
      pinRef.current = null;
    }
    if (!pin || mode !== 'guess') return;
    pinRef.current = new mapkit.MarkerAnnotation(new mapkit.Coordinate(pin.lat, pin.lng), { color: GUESS, title: 'Your guess' });
    map.addAnnotation(pinRef.current);
  }, [mapkit, pin, mode]);

  // The reveal: where the language is spoken, and how far off the pin was.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    const drawn = drawnRef.current;
    if (drawn.annotations.length) map.removeAnnotations(drawn.annotations);
    if (drawn.overlays.length) map.removeOverlays(drawn.overlays);
    drawnRef.current = { annotations: [], overlays: [] };
    if (mode !== 'result' || !answer) {
      map.region = worldRegion(mapkit);
      return;
    }

    const annotations = [];
    const overlays = [];
    const style = new mapkit.Style({ lineWidth: 2, strokeColor: ANSWER, fillColor: ANSWER, fillOpacity: 0.22, strokeOpacity: 0.9 });
    for (const region of answer.regions || []) {
      overlays.push(new mapkit.CircleOverlay(new mapkit.Coordinate(region.lat, region.lng), region.radiusKm * 1000, { style }));
      annotations.push(
        new mapkit.MarkerAnnotation(new mapkit.Coordinate(region.lat, region.lng), {
          color: ANSWER,
          title: region.name,
          subtitle: answer.name,
        })
      );
    }
    if (guess) {
      annotations.push(new mapkit.MarkerAnnotation(new mapkit.Coordinate(guess.lat, guess.lng), { color: GUESS, title: 'Your guess' }));
      const nearest = nearestRegion(guess, answer.regions || []);
      if (nearest) {
        overlays.push(
          new mapkit.PolylineOverlay([new mapkit.Coordinate(guess.lat, guess.lng), new mapkit.Coordinate(nearest.lat, nearest.lng)], {
            style: new mapkit.Style({ lineWidth: 2, strokeColor: GUESS }),
          })
        );
      }
    }
    map.addAnnotations(annotations);
    map.addOverlays(overlays);
    drawnRef.current = { annotations, overlays };
    try {
      map.showItems([...annotations, ...overlays], { animate: true, padding: new mapkit.Padding(56, 56, 56, 56) });
    } catch {
      if (annotations[0]) map.center = annotations[0].coordinate;
    }
  }, [mapkit, answer, guess, mode]);

  return <div ref={containerRef} className={`h-full w-full bg-midnight-900 ${className}`} />;
}

/** Straight-line nearest by squared degrees: only used to draw a line. */
function nearestRegion(from, regions) {
  let best = null;
  let bestScore = Infinity;
  for (const region of regions) {
    const score = (region.lat - from.lat) ** 2 + (region.lng - from.lng) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = region;
    }
  }
  return best;
}

function worldRegion(mapkit) {
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(20, 0), new mapkit.CoordinateSpan(150, 300));
}
