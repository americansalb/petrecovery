'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { theme } from '../lib/theme';

export default function PetMap({ center = [41.8781, -87.6298], zoom = 13, markers = [], height = '400px' }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Create map
      const map = L.map(mapRef.current).setView(center, zoom);

      // Add tile layer with beautiful style
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icons
      const petOwnerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background: linear-gradient(135deg, #ff6b9d 0%, #ffa06b 100%);
          width: 40px;
          height: 40px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 20px;">🐕</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const sightingIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(79, 172, 254, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="font-size: 16px;">👁️</span>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      // Add markers
      markers.forEach((marker) => {
        const icon = marker.type === 'sighting' ? sightingIcon : petOwnerIcon;
        const leafletMarker = L.marker(marker.position, { icon }).addTo(map);

        if (marker.popup) {
          leafletMarker.bindPopup(marker.popup);
        }
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [center, zoom, markers]);

  return (
    <div style={{
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadows.md,
      height,
    }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
