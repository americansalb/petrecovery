'use client';

/**
 * BrowseMap - every open case on one map
 *
 * The list answers "what is lost"; the map answers "what is lost NEAR
 * ME". Pins carry a mini card popup that links into the case story.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR = {
  REUNITED: '#34d399',
  FOUND: '#38bdf8',
  URGENT: '#f87171',
  DEFAULT: '#facc15',
};

function pinColor(c) {
  if (c.status === 'REUNITED') return STATUS_COLOR.REUNITED;
  if (c.reportType === 'FOUND') return STATUS_COLOR.FOUND;
  if (c.isUrgent) return STATUS_COLOR.URGENT;
  return STATUS_COLOR.DEFAULT;
}

export default function BrowseMap({ cases = [] }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
      .setView([39.5, -96.0], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
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
      const color = pinColor(c);
      const icon = L.divIcon({
        className: 'case-pin',
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.45)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const marker = L.marker([c.lastSeenLatitude, c.lastSeenLongitude], { icon }).addTo(map);
      const photo = c.petPhotoUrl
        ? `<img src="${c.petPhotoUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:6px" />`
        : '';
      marker.bindPopup(
        `<div style="width:180px;font-family:inherit">
          ${photo}
          <div style="font-weight:700;color:#0f172a">${c.petName || 'Unknown'}</div>
          <div style="font-size:11px;color:#475569">${[c.petBreed, c.city].filter(Boolean).join(' · ')}</div>
          <a href="/cases/${c.caseNumber}" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#b45309">Open case →</a>
        </div>`
      );
      bounds.extend([c.lastSeenLatitude, c.lastSeenLongitude]);
      markersRef.current.push(marker);
    });

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [cases]);

  return <div ref={mapRef} className="w-full h-full" />;
}
