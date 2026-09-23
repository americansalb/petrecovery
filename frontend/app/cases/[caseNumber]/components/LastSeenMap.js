'use client';

/**
 * Where the pet was last seen, and every sighting reported since.
 *
 * Popups are built from DOM nodes with textContent. The address and the
 * sighting notes are typed by members of the public, and Leaflet sets a
 * string popup with innerHTML, so a note written as HTML used to run as
 * script for everyone who opened the pet's page.
 *
 * Scroll-wheel zoom is off and one-finger dragging is off on phones, so
 * the map never traps the page while someone scrolls past it; the zoom
 * buttons and pinch still work.
 */

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import { timeAgo } from '@/app/lib/caseLabels';

export const LAST_SEEN_COLOR = '#ef4444';
export const SIGHTING_COLOR = '#f59e0b';

function el(tag, style, text) {
  const node = document.createElement(tag);
  if (style) node.style.cssText = style;
  if (text != null) node.textContent = text;
  return node;
}

function popup(title, lines) {
  const root = el('div', 'font-family:inherit;max-width:220px');
  root.appendChild(el('div', 'font-size:14px;font-weight:700;color:#0f172a', title));
  lines.filter(Boolean).forEach((line) => {
    root.appendChild(el('div', 'margin-top:2px;font-size:12px;color:#475569', line));
  });
  return root;
}

export default function LastSeenMap({ lat, lng, address, sightings = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let map = null;
    let cancelled = false;

    import('leaflet').then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
      }).setView([lat, lng], 15);
      L.tileLayer(TILE_URL, tileLayerOptions({ calm: true })).addTo(map);

      const dot = (color, size) =>
        L.divIcon({
          className: '',
          html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,0.35)"></span>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });

      const bounds = L.latLngBounds([[lat, lng]]);
      sightings.forEach((s) => {
        const sLat = Number(s.latitude);
        const sLng = Number(s.longitude);
        if (!Number.isFinite(sLat) || !Number.isFinite(sLng) || (sLat === 0 && sLng === 0)) return;
        L.marker([sLat, sLng], { icon: dot(SIGHTING_COLOR, 16), title: 'Sighting' })
          .bindPopup(() => popup('Sighting', [timeAgo(s.sightedAt), s.description]))
          .addTo(map);
        bounds.extend([sLat, sLng]);
      });

      // Drawn last so it sits above any sighting at the same spot.
      L.marker([lat, lng], { icon: dot(LAST_SEEN_COLOR, 22), title: 'Last seen', zIndexOffset: 1000 })
        .bindPopup(() => popup('Last seen', [address]))
        .addTo(map);

      if (!bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      }
    });

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [lat, lng, address, sightings]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Map of where the pet was last seen" />;
}
