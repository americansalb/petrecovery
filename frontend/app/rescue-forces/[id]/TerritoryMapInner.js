'use client';

/**
 * A Rescue Force's area on a map (client-only Leaflet): the force's circle,
 * its divisions, and a red dot for each pet missing now. Light, muted tiles
 * and the same red as the Lost & Found pins, so it reads like every other
 * map on the pet site. Clicking a division selects it.
 *
 * Division names are typed by force leaders and pet names by reporters, so
 * labels and popups are DOM text, never HTML strings: the dark map this
 * replaced put division names straight into innerHTML.
 */

import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILES_TO_METERS = 1609.34;

function zoneStyle(isSelected) {
  return {
    color: isSelected ? '#ca8a04' : '#475569',
    weight: isSelected ? 2.5 : 1.5,
    fillColor: '#334155',
    fillOpacity: isSelected ? 0.14 : 0.06,
  };
}

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function petPopup(pet) {
  const root = document.createElement('div');
  root.style.cssText = 'font-family:inherit;min-width:140px';
  root.appendChild(text('div', 'territory-popup-title', pet.name || 'Missing pet'));
  const link = text('a', 'territory-popup-link', 'View pet');
  link.href = `/cases/${encodeURIComponent(pet.caseNumber)}`;
  root.appendChild(link);
  return root;
}

export default function TerritoryMapInner({ center, radiusMiles, zones, pets, selectedId, onSelectZone }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const zoneLayersRef = useRef({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    }).setView(center, 11);

    L.tileLayer(TILE_URL, tileLayerOptions({ calm: true })).addTo(map);
    // The tile layer brings its own attribution (app/lib/maps/tiles.js).
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // The force's area: a dashed ring.
    const boundary = L.circle(center, {
      radius: (radiusMiles || 5) * MILES_TO_METERS,
      color: '#0f172a',
      opacity: 0.45,
      weight: 1.5,
      dashArray: '4 6',
      fill: false,
      interactive: false,
    }).addTo(map);
    map.fitBounds(boundary.getBounds(), { padding: [10, 10] });

    zones.forEach((zone) => {
      let layer = null;
      if (zone.customBoundary) {
        try {
          layer = L.geoJSON(JSON.parse(zone.customBoundary), { style: zoneStyle(false) });
        } catch {
          layer = null;
        }
      }
      if (!layer && zone.centerLatitude != null) {
        layer = L.circle([zone.centerLatitude, zone.centerLongitude], {
          radius: (zone.radiusMiles || 3) * MILES_TO_METERS,
          ...zoneStyle(false),
        });
      }
      if (!layer) return;
      layer.addTo(map);
      layer.on('click', () => onSelectZone(zone));
      zoneLayersRef.current[zone.id] = layer;

      if (zone.centerLatitude != null) {
        L.marker([zone.centerLatitude, zone.centerLongitude], {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: text('span', 'territory-zone-label', zone.name),
            iconSize: [160, 16],
            iconAnchor: [80, 8],
          }),
        }).addTo(map);
      }
    });

    pets.forEach((pet) => {
      L.marker([pet.lat, pet.lng], {
        title: pet.name || 'Missing pet',
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          html: '<span class="territory-pet"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -8],
        }),
      })
        .bindPopup(() => petPopup(pet), { maxWidth: 220 })
        .addTo(map);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      zoneLayersRef.current = {};
    };
    // Built once from the first props; selection restyles below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Object.entries(zoneLayersRef.current).forEach(([id, layer]) => {
      if (layer.setStyle) layer.setStyle(zoneStyle(id === selectedId));
    });
  }, [selectedId]);

  return <div ref={containerRef} className="territory-map h-72 w-full" aria-label="Map of this Rescue Force's area" />;
}
