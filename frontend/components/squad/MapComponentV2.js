'use client';

/**
 * MapComponentV2 - Leaflet map implementation
 *
 * Renders the interactive map with case pins and division boundaries
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

export default function MapComponentV2({
  cases,
  divisions,
  selectedDivisionId,
  squad,
  onCaseClick,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([squad.centerLat || 41.8781, squad.centerLng || -87.6298], 11);

    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when cases change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add case markers
    cases.forEach(caseData => {
      if (!caseData.lastSeenLat || !caseData.lastSeenLng) return;

      // Determine marker color based on status
      let markerColor = '#ef4444'; // red for active
      if (caseData.status === 'PENDING') markerColor = '#f59e0b'; // amber for incoming
      if (caseData.status === 'REUNITED') markerColor = '#10b981'; // green for reunited

      // Create custom icon
      const icon = L.divIcon({
        className: 'custom-case-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 20px ${markerColor}80;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: pointer;
            ${caseData.urgency === 'HIGH' ? 'animation: pulse 2s infinite;' : ''}
          ">
            ${getSpeciesEmoji(caseData.species)}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([caseData.lastSeenLat, caseData.lastSeenLng], { icon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          onCaseClick(caseData.id);
        });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers if we have cases
    if (cases.length > 0) {
      const bounds = L.latLngBounds(
        cases
          .filter(c => c.lastSeenLat && c.lastSeenLng)
          .map(c => [c.lastSeenLat, c.lastSeenLng])
      );
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [cases, onCaseClick]);

  // Draw division boundaries
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedDivisionId) return;

    const selectedDivision = divisions.find(d => d.id === selectedDivisionId);
    if (!selectedDivision || !selectedDivision.bounds) return;

    // Draw rectangle for division bounds
    const bounds = selectedDivision.bounds;
    const rectangle = L.rectangle(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      {
        color: '#06b6d4',
        weight: 2,
        fillOpacity: 0.1,
      }
    ).addTo(mapInstanceRef.current);

    return () => {
      rectangle.remove();
    };
  }, [selectedDivisionId, divisions]);

  return (
    <div>
      <div
        ref={mapRef}
        className="w-full h-[600px] rounded-2xl overflow-hidden border-2 border-slate-700/60 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      />
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        /* Custom marker styles */
        .custom-case-marker {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }
      `}</style>
    </div>
  );
}

function getSpeciesEmoji(species) {
  const emojis = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  };
  return emojis[species] || '🐾';
}
