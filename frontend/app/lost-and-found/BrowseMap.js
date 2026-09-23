'use client';

/**
 * BrowseMap: every pet on the board, on one map.
 *
 * Pins use the same three colours as the cards (lost, found, home), and
 * each opens a small card that links to the pet's page. The popup is
 * built from DOM nodes with textContent, never an HTML string: Leaflet
 * sets string popups with innerHTML, and a pet named `<img onerror=...>`
 * used to run as script for anyone who opened the map.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { caseStatus, caseTitle, caseDescriptor, casePlace } from '@/app/lib/caseLabels';
import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';

const PIN_COLOR = {
  lost: '#ef4444',
  found: '#0ea5e9',
  home: '#10b981',
};

/** Only http(s) photo URLs go into an img element. */
function safePhoto(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

function el(tag, style, text) {
  const node = document.createElement(tag);
  if (style) node.style.cssText = style;
  if (text != null) node.textContent = text;
  return node;
}

function popupFor(c) {
  const { key, label } = caseStatus(c);
  const root = el('div', 'width:200px;font-family:inherit');

  const photo = safePhoto(c.petPhotoUrl);
  if (photo) {
    const img = el('img', 'display:block;width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px');
    img.alt = '';
    img.src = photo;
    img.addEventListener('error', () => img.remove());
    root.appendChild(img);
  }

  const status = el('div', 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#475569');
  status.appendChild(el('span', `width:8px;height:8px;border-radius:9999px;background:${PIN_COLOR[key]}`));
  status.appendChild(document.createTextNode(label));
  root.appendChild(status);

  root.appendChild(el('div', 'margin-top:2px;font-size:15px;font-weight:700;color:#0f172a', caseTitle(c)));
  root.appendChild(el('div', 'font-size:12px;color:#64748b', caseDescriptor(c)));
  root.appendChild(el('div', 'font-size:12px;color:#64748b', casePlace(c)));

  // Links get a 44px minimum height site-wide (globals.css), so the text is
  // centred with flex rather than left at the top of a tall pill.
  const link = el(
    'a',
    'display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:0 16px;border-radius:9999px;background:#0f172a;color:#fff;font-size:13px;font-weight:600;text-decoration:none',
    'View pet'
  );
  link.href = `/cases/${encodeURIComponent(c.caseNumber)}`;
  root.appendChild(link);
  return root;
}

export default function BrowseMap({ cases = [] }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.5, -96.0], 4);
    L.tileLayer(TILE_URL, tileLayerOptions({ calm: true })).addTo(map);
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => { try { m.remove(); } catch (e) {} });
    markersRef.current = [];

    const located = cases.filter((c) => c.lastSeenLatitude && c.lastSeenLongitude);
    if (located.length === 0) return;

    const bounds = L.latLngBounds([]);
    located.forEach((c) => {
      const { key } = caseStatus(c);
      const icon = L.divIcon({
        className: 'case-pin',
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${PIN_COLOR[key]};border:3px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,0.35)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });
      const marker = L.marker([c.lastSeenLatitude, c.lastSeenLongitude], { icon, title: caseTitle(c) }).addTo(map);
      marker.bindPopup(() => popupFor(c), { maxWidth: 220 });
      bounds.extend([c.lastSeenLatitude, c.lastSeenLongitude]);
      markersRef.current.push(marker);
    });

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
  }, [cases]);

  return <div ref={mapRef} className="h-full w-full" />;
}
