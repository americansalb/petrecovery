'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * SquadCoverageMap - Shows a map of the squad's coverage area
 * @param {Object} props
 * @param {number} props.latitude - Center latitude
 * @param {number} props.longitude - Center longitude
 * @param {number} props.radiusMiles - Coverage radius in miles
 * @param {string} props.city - City name
 * @param {string} props.state - State abbreviation
 */
export default function SquadCoverageMap({ latitude, longitude, radiusMiles, city, state }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true
    }).setView([latitude, longitude], 11);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add marker for squad center
    const markerIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background: #667eea;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
          border: 3px solid white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        ">🚨</div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([latitude, longitude], { icon: markerIcon })
      .addTo(map)
      .bindPopup(`<b>${city} Rescue Squad</b><br/>${city}, ${state}`);

    // Add circle for coverage radius
    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters
    L.circle([latitude, longitude], {
      radius: radiusMeters,
      color: '#667eea',
      fillColor: '#667eea',
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, radiusMiles, city, state]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      border: '2px solid #e2e8f0'
    }}>
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '2px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: '700',
          color: '#64748b',
          marginBottom: '0.25rem'
        }}>
          Coverage Area
        </div>
        <div style={{
          fontSize: '1.3rem',
          fontWeight: '900',
          color: '#0f172a'
        }}>
          {city}, {state}
        </div>
        <div style={{
          fontSize: '0.85rem',
          color: '#64748b',
          marginTop: '0.25rem'
        }}>
          {radiusMiles}-mile radius
        </div>
      </div>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '350px'
        }}
      />
    </div>
  );
}
