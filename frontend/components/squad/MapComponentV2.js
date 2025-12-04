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

    // Add satellite tile layer (ESRI World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
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

    // Group cases by location to handle overlapping
    const locationGroups = new Map();
    cases.forEach(caseData => {
      if (!caseData.lastSeenLat || !caseData.lastSeenLng) return;
      const key = `${caseData.lastSeenLat.toFixed(6)},${caseData.lastSeenLng.toFixed(6)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key).push(caseData);
    });

    // Add case markers with offset for overlapping cases
    locationGroups.forEach((casesAtLocation, locationKey) => {
      casesAtLocation.forEach((caseData, index) => {
        // Calculate offset for overlapping markers (spiral pattern)
        let offsetLat = 0;
        let offsetLng = 0;
        if (index > 0) {
          const angle = (index * 60) * (Math.PI / 180); // 60 degrees apart
          const radius = 0.0003 * Math.ceil(index / 6); // Expand radius every 6 markers
          offsetLat = Math.sin(angle) * radius;
          offsetLng = Math.cos(angle) * radius;
        }

        const lat = caseData.lastSeenLat + offsetLat;
        const lng = caseData.lastSeenLng + offsetLng;

        // Determine marker color based on status
        let markerColor = '#ef4444'; // red for active
        if (caseData.status === 'PENDING') markerColor = '#f59e0b'; // amber for pending
        if (caseData.status === 'REUNITED') markerColor = '#10b981'; // green for reunited

        // Create custom icon with photo or emoji
        const hasPhoto = caseData.photoUrl && caseData.photoUrl.trim();
        const icon = L.divIcon({
          className: 'custom-case-marker',
          html: `
            <div data-case-id="${caseData.id}" style="
              width: 48px;
              height: 48px;
              background: ${markerColor};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 20px ${markerColor}80;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${hasPhoto ? '0' : '24px'};
              cursor: pointer;
              overflow: hidden;
              ${caseData.urgency === 'HIGH' ? 'animation: pulse 2s infinite;' : ''}
            ">
              ${hasPhoto
                ? `<img src="${caseData.photoUrl}" alt="${caseData.petName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.parentElement.innerHTML='${getSpeciesEmoji(caseData.species)}'; this.parentElement.style.fontSize='24px';" />`
                : getSpeciesEmoji(caseData.species)
              }
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        const marker = L.marker([lat, lng], { icon })
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
