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
 * Muted Standard with points of interest turned off is as quiet as
 * MapKit gets. Apple still writes its own place names on the map and
 * there is no API to remove them, so the camera is held above
 * MIN_CAMERA_M: far enough out that the names on screen are countries
 * and large regions rather than streets, which is also as close as this
 * round is ever worth playing.
 *
 * Same contract as LeafletScriptMap, which is what the screen falls
 * back to when MapKit will not authorize: tap to pin, and on the reveal
 * draw every region the language is spoken in, the guess, and the line
 * between them.
 */

import { useEffect, useRef } from 'react';

const ANSWER = '#16a34a';
const GUESS = '#e08c0a';
const FILL_OPACITY = 0.22;
const STROKE_OPACITY = 0.95;

/**
 * The closest the camera may come, in metres from the ground. About a
 * 290 km view, which is where the old map stopped too: closer than that
 * the round stops being about a language and starts being about which
 * suburb, and Apple starts labelling towns.
 */
const MIN_CAMERA_M = 250000;

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

    try {
      map.showsPointsOfInterest = false;
    } catch {
      /* not on this build */
    }
    try {
      if (mapkit.CameraZoomRange) map.cameraZoomRange = new mapkit.CameraZoomRange(MIN_CAMERA_M);
    } catch {
      /* older MapKit: the round is playable, just zoomier */
    }
    map.region = worldRegion(mapkit);
    setInset(mapkit, map, GUESS_INSET);
    map.addEventListener('single-tap', (event) => {
      if (!interactiveRef.current) return;
      const coordinate = map.convertPointOnPageToCoordinate(event.pointOnPage);
      if (coordinate) onPinRef.current?.({ lat: coordinate.latitude, lng: coordinate.longitude });
    });
    mapRef.current = map;

    return () => {
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
            subtitle: 'Nearest place it is spoken',
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
