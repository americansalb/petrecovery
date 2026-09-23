'use client';

/**
 * The guess map for Apple games: a MapKit map, tap to place the pin,
 * result pairs drawn as annotations and a polyline. Same contract as
 * the play page and a room, so neither has to know how a map is made.
 */

import { useEffect, useRef } from 'react';
import KeyboardMap from './KeyboardMap';
import { appleKeyboard } from '../lib/mapKeyboard';
import { REVEAL, alongMercator, easeInOut, playTimeline } from '../lib/motion';

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
    if (!mapkit || !map) return undefined;
    const drawn = drawnRef.current;
    if (drawn.annotations.length) map.removeAnnotations(drawn.annotations);
    if (drawn.overlays.length) map.removeOverlays(drawn.overlays);
    drawnRef.current = { annotations: [], overlays: [] };
    if (mode !== 'result' || !results.length) {
      map.region = worldRegion(mapkit);
      return undefined;
    }

    /*
     * The reveal, in the order a player should see it.
     *
     * Everything below used to be added in one go - both pins, the line
     * and the camera move - so the answer was simply there, one frame
     * after the guess, with the line already drawn. Measured on the live
     * site, the whole reveal landed inside a single frame. Now:
     *
     *   your pin is where you left it, from the start;
     *   the camera frames the guess and the answer together;
     *   the line leaves your pin and travels to the answer;
     *   the answer's pin drops when the line reaches it.
     *
     * The timing is REVEAL (lib/motion.js), the same clock the score
     * counts up on, so the number lands as the pin does.
     */
    const coordinate = (point) => new mapkit.Coordinate(point.lat, point.lng);
    const guesses = [];
    const answers = [];
    const lines = [];
    results.forEach((r, i) => {
      // Solo play draws every answer; a room's reveal draws the one place
      // once (answerMarker) and every player's guess in their colour.
      if (r.answer && (r.answerMarker ?? true)) {
        answers.push(
          new mapkit.MarkerAnnotation(coordinate(r.answer), {
            color: '#22c55e',
            glyphText: r.answerLabel || r.label || String(i + 1),
            title: r.answerTitle || 'Where you were',
          })
        );
      }
      if (r.guess) {
        guesses.push(
          new mapkit.MarkerAnnotation(coordinate(r.guess), {
            color: r.color || '#facc15',
            glyphText: r.color && r.label ? r.label : undefined,
            title: r.title || 'Your guess',
            // It is the pin the player just put down. It does not drop
            // in a second time.
            animates: false,
          })
        );
      }
      if (r.guess && r.answer) {
        lines.push({
          from: r.guess,
          to: r.answer,
          overlay: new mapkit.PolylineOverlay(
            [coordinate(r.guess), coordinate(r.answer)],
            { style: new mapkit.Style({ lineWidth: 3, strokeColor: r.color || '#facc15', lineCap: 'round' }) }
          ),
        });
      }
    });
    const overlays = lines.map((line) => line.overlay);

    // Frame the camera on the whole line before shortening it: showItems
    // reads the overlays' extent when it is called, so the view is set
    // for where the line is going, not where it starts.
    map.addAnnotations(guesses);
    map.addOverlays(overlays);
    try {
      // minimumSpan or a guess 40 m from the answer fills the screen
      // with one roof, which tells a player nothing about where they
      // were. Roughly half a degree, so the reveal always shows enough
      // ground to recognise.
      map.showItems([...guesses, ...overlays, ...(overlays.length ? [] : answers)], {
        animate: true,
        padding: new mapkit.Padding(56, 56, 56, 56),
        minimumSpan: new mapkit.CoordinateSpan(0.6, 0.6),
      });
    } catch {
      /* single item; fall back to centring on it */
      const first = guesses[0] || answers[0];
      if (first) map.center = first.coordinate;
    }

    const setTip = (line, t) => {
      const tip = alongMercator(line.from, line.to, t);
      try {
        line.overlay.points = [coordinate(line.from), coordinate(tip)];
      } catch {
        /* a build that will not take new points keeps the full line */
      }
    };
    lines.forEach((line) => setTip(line, 0));
    drawnRef.current = { annotations: guesses, overlays };

    const land = () => {
      if (!mapRef.current) return;
      lines.forEach((line) => setTip(line, 1));
      // MarkerAnnotation drops in on its own when added (animates is on
      // by default), which is exactly the landing this wants.
      map.addAnnotations(answers);
      drawnRef.current = { annotations: [...guesses, ...answers], overlays };
    };

    // A round with no guess (time ran out) has no line to wait for.
    if (!lines.length) {
      land();
      return undefined;
    }
    return playTimeline({
      delay: REVEAL.lineDelayMs,
      duration: REVEAL.lineMs,
      ease: easeInOut,
      frame: (t) => lines.forEach((line) => setTip(line, t)),
      done: land,
    });
  }, [mapkit, results, mode]);

  return <KeyboardMap className={className} interactive={interactive && mode === 'guess' && Boolean(onPin)} label={mode === 'guess' ? 'Guess map' : 'Answer map'} {...appleKeyboard(mapRef, mapkit, onPin)}>
    <div ref={containerRef} className="h-full w-full bg-ocean-900" />
  </KeyboardMap>;
}

function worldRegion(mapkit) {
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(20, 0), new mapkit.CoordinateSpan(150, 300));
}
