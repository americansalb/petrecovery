'use client';

/**
 * MapEmbed - Simple map matching Mission Control's style
 *
 * Uses the same CartoDB tile layer as SARMapView for consistency.
 * Intentionally minimal - just shows location context, not full features.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapEmbed({ center, sightings = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !center) return;

    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create map - disable interactions for preview mode
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: false,
    }).setView(center, 14);

    // Use same tile layer as Mission Control (CartoDB Voyager for light theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>'
    }).addTo(map);

    // Last seen marker - clean teardrop style
    const lastSeenIcon = L.divIcon({
      className: 'custom-marker-lastseen',
      html: `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
        ">
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            background: #0f172a;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
          <div style="
            position: absolute;
            top: 6px;
            left: 6px;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="font-size: 14px;">🐾</span>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    L.marker(center, { icon: lastSeenIcon }).addTo(map);

    // Sighting markers - amber dots
    if (sightings.length > 0) {
      const sightingIcon = L.divIcon({
        className: 'custom-marker-sighting',
        html: `
          <div style="
            width: 16px;
            height: 16px;
            background: #f59e0b;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          "></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      sightings.slice(0, 5).forEach(sighting => {
        if (sighting.latitude && sighting.longitude) {
          L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon }).addTo(map);
        }
      });

      // Fit bounds to show all markers
      const bounds = L.latLngBounds([center]);
      sightings.slice(0, 5).forEach(s => {
        if (s.latitude && s.longitude) {
          bounds.extend([s.latitude, s.longitude]);
        }
      });
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, sightings]);

  return <div ref={mapRef} className="w-full h-full" />;
}
