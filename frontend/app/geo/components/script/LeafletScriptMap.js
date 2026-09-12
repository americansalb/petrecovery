'use client';

/**
 * The script game's map, drawn from data the game already ships.
 *
 * Every other map in the game belongs to an imagery provider: showing
 * Street View obliges you to put the pin on a Google map, and Look
 * Around obliges MapKit. A script round shows a sentence, so it owes
 * neither of them anything, and using their maps anyway costs something
 * real: the MapKit token this repository ships is locked to the
 * reunitepets.org origin, so on localhost, on a preview deployment, or
 * on any other domain the map does not authorise and the round cannot
 * be answered.
 *
 * This used to be Leaflet on CARTO's raster tiles, which were free
 * without a key until they were not: in September 2026 every tile came
 * back stamped "API KEY REQUIRED". A world outline with no labels needs
 * no tile server at all. The country polygons the server already scores
 * with (Natural Earth 1:110m, the world-atlas package) are drawn here as
 * vector shapes: one 108 KB file in the game's own bundle, fetched once
 * and cached like any other chunk. No key, no account, no quota, and
 * nothing fetched from anyone while a round is played. Labels stay off,
 * because a captioned map answers the round.
 *
 * Same contract as ScriptMap so the play client does not care which it
 * has: tap to pin, and on the reveal draw the language's heartlands as
 * circles, because the answer is an area rather than a point.
 *
 * If the outline chunk cannot be loaded (a captive network on a first
 * visit), a latitude and longitude grid is drawn in its place and
 * `onMapTrouble` fires so the screen can say so. A round on a grid is
 * harder than a round on a map, but it is still a round; a round on an
 * empty rectangle is a bug report.
 */

import 'leaflet/dist/leaflet.css';
// Ours, after Leaflet's, so the dark overrides win on order as well as
// on specificity. Here rather than in the pet site's globals.css so it
// travels with the component.
import './leaflet-script-map.css';
import { useEffect, useRef } from 'react';

const ANSWER = '#22c55e';
const GUESS = '#facc15';
// Land on the dark sea the stylesheet paints: lighter than the water,
// borders a shade lighter again so countries read as shapes.
const LAND = { fillColor: '#2a3a52', fillOpacity: 1, color: '#5b6f8c', weight: 0.6, opacity: 1 };
const MIN_ZOOM = 1;
// 1:110m coastlines are simplified; past this they read as polygons
// rather than coasts, and nothing in the round needs closer.
const MAX_ZOOM = 7;

/**
 * The world's outline, loaded once per page. The same polygons the
 * server scores with, so what the player pins on is what the answer is
 * measured against.
 */
let worldPromise = null;
function loadWorld() {
  if (!worldPromise) {
    worldPromise = Promise.all([import('world-atlas/countries-110m.json'), import('topojson-client')]).then(([atlas, topojson]) => {
      const topology = atlas.default || atlas;
      return topojson.feature(topology, topology.objects.countries);
    });
    // A failed load is not cached: the next mount tries again.
    worldPromise.catch(() => {
      worldPromise = null;
    });
  }
  return worldPromise;
}

/** A marker that needs no image file, so there are no 404s for Leaflet's default icons. */
function dot(L, color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)" title="${label}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function LeafletScriptMap({ pin, onPin, answer = null, guess = null, mode = 'guess', className = '', onMapTrouble }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef([]);
  const onPinRef = useRef(onPin);
  const onTroubleRef = useRef(onMapTrouble);
  const interactiveRef = useRef(mode === 'guess');
  onPinRef.current = onPin;
  onTroubleRef.current = onMapTrouble;
  interactiveRef.current = mode === 'guess';

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current || mapRef.current) return undefined;
    let cancelled = false;
    Promise.all([import('leaflet'), loadWorld().catch(() => null)]).then(([mod, world]) => {
      const L = mod.default || mod;
      if (cancelled || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, {
        // The world once, not tiled sideways forever: a pin at the same
        // place on a repeated world would score differently.
        worldCopyJump: false,
        maxBounds: [[-85, -180], [85, 180]],
        maxBoundsViscosity: 1,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Leaflet puts zoom at top-left, which is exactly where the
        // round's HUD pill sits; it overlapped and clipped it.
        zoomControl: false,
        attributionControl: true,
      }).setView([20, 0], 2);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      if (world) {
        // Land on its own canvas: a few thousand vertices pan and zoom
        // faster there than as SVG, and it is not interactive, so a tap
        // on a country is a tap on the map. The pin and the reveal's
        // circles stay SVG, where their tooltips live.
        L.geoJSON(world, {
          style: LAND,
          interactive: false,
          renderer: L.canvas({ padding: 0.5 }),
          attribution: 'Natural Earth',
        }).addTo(map);
      } else {
        drawGraticule(L, map);
        onTroubleRef.current?.();
      }

      map.on('click', (event) => {
        if (!interactiveRef.current) return;
        onPinRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      leafletRef.current = L;
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      try {
        // stop() before remove(): a pan or zoom still animating will
        // fire its transitionend after the panes are gone and throw
        // reading _leaflet_pos off an undefined pane. Reproduced by
        // finishing a game, where the reveal's fit was still running
        // when the summary replaced the map.
        mapRef.current?.stop();
        mapRef.current?.remove();
      } catch {
        /* already gone */
      }
      mapRef.current = null;
    };
  }, []);

  // The pin being placed.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (pinRef.current) {
      map.removeLayer(pinRef.current);
      pinRef.current = null;
    }
    if (!pin || mode !== 'guess') return;
    pinRef.current = L.marker([pin.lat, pin.lng], { icon: dot(L, GUESS, 'Your guess'), keyboard: false }).addTo(map);
  }, [pin, mode]);

  // The reveal: where the language is spoken, and how far off the pin was.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    for (const layer of drawnRef.current) map.removeLayer(layer);
    drawnRef.current = [];
    if (mode !== 'result' || !answer) return;

    const drawn = [];
    for (const region of answer.regions || []) {
      drawn.push(
        L.circle([region.lat, region.lng], {
          radius: region.radiusKm * 1000,
          color: ANSWER,
          weight: 2,
          fillColor: ANSWER,
          fillOpacity: 0.2,
        })
          .addTo(map)
          .bindTooltip(`${region.name} (${answer.name})`)
      );
    }
    if (guess) {
      drawn.push(L.marker([guess.lat, guess.lng], { icon: dot(L, GUESS, 'Your guess'), keyboard: false }).addTo(map));
      const nearest = nearestRegion(guess, answer.regions || []);
      if (nearest) {
        drawn.push(
          L.polyline(
            [
              [guess.lat, guess.lng],
              [nearest.lat, nearest.lng],
            ],
            { color: GUESS, weight: 2, dashArray: '6 6' }
          ).addTo(map)
        );
      }
    }
    drawnRef.current = drawn;

    try {
      const group = L.featureGroup(drawn);
      const bounds = group.getBounds();
      // Not animated. A reveal wants the answer on screen at once, and an
      // animated fit is a timer that can outlive this component: the last
      // round's fit was still flying when the summary unmounted the map.
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: MAX_ZOOM, animate: false });
    } catch {
      /* one layer, or none: leave the view alone */
    }
  }, [answer, guess, mode]);

  // The reveal's panel owns the bottom of the screen, and the zoom
  // control sat on top of it. Nothing needs zooming during a reveal:
  // the map has already fitted itself to the answer.
  return <div ref={hostRef} className={`h-full w-full ${className}`} data-script-map="leaflet" data-map-mode={mode} />;
}

/**
 * A bare latitude and longitude grid, drawn when the outline does not
 * load.
 *
 * It is not a map, but it is not nothing: the equator, the tropics and
 * the meridians are enough to place a pin roughly where you mean, so a
 * round stays answerable on a network that lost the one chunk.
 */
function drawGraticule(L, map) {
  const line = (points, weight, color) => L.polyline(points, { color, weight, opacity: 0.55, interactive: false }).addTo(map);
  for (let lng = -180; lng <= 180; lng += 30) {
    line([[-85, lng], [85, lng]], lng === 0 ? 1.5 : 0.75, lng === 0 ? '#94a3b8' : '#475569');
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    line([[lat, -180], [lat, 180]], lat === 0 ? 1.5 : 0.75, lat === 0 ? '#94a3b8' : '#475569');
  }
  // The tropics, which are where most of the world's languages are.
  for (const lat of [23.44, -23.44]) line([[lat, -180], [lat, 180]], 0.75, '#3f4a5a');
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
