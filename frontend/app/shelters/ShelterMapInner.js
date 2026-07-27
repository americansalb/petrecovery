'use client';

/**
 * The directory map (client-only Leaflet), daylight sibling of the
 * lantern map: light tiles, midnight pins, flash only on the selected
 * shelter. Markers always mirror the visible list; selection flows both
 * ways (pin click selects the card, card click pans the map).
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const US_CENTER = [39.5, -98.35];

function pinIcon(selected) {
  return L.divIcon({
    className: '',
    html: `<span class="shelter-pin${selected ? ' is-selected' : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function ShelterMapInner({ shelters, selectedId, onSelect, origin }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const groupRef = useRef(null);
  const originRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView(US_CENTER, 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; OSM &copy; CARTO')
      .addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      groupRef.current = null;
      originRef.current = null;
    };
  }, []);

  // Markers mirror the visible list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (groupRef.current) groupRef.current.remove();
    markersRef.current = {};

    const group = L.layerGroup();
    shelters.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const marker = L.marker([s.latitude, s.longitude], { icon: pinIcon(false) });
      marker.on('click', () => onSelect(s.id));
      markersRef.current[s.id] = marker;
      group.addLayer(marker);
    });
    group.addTo(map);
    groupRef.current = group;

    const pts = shelters
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => [s.latitude, s.longitude]);
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 13 });
    }
    // onSelect is a state setter (stable); markers rebuild on list change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelters]);

  // Selection restyles pins and brings the shelter into view.
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const isSelected = id === selectedId;
      marker.setIcon(pinIcon(isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
    const map = mapRef.current;
    const sel = shelters.find((s) => s.id === selectedId);
    if (map && sel && sel.latitude != null) {
      map.setView([sel.latitude, sel.longitude], Math.max(map.getZoom(), 12), { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, shelters]);

  // The you-are-here dot after "Near me".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !origin) return;
    if (originRef.current) originRef.current.remove();
    originRef.current = L.marker([origin.lat, origin.lng], {
      interactive: false,
      icon: L.divIcon({
        className: '',
        html: '<span class="shelter-pin-you"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    }).addTo(map);
  }, [origin]);

  return <div ref={containerRef} className="h-full w-full civic-map" aria-label="Shelter map" />;
}
