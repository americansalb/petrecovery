'use client';

/**
 * The script game's map, on Apple Maps.
 *
 * The round asks where a language is spoken, so the map has to be
 * readable at country scale and has to take a tap anywhere on Earth.
 * Apple draws it. The game already loads MapKit for Look Around, the
 * token covers 250,000 map views a day, and Apple's cartography is what
 * a player expects a map to look like: the alternative this screen
 * shipped with was the world drawn from the bundled Natural Earth
 * outlines, which is keyless and honest and looks like a woodcut.
 *
 * Apple's tiles are Apple's. Their terms do not allow storing or
 * re-serving them, so there is no cache to build and no static image to
 * bake: a view is a view, which is what the quota is for.
 *
 * **Apple's own place names are off**, which is the whole reason this
 * map can be used for this round at all. `map.labels = false` stops the
 * tiles carrying any text, and points of interest are off separately.
 * It matters more here than anywhere else in the game: half the answers
 * in the South Asia pool are named after the state they are spoken in,
 * so a map that writes "Tamil Nadu", "Punjab" or "Gujarat" on itself
 * has answered the round before the player has.
 *
 * What is written instead are country names, and nothing smaller: the
 * game's own labels, from Natural Earth's label anchors, at the zooms
 * its cartographers set. Reading a country from its silhouette is a
 * different game and a worse one; reading a language off a state label
 * is not a game at all.
 *
 * Same contract as LeafletScriptMap, which is what the screen falls
 * back to when MapKit will not authorize: tap to pin, and on the reveal
 * draw every region the language is spoken in, the guess, and the line
 * between them.
 */

import { useEffect, useRef } from 'react';
import { chooseLabels } from '../../lib/countryLabels';

/** The country names, fetched once per page and cached like any chunk. */
let labelsPromise = null;
function loadLabels() {
  if (!labelsPromise) {
    labelsPromise = import('@/app/lib/geo/data/country-labels.json').then((mod) => (mod.default || mod).labels || []);
    // A failed load is not cached: the next mount tries again.
    labelsPromise.catch(() => {
      labelsPromise = null;
    });
  }
  return labelsPromise;
}

const ANSWER = '#16a34a';
const GUESS = '#e08c0a';
const FILL_OPACITY = 0.22;
const STROKE_OPACITY = 0.95;

/**
 * How much of the bottom of the map the reveal panel owns. Insetting
 * the map by it keeps Apple's logo and legal link above the panel,
 * which their terms require, and lands the answer where it can be seen.
 */
const REVEAL_INSET = 230;
/** The same, for the Guess button in the corner of a round in play. */
const GUESS_INSET = 76;

export default function AppleScriptMap({
  mapkit,
  pin,
  onPin,
  answer = null,
  guess = null,
  nearestPoint = null,
  mode = 'guess',
  className = '',
  onUnavailable,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef({ annotations: [], overlays: [] });
  const stopFadeRef = useRef(null);
  const onPinRef = useRef(onPin);
  const onUnavailableRef = useRef(onUnavailable);
  const interactiveRef = useRef(mode === 'guess');
  onPinRef.current = onPin;
  onUnavailableRef.current = onUnavailable;
  interactiveRef.current = mode === 'guess';

  useEffect(() => {
    if (!mapkit || !hostRef.current || mapRef.current) return undefined;

    let map;
    try {
      const options = {
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsScale: mapkit.FeatureVisibility.Hidden,
        showsMapTypeControl: false,
        showsZoomControl: true,
        showsUserLocationControl: false,
        isRotationEnabled: false,
        colorScheme: mapkit.Map.ColorSchemes.Light,
      };
      // Muted Standard is the one meant to be drawn on top of: the same
      // roads and coastlines, held back so the answer reads over them.
      if (mapkit.Map.MapTypes?.MutedStandard) options.mapType = mapkit.Map.MapTypes.MutedStandard;
      map = new mapkit.Map(hostRef.current, options);
    } catch {
      // A map that cannot be built is a round that cannot be answered.
      onUnavailableRef.current?.();
      return undefined;
    }

    // No text from Apple at all, at any zoom. The round is which
    // language, and in South Asia a state name is the answer.
    map.labels = false;
    try {
      map.showsPointsOfInterest = false;
    } catch {
      /* not on this build */
    }
    map.region = worldRegion(mapkit);
    setInset(mapkit, map, GUESS_INSET);
    map.addEventListener('single-tap', (event) => {
      if (!interactiveRef.current) return;
      const coordinate = map.convertPointOnPageToCoordinate(event.pointOnPage);
      if (coordinate) onPinRef.current?.({ lat: coordinate.latitude, lng: coordinate.longitude });
    });
    mapRef.current = map;

    // The names the map does carry. Loaded late and drawn when they
    // land, the way tiles stream in: a tap before then is still a tap
    // on the map, and 10 KB of label anchors holds nothing up.
    let stopLabels = null;
    loadLabels()
      .then((rows) => {
        if (mapRef.current !== map) return;
        stopLabels = addLabels(mapkit, map, rows, hostRef.current);
      })
      .catch(() => {
        /* a map with no names is harder, not broken */
      });

    return () => {
      stopLabels?.();
      stopFadeRef.current?.();
      try {
        map.destroy();
      } catch {
        /* gone */
      }
      mapRef.current = null;
    };
  }, [mapkit]);

  // The pin being placed.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    if (pinRef.current) {
      map.removeAnnotation(pinRef.current);
      pinRef.current = null;
    }
    if (!pin || mode !== 'guess') return;
    pinRef.current = new mapkit.MarkerAnnotation(new mapkit.Coordinate(pin.lat, pin.lng), {
      color: GUESS,
      title: 'Your guess',
    });
    map.addAnnotation(pinRef.current);
  }, [mapkit, pin, mode]);

  // The reveal: where the language is spoken, and how far off the pin was.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapkit || !map) return;
    stopFadeRef.current?.();
    const previous = drawnRef.current;
    if (previous.annotations.length) map.removeAnnotations(previous.annotations);
    if (previous.overlays.length) map.removeOverlays(previous.overlays);
    drawnRef.current = { annotations: [], overlays: [] };
    setInset(mapkit, map, mode === 'result' ? REVEAL_INSET : GUESS_INSET);
    if (mode !== 'result' || !answer) {
      map.region = worldRegion(mapkit);
      return;
    }

    // One style object for every piece of the answer, so the fade below
    // is one number to move rather than several hundred.
    const style = answerStyle(mapkit, FILL_OPACITY, STROKE_OPACITY);
    const overlays = [];
    const annotations = [];
    for (const region of answer.regions || []) {
      // Each ring is its own piece of land and never a hole: the data
      // keeps outer rings only (app/lib/geo/server/regions.js), so an
      // island is a shape of its own rather than a bite out of a coast.
      const rings = region.rings || [];
      if (rings.length) {
        for (const ring of rings) {
          overlays.push(
            new mapkit.PolygonOverlay(ring.map(([lng, lat]) => new mapkit.Coordinate(lat, lng)), {
              style,
              data: { name: region.name },
            })
          );
        }
      } else if (Number.isFinite(region.radiusKm)) {
        overlays.push(
          new mapkit.CircleOverlay(new mapkit.Coordinate(region.lat, region.lng), region.radiusKm * 1000, {
            style,
            data: { name: region.name },
          })
        );
      }
    }
    if (guess) {
      annotations.push(
        new mapkit.MarkerAnnotation(new mapkit.Coordinate(guess.lat, guess.lng), { color: GUESS, title: 'Your guess' })
      );
      // To the nearest point on the region's edge when the server
      // measured one, which is where the language actually starts;
      // otherwise to the nearest region's middle.
      const nearest = nearestPoint || nearestRegion(guess, answer.regions || []);
      if (nearest) {
        annotations.push(
          new mapkit.MarkerAnnotation(new mapkit.Coordinate(nearest.lat, nearest.lng), {
            color: ANSWER,
            title: answer.name,
            subtitle: 'Nearest place it is used',
          })
        );
        overlays.push(
          new mapkit.PolylineOverlay(
            [new mapkit.Coordinate(guess.lat, guess.lng), new mapkit.Coordinate(nearest.lat, nearest.lng)],
            { style: new mapkit.Style({ lineWidth: 2.5, strokeColor: GUESS, lineDash: [6, 6] }) }
          )
        );
      }
    }

    if (overlays.length) map.addOverlays(overlays);
    if (annotations.length) map.addAnnotations(annotations);
    drawnRef.current = { annotations, overlays };

    try {
      map.showItems([...annotations, ...overlays], {
        animate: true,
        // Small and even: the bottom of the map is already inset by
        // map.padding above, so the panel's room is counted once.
        padding: new mapkit.Padding(44, 44, 44, 44),
        minimumSpan: new mapkit.CoordinateSpan(1.2, 1.2),
      });
    } catch {
      /* one item, or a build without showItems: centre on it instead */
      if (annotations[0]) map.center = annotations[0].coordinate;
    }
    stopFadeRef.current = fadeIn(mapkit, style, overlays);

    return () => stopFadeRef.current?.();
  }, [mapkit, answer, guess, nearestPoint, mode]);

  return (
    <div
      ref={hostRef}
      className={`h-full w-full ${className}`}
      data-script-map="apple"
      data-map-mode={mode}
    />
  );
}

/**
 * The answer arrives rather than appears.
 *
 * MapKit draws overlays onto a canvas, so there is no element for CSS to
 * animate the way the Leaflet map draws its outline on. Ramping the one
 * shared style instead costs a single number per frame, and the camera
 * flight started just above is already repainting every frame; the last
 * value is pushed back onto each overlay so it lands even if the flight
 * finished first.
 *
 * Returns the way to stop it, because the round it belongs to can end
 * mid-flight and a frame that fires after the map is gone is an error
 * in the console.
 */
function fadeIn(mapkit, style, overlays) {
  const noop = () => {};
  if (!overlays.length) return noop;
  // The last value arrives as a new Style rather than as new numbers on
  // the old one: MapKit redraws an overlay when its style is replaced,
  // and replacing a style with the very same object may read as no
  // change at all.
  const settle = () => {
    const done = answerStyle(mapkit, FILL_OPACITY, STROKE_OPACITY);
    for (const overlay of overlays) overlay.style = done;
  };
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    settle();
    return noop;
  }
  const duration = 900;
  const started = performance.now();
  style.fillOpacity = 0;
  style.strokeOpacity = 0;
  let frame = 0;
  const step = (now) => {
    const t = Math.min(1, (now - started) / duration);
    // The outline first, the fill behind it, same order as the drawn
    // outline on the keyless map.
    style.strokeOpacity = STROKE_OPACITY * Math.min(1, t * 2);
    style.fillOpacity = FILL_OPACITY * t;
    if (t < 1) {
      frame = requestAnimationFrame(step);
      return;
    }
    settle();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/**
 * Country names, and only country names.
 *
 * The same 10 KB of Natural Earth label anchors the keyless map draws
 * from, and the same two rules, both in app/geo/lib/countryLabels.js:
 * each name appears between the zoom Natural Earth's cartographers set
 * for it and the zoom they stop it at, and a name whose box would land
 * on a name already placed is not drawn until there is room. Without
 * the second rule the world at its starting zoom writes UNITED KINGDOM
 * through GERMANY through FRANCE, which is where those countries are
 * and not how a map reads.
 *
 * Added and removed rather than hidden, so the page holds the few
 * dozen labels that are on screen instead of all two hundred.
 */
function addLabels(mapkit, map, rows, host) {
  const entries = rows.map((row) => {
    const annotation = new mapkit.Annotation(
      new mapkit.Coordinate(row.y, row.x),
      () => {
        const el = document.createElement('span');
        el.className = `wg-country-label wg-country-label--map${row.z <= 2 ? ' wg-country-label--big' : ''}`;
        el.textContent = row.n;
        return el;
      },
      // Not a thing to tap: a tap anywhere on the map is a pin, and a
      // label that swallowed one would read as the map ignoring you.
      { animates: false, enabled: false, calloutEnabled: false }
    );
    try {
      // MapKit hangs a custom annotation by its bottom edge; nudge it
      // down so the name sits on its anchor rather than above it.
      annotation.anchorOffset = new DOMPoint(0, 7);
    } catch {
      /* no DOMPoint on this browser: the name rides a little high */
    }
    return { row, annotation };
  });

  const shown = new Set();
  const sync = () => {
    const box = host?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    // MapKit answers in page coordinates; the chooser works in the
    // map's own, so the host's corner comes off each point.
    const project = (lat, lng) => {
      try {
        const point = map.convertCoordinateToPointOnPage(new mapkit.Coordinate(lat, lng));
        return point ? { x: point.x - box.left, y: point.y - box.top } : null;
      } catch {
        return null;
      }
    };
    const kept = new Set(
      chooseLabels(rows, { zoom: zoomOf(map, host), width: box.width, height: box.height, project })
    );
    const add = [];
    const drop = [];
    for (const entry of entries) {
      const wanted = kept.has(entry.row);
      if (wanted === shown.has(entry)) continue;
      if (wanted) {
        add.push(entry.annotation);
        shown.add(entry);
      } else {
        drop.push(entry.annotation);
        shown.delete(entry);
      }
    }
    if (drop.length) map.removeAnnotations(drop);
    if (add.length) map.addAnnotations(add);
  };

  map.addEventListener('region-change-end', sync);
  sync();
  return () => {
    try {
      map.removeEventListener('region-change-end', sync);
      if (shown.size) map.removeAnnotations([...shown].map((entry) => entry.annotation));
    } catch {
      /* the map is already gone */
    }
  };
}

/**
 * Where the map is on the scale the label rules are written in: the web
 * mercator tile zoom, where the whole world is 256 * 2^z pixels across.
 * MapKit thinks in a coordinate span and a camera distance instead, so
 * this converts, and the answer depends on how wide the map is drawn.
 */
function zoomOf(map, host) {
  const width = host?.clientWidth || 1024;
  const span = map.region?.span?.longitudeDelta || 360;
  return Math.log2((360 / Math.max(span, 0.0001)) * (width / 256));
}

function answerStyle(mapkit, fillOpacity, strokeOpacity) {
  return new mapkit.Style({
    strokeColor: ANSWER,
    strokeOpacity,
    lineWidth: 2,
    lineJoin: 'round',
    fillColor: ANSWER,
    fillOpacity,
  });
}

/** Keep Apple's logo and legal link clear of whatever covers the map. */
function setInset(mapkit, map, bottom) {
  try {
    map.padding = new mapkit.Padding(0, 0, bottom, 0);
  } catch {
    /* not on this build: the logo may sit under the panel */
  }
}

function worldRegion(mapkit) {
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(20, 0), new mapkit.CoordinateSpan(150, 300));
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
