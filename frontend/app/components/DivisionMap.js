'use client';

import { useEffect, useRef } from 'react';

export default function DivisionMap({ boundaries, centerLatitude, centerLongitude, name }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }

      // Initialize map
      const map = L.map(mapRef.current).setView(
        [centerLatitude || 41.8781, centerLongitude || -87.6298],
        13
      );

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // If boundaries exist, draw polygon
      if (boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
        try {
          // Parse boundaries if it's a JSON string
          const coords = typeof boundaries === 'string' ? JSON.parse(boundaries) : boundaries;

          // Create polygon
          const polygon = L.polygon(coords, {
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.2,
            weight: 3
          }).addTo(map);

          // Fit map to polygon bounds
          map.fitBounds(polygon.getBounds(), { padding: [50, 50] });

          // Add popup with division name
          polygon.bindPopup(`<strong>${name}</strong><br/>Division Coverage Area`);
        } catch (err) {
          console.error('Error drawing polygon:', err);

          // Fallback to center marker if polygon fails
          L.marker([centerLatitude, centerLongitude])
            .addTo(map)
            .bindPopup(`<strong>${name}</strong><br/>Division Center`);
        }
      } else {
        // No boundaries, just show center marker
        if (centerLatitude && centerLongitude) {
          L.marker([centerLatitude, centerLongitude])
            .addTo(map)
            .bindPopup(`<strong>${name}</strong><br/>Division Center`);
        }
      }

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [boundaries, centerLatitude, centerLongitude, name]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      marginBottom: '2rem'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: '1rem'
      }}>
        Coverage Area
      </h3>
      <div
        ref={mapRef}
        style={{
          height: '400px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #e2e8f0'
        }}
      />
    </div>
  );
}
