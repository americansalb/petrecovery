'use client';

/**
 * The Lantern Map (client-only Leaflet). One meaning per channel:
 * zone fill luminance = watch level (resting / watched), flash = live
 * mission flares + selection. No per-division hues, no density ramps —
 * see docs/RESCUE_FORCES_REDESIGN.md §5.2.1.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILES_TO_METERS = 1609.34;

function zoneStyle(zone, isSelected) {
  return {
    color: isSelected ? 'rgba(250,204,21,0.9)' : 'rgba(255,255,255,0.28)',
    weight: isSelected ? 2 : 1,
    fillColor: '#ffffff',
    fillOpacity: zone.onDuty > 0 ? 0.14 : 0.05,
  };
}

export default function TerritoryMapInner({
  center,
  radiusMiles,
  zones,
  flares,
  selectedId,
  onSelectZone,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const zoneLayersRef = useRef({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    }).setView(center, 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; OSM &copy; CARTO')
      .addTo(map);

    // Force boundary — a faint flash dashed ring; the edge of the watch.
    const boundary = L.circle(center, {
      radius: (radiusMiles || 5) * MILES_TO_METERS,
      color: 'rgba(250,204,21,0.35)',
      weight: 1.5,
      dashArray: '4 6',
      fill: false,
    }).addTo(map);
    map.fitBounds(boundary.getBounds(), { padding: [10, 10] });

    // Division zones — geometry is navigation.
    zones.forEach((zone) => {
      let layer = null;
      if (zone.customBoundary) {
        try {
          layer = L.geoJSON(JSON.parse(zone.customBoundary), { style: zoneStyle(zone, false) });
        } catch {
          layer = null;
        }
      }
      if (!layer && zone.centerLatitude != null) {
        layer = L.circle([zone.centerLatitude, zone.centerLongitude], {
          radius: (zone.radiusMiles || 3) * MILES_TO_METERS,
          ...zoneStyle(zone, false),
        });
      }
      if (!layer) return;
      layer.addTo(map);
      layer.on('click', () => onSelectZone(zone));
      zoneLayersRef.current[zone.id] = { layer, zone };

      if (zone.centerLatitude != null) {
        L.marker([zone.centerLatitude, zone.centerLongitude], {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<span class="lantern-zone-label">${zone.name}</span>`,
            iconSize: [120, 16],
            iconAnchor: [60, 8],
          }),
        }).addTo(map);
      }
    });

    // Mission flares — the only flash on the map.
    flares.forEach((f) => {
      L.marker([f.lat, f.lng], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: '<span class="lantern-flare"></span>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      zoneLayersRef.current = {};
    };
    // The map is built once from initial props; selection restyles below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Object.values(zoneLayersRef.current).forEach(({ layer, zone }) => {
      const style = zoneStyle(zone, zone.id === selectedId);
      if (layer.setStyle) layer.setStyle(style);
    });
  }, [selectedId]);

  return <div ref={containerRef} className="h-64 w-full lantern-map" aria-label="Territory map" />;
}
