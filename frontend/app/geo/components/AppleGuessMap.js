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
import { cameraFor } from '../lib/mapCamera';

export default function AppleGuessMap({ mapkit, pin, onPin, results = [], mode = 'guess', interactive = true, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  // Every programmatic move goes through here: MapKit drops a move made
  // while another is still animating (lib/mapCamera.js).
  const cameraRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef({ annotations: [], overlays: [] });
  // Frames the camera on the drawn result again. Set while a result is
  // on the map, null while guessing, when the view is the player's.
  const fitRef = useRef(null);
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
    cameraRef.current = cameraFor(map);
    return () => {
      cameraRef.current?.stop();
      cameraRef.current = null;
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

  /*
   * The frame the map sits in changes size after the camera has been
   * placed: at the end of a game it eases its bottom edge up by half
   * the screen to make room for the summary (round.css). MapKit keeps
   * its zoom through a resize, so the view framed for the tall box was
   * cut down to its middle, and the answers of a five-round game were
   * off the edge of the one map meant to show them all. Once the box
   * settles, frame it again.
   */
  useEffect(() => {
    const node = containerRef.current;
    if (!mapkit || !node || typeof ResizeObserver === 'undefined') return undefined;
    let timer = 0;
    let last = { w: node.clientWidth, h: node.clientHeight };
    const observer = new ResizeObserver(() => {
      const now = { w: node.clientWidth, h: node.clientHeight };
      if (Math.abs(now.w - last.w) < 2 && Math.abs(now.h - last.h) < 2) return;
      last = now;
      clearTimeout(timer);
      timer = setTimeout(() => fitRef.current?.(), 140);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [mapkit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return undefined;
    const drawn = drawnRef.current;
    if (drawn.annotations.length) map.removeAnnotations(drawn.annotations);
    if (drawn.overlays.length) map.removeOverlays(drawn.overlays);
    drawnRef.current = { annotations: [], overlays: [] };
    fitRef.current = null;
    if (mode !== 'result' || !results.length) {
      // Through the camera: straight after a reveal the answer's framing
      // can still be moving, and a plain set would be dropped, leaving the
      // next round's map on the last answer.
      cameraRef.current?.move(worldRegion(mapkit), false);
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
    // A whole game on one map (the summary) has an answer per round. Five
    // pins all titled "Your guess" printed on top of each other, so there
    // the pins carry the round's number instead of a title, and the
    // colours say which is which. A single reveal keeps its titles, which
    // are its legend; so does a room, where the title is a player's name.
    const rounds = results.filter((r) => r.answer && (r.answerMarker ?? true)).length > 1;
    const titles = rounds ? { titleVisibility: mapkit.FeatureVisibility.Hidden } : {};
    results.forEach((r, i) => {
      // Solo play draws every answer; a room's reveal draws the one place
      // once (answerMarker) and every player's guess in their colour.
      if (r.answer && (r.answerMarker ?? true)) {
        answers.push(
          new mapkit.MarkerAnnotation(coordinate(r.answer), {
            color: '#22c55e',
            glyphText: r.answerLabel || r.label || String(i + 1),
            title: r.answerTitle || 'Where you were',
            ...titles,
          })
        );
      }
      if (r.guess) {
        guesses.push(
          new mapkit.MarkerAnnotation(coordinate(r.guess), {
            color: r.color || '#facc15',
            glyphText: r.color && r.label ? r.label : rounds ? String(i + 1) : undefined,
            title: r.title || 'Your guess',
            ...titles,
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

    // Frame the camera on every guess and answer before the line starts
    // to grow, so the view is set for where the line is going, not where
    // it starts, and the answer's pin lands inside it.
    map.addAnnotations(guesses);
    map.addOverlays(overlays);
    // Answers weigh double when the map cannot show everything
    // (regionAround): the answer is what the player came to see.
    const everything = results.flatMap((r) => [r.guess && { ...r.guess, weight: 1 }, r.answer && { ...r.answer, weight: 2 }]).filter(Boolean);
    const fit = (animate) => {
      if (!everything.length) return;
      const node = containerRef.current;
      const r = regionAround(everything, { width: node?.clientWidth || 0, height: node?.clientHeight || 0 });
      const center = new mapkit.Coordinate(r.lat, r.lng);
      cameraRef.current?.move(new mapkit.CoordinateRegion(center, new mapkit.CoordinateSpan(r.latSpan, r.lngSpan)), animate);
    };
    fit(true);
    fitRef.current = () => fit(true);
    const drawnOverlays = overlays;

    const setTip = (line, t) => {
      const tip = alongMercator(line.from, line.to, t);
      try {
        line.overlay.points = [coordinate(line.from), coordinate(tip)];
      } catch {
        /* a build that will not take new points keeps the full line */
      }
    };
    lines.forEach((line) => setTip(line, 0));
    drawnRef.current = { annotations: guesses, overlays: drawnOverlays };

    const land = () => {
      if (!mapRef.current) return;
      lines.forEach((line) => setTip(line, 1));
      // MarkerAnnotation drops in on its own when added (animates is on
      // by default), which is exactly the landing this wants.
      map.addAnnotations(answers);
      drawnRef.current = { annotations: [...guesses, ...answers], overlays: drawnOverlays };
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
    <div ref={containerRef} className="h-full w-full bg-pe-surface" />
  </KeyboardMap>;
}

/** How wide the world is, in pixels, with MapKit zoomed out as far as it goes. */
export const MAPKIT_WORLD_PX = 1024;

/**
 * The region that shows every point, the short way round, with room
 * for the pins at its edges.
 *
 * MapKit's showItems measured a line through the points west to east
 * without wrapping: answers in Utah and Brisbane made a region 265
 * degrees wide, which is more than a half-screen map can show at its
 * widest, so it was clamped around Africa and both answers were cut
 * off. The smallest arc of longitude that holds every point is found
 * from the largest gap between neighbouring longitudes, and it can
 * cross the Pacific. Padding is in pixels, like showItems' was.
 */
export function regionAround(points, { width = 0, height = 0, padding = 56, minimumSpan = 0.6, worldWidth = MAPKIT_WORLD_PX } = {}) {
  const wrap = (value) => ((((value + 180) % 360) + 360) % 360) - 180;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => wrap(p.lng)).sort((a, b) => a - b);
  let gap = lngs[0] + 360 - lngs[lngs.length - 1];
  let west = lngs[0];
  for (let i = 1; i < lngs.length; i += 1) {
    if (lngs[i] - lngs[i - 1] > gap) {
      gap = lngs[i] - lngs[i - 1];
      west = lngs[i];
    }
  }
  const lngSpan = 360 - gap;

  // MapKit zooms out no further than a world `worldWidth` pixels wide, so
  // a map `width` pixels wide shows at most 360 * width / worldWidth
  // degrees of longitude: about 135 on a phone. A world game's answers
  // can span more, and framed on the middle of them the phone's summary
  // showed open sea and hardly a pin. When they cannot all be shown,
  // frame the stretch that holds the most, weighing each point by its
  // `weight` (answers count double: they are what the player wants to see).
  if (width > 0 && lngSpan > (360 * width) / worldWidth) {
    const room = (360 * Math.max(width - padding * 2, width / 2)) / worldWidth;
    let best = null;
    for (const start of points) {
      const from = wrap(start.lng);
      const inside = points.filter((p) => (wrap(p.lng) - from + 360) % 360 <= room);
      const score = inside.reduce((sum, p) => sum + (p.weight ?? 1), 0);
      if (!best || score > best.score) best = { score, inside };
    }
    if (best.inside.length < points.length) {
      return regionAround(best.inside, { width, height, padding, minimumSpan, worldWidth });
    }
  }
  let lng = west + lngSpan / 2;
  if (lng > 180) lng -= 360;
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const grow = (size) => (size > padding * 3 ? size / (size - padding * 2) : 1.25);
  return {
    lat: (south + north) / 2,
    lng,
    latSpan: Math.min(170, Math.max(minimumSpan, (north - south) * grow(height))),
    lngSpan: Math.min(360, Math.max(minimumSpan, lngSpan * grow(width))),
  };
}

function worldRegion(mapkit) {
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(20, 0), new mapkit.CoordinateSpan(150, 300));
}
