'use client';

/**
 * MapPreviewMini - Small map preview for Squad Home
 *
 * Shows a simplified satellite map with case markers
 * Clicking opens the full map view
 */

import { useEffect, useRef } from 'react';

export default function MapPreviewMini({ center, cases = [], satellite = true }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Dynamically import Leaflet
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      if (!mapRef.current) return;

      // Create map
      const map = L.map(mapRef.current, {
        center: center || [30.2672, -97.7431],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });

      // Add tile layer - satellite by default
      if (satellite) {
        // ESRI World Imagery (satellite)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
        }).addTo(map);
      } else {
        // Dark theme fallback
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(map);
      }

      // Add case markers with better visibility on satellite
      cases.forEach(c => {
        if (c.lastSeenLatitude && c.lastSeenLongitude) {
          const isUrgent = c.lastSeenAt &&
            (Date.now() - new Date(c.lastSeenAt).getTime()) / 3600000 < 24;

          const color = isUrgent ? '#ef4444' : '#f59e0b';

          // Add a white stroke for visibility on satellite imagery
          L.circleMarker([c.lastSeenLatitude, c.lastSeenLongitude], {
            radius: 10,
            fillColor: color,
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
          }).addTo(map);
        }
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, cases, satellite]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ background: '#1a365d' }}
    />
  );
}
