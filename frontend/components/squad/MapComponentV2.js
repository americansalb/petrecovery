'use client';

/**
 * MapComponentV2 - Leaflet map implementation
 *
 * Renders the interactive map with case pins, division boundaries, and city boundary
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
  squad,
  onCaseClick,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const cityBoundaryRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([squad.centerLat || 41.8781, squad.centerLng || -87.6298], 13);

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

  // Draw city boundary (main coverage area)
  useEffect(() => {
    if (!mapInstanceRef.current || !squad.cityName) return;

    const fetchCityBoundary = async () => {
      try {
        // Clear old boundary
        if (cityBoundaryRef.current) {
          cityBoundaryRef.current.remove();
          cityBoundaryRef.current = null;
        }

        const cityName = squad.cityName;
        const state = squad.state || '';
        const searchQuery = state ? `${cityName}, ${state}, USA` : `${cityName}, USA`;

        // Use backend proxy to avoid CORS issues
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(searchQuery)}&format=geojson&polygon_geojson=1&limit=1`
        );

        if (!response.ok) return;

        const data = await response.json();
        if (!data.features || data.features.length === 0) return;

        const feature = data.features[0];
        if (!feature.geometry) return;

        // Create GeoJSON layer with city boundary
        cityBoundaryRef.current = L.geoJSON(feature.geometry, {
          style: {
            color: '#3b82f6', // blue-500
            weight: 3,
            opacity: 0.8,
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
          }
        }).addTo(mapInstanceRef.current);

        // Bring to back so it doesn't cover markers
        cityBoundaryRef.current.bringToBack();

      } catch (error) {
        console.error('Failed to fetch city boundary:', error);
      }
    };

    fetchCityBoundary();

    return () => {
      if (cityBoundaryRef.current) {
        cityBoundaryRef.current.remove();
        cityBoundaryRef.current = null;
      }
    };
  }, [squad.cityName, squad.state]);

  // Draw division boundaries (subtle dotted lines)
  useEffect(() => {
    if (!mapInstanceRef.current || !divisions || divisions.length === 0) return;

    const rectangles = [];

    divisions.forEach(division => {
      if (!division.bounds) return;

      const bounds = division.bounds;
      const rectangle = L.rectangle(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        {
          color: 'rgba(255, 255, 255, 0.3)',
          weight: 1,
          fillOpacity: 0,
          dashArray: '4, 4',
        }
      ).addTo(mapInstanceRef.current);

      // Add division label tooltip
      rectangle.bindTooltip(division.name, {
        permanent: false,
        direction: 'center',
        className: 'division-tooltip',
      });

      rectangles.push(rectangle);
    });

    return () => {
      rectangles.forEach(rect => rect.remove());
    };
  }, [divisions]);

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
      if (caseData.status === 'PENDING') markerColor = '#f59e0b'; // amber for pending
      if (caseData.status === 'REUNITED') markerColor = '#10b981'; // green for reunited

      // Create custom icon
      const icon = L.divIcon({
        className: 'custom-case-marker',
        html: `
          <div data-case-id="${caseData.id}" style="
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
        .addTo(mapInstanceRef.current);

      // Add click event that will definitely work
      marker.on('click', (e) => {
        console.log('Marker clicked!', caseData.id);
        onCaseClick(caseData.id);
      });

      // Also add click handler to the HTML element for better reliability
      marker.getElement()?.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Marker HTML clicked!', caseData.id);
        onCaseClick(caseData.id);
      });

      markersRef.current.push(marker);
    });
  }, [cases, onCaseClick]);

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

        /* Division tooltip styles */
        .division-tooltip {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 4px 8px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
