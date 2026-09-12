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
 * back stamped "API KEY REQUIRED". A world outline needs no tile
 * server. The country polygons the server already scores with (Natural
 * Earth 1:110m, the world-atlas package) are drawn here as vector
 * shapes, and the country names come from Natural Earth's own label
 * anchors: two files in the game's own bundle, fetched once and cached
 * like any other chunk. No key, no account, no quota, and nothing
 * fetched from anyone while a round is played.
 *
 * **Countries are named, nothing smaller is.** Reading a country from
 * its silhouette is a different game and a worse one: this round asks
 * which language, not whether you can pick Paraguay out of a line-up.
 * A state or a city name would hand over the answer, so the map has
 * neither, and that is the only reason the world is drawn without them.
 *
 * Same contract as ScriptMap so the play client does not care which it
 * has: tap to pin, and on the reveal draw where the language is spoken,
 * because the answer is an area rather than a point: the states and
 * districts themselves for South Asia, a disc for the rest of the world
 * until those regions are drawn properly too.
 *
 * If the outline chunk cannot be loaded (a captive network on a first
 * visit), a latitude and longitude grid is drawn in its place and
 * `onMapTrouble` fires so the screen can say so. A round on a grid is
 * harder than a round on a map, but it is still a round; a round on an
 * empty rectangle is a bug report.
 */

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const ANSWER = '#16a34a';
const GUESS = '#e08c0a';
// Warm land on a pale sea, matching script-round.css. A map reads
// better as paper than as a hole in the dark.
const LAND = { fillColor: '#f7f2e7', fillOpacity: 1, color: '#cbbda6', weight: 0.7, opacity: 1 };
const MIN_ZOOM = 1;
// 1:110m coastlines are simplified; past this they read as polygons
// rather than coasts, and nothing in the round needs closer.
const MAX_ZOOM = 7;

/**
 * The world's outline and the names on it, loaded once per page. The
 * outline is the same polygon set the server scores with, so what the
 * player pins on is what the answer is measured against.
 */
let worldPromise = null;
function loadWorld() {
  if (!worldPromise) {
    worldPromise = Promise.all([
      import('world-atlas/countries-110m.json'),
      import('topojson-client'),
      import('@/app/lib/geo/data/country-labels.json'),
    ]).then(([atlas, topojson, labels]) => {
      const topology = atlas.default || atlas;
      return {
        land: splitAtAntimeridian(topojson.feature(topology, topology.objects.countries)),
        labels: (labels.default || labels).labels || [],
      };
    });
    // A failed load is not cached: the next mount tries again.
    worldPromise.catch(() => {
      worldPromise = null;
    });
  }
  return worldPromise;
}

/**
 * Cut every ring where it crosses the antimeridian.
 *
 * Russia and Fiji have rings that run off one edge of the world and
 * come back on the other. Drawn flat, the segment between those two
 * points is a line straight across the map, and the world outline grew
 * three of them. Splitting the ring at the jump leaves each piece on
 * its own side, which is what the eye expects and what the old raster
 * tiles did for us.
 */
function splitAtAntimeridian(collection) {
  const cut = (ring) => {
    const parts = [];
    let part = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
      if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
        if (part.length >= 3) parts.push(part);
        part = [];
      }
      part.push(ring[i]);
    }
    if (part.length >= 3) parts.push(part);
    return parts.length ? parts : [ring];
  };
  const polygons = (coords, type) => (type === 'Polygon' ? [coords] : coords);
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const { type, coordinates } = feature.geometry || {};
      if (type !== 'Polygon' && type !== 'MultiPolygon') return feature;
      const out = [];
      for (const polygon of polygons(coordinates, type)) {
        for (const ring of polygon) for (const piece of cut(ring)) out.push([piece]);
      }
      return { ...feature, geometry: { type: 'MultiPolygon', coordinates: out } };
    }),
  };
}

/** A marker that needs no image file, so there are no 404s for Leaflet's default icons. */
function dot(L, color, label) {
  return L.divIcon({
    className: '',
    html: `<div class="wg-pin" style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fffdf8;box-shadow:0 2px 8px rgba(43,38,32,.35)" title="${label}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Country names, shown from the zoom Natural Earth's cartographers set. */
function addLabels(L, map, rows) {
  const markers = rows.map((row) => ({
    zoom: row.z,
    until: row.u ?? 12,
    marker: L.marker([row.y, row.x], {
      icon: L.divIcon({
        className: '',
        html: `<span class="wg-country-label${row.z <= 2 ? ' wg-country-label--big' : ''}">${row.n}</span>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
      pane: 'labels',
    }),
  }));
  const shown = new Set();
  const sync = () => {
    const zoom = map.getZoom();
    for (const entry of markers) {
      const wanted = entry.zoom <= zoom && zoom <= entry.until;
      if (wanted === shown.has(entry)) continue;
      if (wanted) {
        entry.marker.addTo(map);
        shown.add(entry);
      } else {
        map.removeLayer(entry.marker);
        shown.delete(entry);
      }
    }
  };
  map.on('zoomend', sync);
  sync();
  return () => map.off('zoomend', sync);
}

export default function LeafletScriptMap({ pin, onPin, answer = null, guess = null, nearestPoint = null, mode = 'guess', className = '', onMapTrouble }) {
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
    let stopLabels = null;
    // The map exists as soon as Leaflet does, and the land is painted on
    // when its chunk lands, the way tiles used to stream in: a tap
    // before then is still a tap on the map, and nothing waits on the
    // larger file.
    loadWorld().catch(() => null);
    import('leaflet').then((mod) => {
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
        zoomControl: false,
        attributionControl: true,
      }).setView([20, 0], 2);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      map.on('click', (event) => {
        if (!interactiveRef.current) return;
        onPinRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      leafletRef.current = L;
      mapRef.current = map;

      // Land below the overlays, names above them but below the answer:
      // a country's name should not be hidden by the shape drawn on it,
      // and should not cover the pin either.
      map.createPane('land').style.zIndex = 350;
      map.createPane('labels').style.zIndex = 450;
      map.getPane('labels').style.pointerEvents = 'none';
      loadWorld()
        .then(({ land, labels }) => {
          if (cancelled || mapRef.current !== map) return;
          // A few thousand vertices pan and zoom faster on a canvas than
          // as SVG, and the land is not interactive, so a tap on a
          // country is a tap on the map.
          L.geoJSON(land, {
            pane: 'land',
            style: LAND,
            interactive: false,
            renderer: L.canvas({ pane: 'land', padding: 0.5 }),
            attribution: 'Natural Earth',
          }).addTo(map);
          stopLabels = addLabels(L, map, labels);
        })
        .catch(() => {
          if (cancelled || mapRef.current !== map) return;
          drawGraticule(L, map);
          onTroubleRef.current?.();
        });
    });
    return () => {
      cancelled = true;
      stopLabels?.();
      try {
        // stop() before remove(): a pan, zoom or fly still animating
        // will fire its transitionend after the panes are gone and throw
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
      const style = { color: ANSWER, weight: 2, fillColor: ANSWER, fillOpacity: 0.22, className: 'wg-region' };
      // South Asian languages are drawn as the states, districts and
      // divisions they are spoken in, clipped where a language covers
      // part of one; the rest of the corpus is still a disc, and says
      // so by being one (app/lib/geo/server/regions.js).
      const shape = region.rings
        ? L.polygon(region.rings.map((ring) => ring.map(([lng, lat]) => [lat, lng])), style)
        : L.circle([region.lat, region.lng], { ...style, radius: region.radiusKm * 1000 });
      drawn.push(shape.addTo(map).bindTooltip(`${region.name} (${answer.name})`));
    }
    if (guess) {
      drawn.push(L.marker([guess.lat, guess.lng], { icon: dot(L, GUESS, 'Your guess'), keyboard: false }).addTo(map));
      // To the nearest point on the region's edge when the server
      // measured one, which is where the language actually starts;
      // otherwise to the nearest region's middle.
      const nearest = nearestPoint || nearestRegion(guess, answer.regions || []);
      if (nearest) {
        drawn.push(
          L.polyline(
            [
              [guess.lat, guess.lng],
              [nearest.lat, nearest.lng],
            ],
            { color: GUESS, weight: 2.5, dashArray: '6 6', className: 'wg-line' }
          ).addTo(map)
        );
      }
    }
    drawnRef.current = drawn;

    try {
      const group = L.featureGroup(drawn);
      const bounds = group.getBounds();
      // Flown, not cut. The player needs to see which way the answer was
      // from their pin, and a jump cut loses that; a second of travel
      // keeps it. The cleanup above stops it if the round ends mid-flight.
      if (bounds.isValid()) {
        map.flyToBounds(bounds, {
          // Room at the bottom for the answer panel, which slides up
          // over the map as this flight lands.
          paddingTopLeft: [44, 44],
          paddingBottomRight: [44, 230],
          maxZoom: MAX_ZOOM,
          duration: 0.9,
          easeLinearity: 0.2,
        });
      }
    } catch {
      /* one layer, or none: leave the view alone */
    }
  }, [answer, guess, nearestPoint, mode]);

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
  const line = (points, weight, color) => L.polyline(points, { color, weight, opacity: 0.5, interactive: false }).addTo(map);
  for (let lng = -180; lng <= 180; lng += 30) {
    line([[-85, lng], [85, lng]], lng === 0 ? 1.5 : 0.75, lng === 0 ? '#8a7f6c' : '#b6a892');
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    line([[lat, -180], [lat, 180]], lat === 0 ? 1.5 : 0.75, lat === 0 ? '#8a7f6c' : '#b6a892');
  }
  // The tropics, which are where most of the world's languages are.
  for (const lat of [23.44, -23.44]) line([[lat, -180], [lat, 180]], 0.75, '#c8bba4');
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
