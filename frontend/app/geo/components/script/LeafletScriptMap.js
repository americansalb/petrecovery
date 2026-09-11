'use client';

/**
 * The script game's map, on tiles that need no key.
 *
 * Every other map in the game belongs to an imagery provider: showing
 * Street View obliges you to put the pin on a Google map, and Look
 * Around obliges MapKit. A script round shows a sentence, so it owes
 * neither of them anything, and using their maps anyway costs something
 * real. The MapKit token this repository ships is locked to the
 * reunitepets.org origin, which means that on localhost, on a preview
 * deployment, or on the game's own future domain, the map simply does
 * not authorise and the round cannot be answered.
 *
 * So this one is Leaflet on CARTO's raster tiles, the same stack the pet
 * site's maps already use. No key, no origin lock, no account. It is
 * what makes Script mode playable by cloning the repository and running
 * it, which is the only part of the game that is true of.
 *
 * Same contract as ScriptMap so the play client does not care which it
 * has: tap to pin, and on the reveal draw the language's heartlands as
 * circles, because the answer is an area rather than a point.
 */

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const ANSWER = '#22c55e';
const GUESS = '#facc15';

/** A marker that needs no image file, so there are no 404s for Leaflet's default icons. */
function dot(L, color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)" title="${label}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function LeafletScriptMap({ pin, onPin, answer = null, guess = null, mode = 'guess', className = '' }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const pinRef = useRef(null);
  const drawnRef = useRef([]);
  const onPinRef = useRef(onPin);
  const interactiveRef = useRef(mode === 'guess');
  onPinRef.current = onPin;
  interactiveRef.current = mode === 'guess';

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current || mapRef.current) return undefined;
    let cancelled = false;
    import('leaflet').then((mod) => {
      const L = mod.default || mod;
      if (cancelled || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, {
        // The world once, not tiled sideways forever: a pin at the same
        // place on a repeated world would score differently.
        worldCopyJump: false,
        maxBounds: [[-85, -180], [85, 180]],
        maxBoundsViscosity: 1,
        zoomControl: true,
        attributionControl: true,
      }).setView([20, 0], 2);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        // No labels: place names on the map would answer the round.
        attribution: '© OpenStreetMap contributors © CARTO',
        noWrap: true,
        minZoom: 1,
        maxZoom: 12,
      }).addTo(map);
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
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    } catch {
      /* one layer, or none: leave the view alone */
    }
  }, [answer, guess, mode]);

  return <div ref={hostRef} className={`h-full w-full bg-midnight-900 ${className}`} data-script-map="leaflet" />;
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
