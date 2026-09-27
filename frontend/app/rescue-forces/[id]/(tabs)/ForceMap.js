'use client';

/**
 * A Rescue Force's map (client-only Leaflet): its area and its pets.
 *
 * The area is outlined in yellow over a dark edge, and everything outside
 * it is dimmed, so "inside the yellow line" is the force's area at a
 * glance. The outline is the town's (customBoundary), or the force's
 * circle. Each pet is its photo in a ring of its color (app/lib/petColors.js),
 * with a check mark when it is home. A pin opens the pet's page.
 *
 * Pet names come from reports, so pins are DOM nodes with text and
 * attributes set one by one, never HTML strings.
 */

import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PET_COLOR } from '@/app/lib/petColors';

const WORLD = [
  [89, -179.99],
  [89, 179.99],
  [-89, 179.99],
  [-89, -179.99],
];

/** A circle as a ring of [lat, lng], for a force with no town outline. */
function circleRing(lat, lng, miles, steps = 72) {
  const dLat = miles / 69;
  const dLng = miles / (69 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([lat + dLat * Math.sin(a), lng + dLng * Math.cos(a)]);
  }
  return ring;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function pinFor(pet) {
  const link = node('a', `force-pet-pin is-${pet.status}`);
  link.href = `/cases/${encodeURIComponent(pet.caseNumber)}`;
  link.setAttribute('aria-label', `${pet.name}, ${pet.when}`);
  link.title = pet.name;
  link.style.borderColor = PET_COLOR[pet.status] || PET_COLOR.closed;
  if (pet.photo) {
    const img = node('img');
    img.alt = '';
    img.src = pet.photo;
    img.addEventListener('error', () => {
      img.remove();
      link.appendChild(node('span', 'force-pet-letter', (pet.name || '?').charAt(0).toUpperCase()));
    });
    link.appendChild(img);
  } else {
    link.appendChild(node('span', 'force-pet-letter', (pet.name || '?').charAt(0).toUpperCase()));
  }
  // A plain click is the marker's (which ignores the click ending a drag).
  link.addEventListener('click', (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) e.preventDefault();
  });
  const wrap = node('div', 'force-pet-wrap');
  wrap.appendChild(link);
  if (pet.status === 'home') wrap.appendChild(node('span', 'force-pet-check'));
  return wrap;
}

export default function ForceMap({ force, pets, shown, onOpen, wide = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinsRef = useRef(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      // On a phone the page scrolls past the map: one finger scrolls the
      // page, two fingers zoom the map.
      dragging: wide || !L.Browser.mobile,
      scrollWheelZoom: wide,
    });
    L.tileLayer(TILE_URL, tileLayerOptions({ calm: true })).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    L.control.zoom({ position: wide ? 'topright' : 'bottomright' }).addTo(map);

    const rings =
      Array.isArray(force.area) && force.area.length > 0
        ? force.area
        : force.lat != null
          ? [circleRing(force.lat, force.lng, force.radiusMiles || 5)]
          : [];

    if (rings.length > 0) {
      // Everything outside the area, dimmed: the world with the area cut out.
      L.polygon([WORLD, ...rings], {
        stroke: false,
        fillColor: '#0f172a',
        fillOpacity: 0.3,
        interactive: false,
      }).addTo(map);
      // The yellow line: a soft glow, a dark edge, then the line itself.
      [
        { color: '#facc15', opacity: 0.35, weight: 12 },
        { color: '#0f172a', opacity: 1, weight: 5 },
        { color: '#facc15', opacity: 1, weight: 2.5 },
      ].forEach((style) => {
        L.polygon(rings, { ...style, fill: false, lineJoin: 'round', interactive: false }).addTo(map);
      });
      map.fitBounds(L.latLngBounds(rings.flat()), { padding: wide ? [24, 24] : [10, 10] });
    } else {
      map.setView([39.5, -98.35], 4);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      pinsRef.current = null;
    };
    // Built once; pins follow the filters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinsRef.current) pinsRef.current.remove();
    const group = L.layerGroup();
    pets.forEach((pet) => {
      if (pet.lat == null || pet.lng == null || !shown.has(pet.status)) return;
      const marker = L.marker([pet.lat, pet.lng], {
        icon: L.divIcon({ className: '', html: pinFor(pet), iconSize: [42, 42], iconAnchor: [21, 21] }),
        keyboard: false, // the link inside takes focus
        riseOnHover: true,
      });
      marker.on('click', () => openRef.current(pet.caseNumber));
      group.addLayer(marker);
    });
    group.addTo(map);
    pinsRef.current = group;
  }, [pets, shown]);

  return (
    <div
      ref={containerRef}
      className="force-map h-full w-full"
      aria-label={`Map of ${force.name}'s area and its pets`}
    />
  );
}
