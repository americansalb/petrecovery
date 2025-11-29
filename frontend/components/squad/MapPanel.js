'use client';

/**
 * MapPanel - Center panel with interactive map
 *
 * Shows:
 * - Case pins with urgency-based glowing
 * - Division boundaries (subtle outlines)
 * - User location (if on duty and location shared)
 * - Clustering for dense areas
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSquadHub } from './context/SquadHubContext';
import { MapPin, Crosshair, Layers } from 'lucide-react';

// Urgency color mapping
const urgencyConfig = {
  HIGH: { color: '#ef4444', pulse: true, size: 40 },
  MEDIUM: { color: '#f59e0b', pulse: true, size: 32 },
  LOW: { color: '#6366f1', pulse: false, size: 28 },
};

// Species emoji
const speciesEmoji = {
  DOG: '🐕',
  CAT: '🐈',
  BIRD: '🐦',
  RABBIT: '🐰',
  OTHER: '🐾',
};

export default function MapPanel() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const divisionLayersRef = useRef({});
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const {
    squad,
    mapCases,
    divisions,
    selectedDivisionId,
    selectedCaseId,
    selectCase,
    helpOnCase,
    membership,
  } = useSquadHub();

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Default center (squad center or Chicago)
      const center = squad.centerLat && squad.centerLng
        ? [squad.centerLat, squad.centerLng]
        : [41.8781, -87.6298];

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark tactical tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      // Add zoom control to bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [squad.centerLat, squad.centerLng]);

  // Draw division boundaries
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const drawDivisions = async () => {
      const L = (await import('leaflet')).default;

      // Clear old division layers
      Object.values(divisionLayersRef.current).forEach(layer => layer.remove());
      divisionLayersRef.current = {};

      divisions.forEach(div => {
        if (!div.bounds) return;

        const { north, south, east, west } = div.bounds;
        const bounds = [[south, west], [north, east]];
        const isSelected = selectedDivisionId === div.id;

        const rect = L.rectangle(bounds, {
          color: isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.2)',
          weight: isSelected ? 2 : 1,
          fillColor: isSelected ? '#22d3ee' : 'transparent',
          fillOpacity: isSelected ? 0.05 : 0,
          dashArray: isSelected ? null : '4, 4',
        }).addTo(mapInstanceRef.current);

        // Tooltip with division name
        rect.bindTooltip(div.name, {
          permanent: false,
          direction: 'center',
          className: 'hub-division-tooltip',
        });

        divisionLayersRef.current[div.id] = rect;
      });
    };

    drawDivisions();
  }, [mapReady, divisions, selectedDivisionId]);

  // Draw case markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const drawMarkers = async () => {
      const L = (await import('leaflet')).default;

      // Clear old markers
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};

      mapCases.forEach(caseItem => {
        if (caseItem.lastSeenLat == null || caseItem.lastSeenLng == null) return;

        const config = urgencyConfig[caseItem.urgency] || urgencyConfig.LOW;
        const isSelected = caseItem.id === selectedCaseId;
        const size = isSelected ? config.size + 12 : config.size;
        const emoji = speciesEmoji[caseItem.species] || '🐾';

        const iconHtml = `
          <div class="hub-pin ${config.pulse ? `hub-pin-${caseItem.urgency.toLowerCase()}` : ''}"
               style="
                 width: ${size}px;
                 height: ${size}px;
                 border: 3px solid ${config.color};
                 background: ${caseItem.photoUrl ? `url(${caseItem.photoUrl})` : 'var(--hub-bg-card)'};
                 background-size: cover;
                 background-position: center;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 cursor: pointer;
                 transition: all 0.2s;
                 ${isSelected ? `box-shadow: 0 0 30px ${config.color};` : ''}
               ">
            ${!caseItem.photoUrl ? `<span style="font-size: ${size * 0.45}px;">${emoji}</span>` : ''}
          </div>
          ${caseItem.urgency === 'HIGH' ? `
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              width: 18px;
              height: 18px;
              background: ${config.color};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: bold;
              color: white;
              animation: pulse 1.5s infinite;
            ">!</div>
          ` : ''}
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: 'hub-case-marker',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker(
          [caseItem.lastSeenLat, caseItem.lastSeenLng],
          { icon }
        ).addTo(mapInstanceRef.current);

        // Click to select
        marker.on('click', () => {
          selectCase(caseItem.id);
        });

        // Popup with case preview
        const popupContent = `
          <div style="min-width: 180px; font-family: system-ui, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="
                width: 36px; height: 36px; border-radius: 50%;
                border: 2px solid ${config.color};
                background: ${caseItem.photoUrl ? `url(${caseItem.photoUrl})` : 'var(--hub-bg-card)'};
                background-size: cover;
                display: flex; align-items: center; justify-content: center;
              ">
                ${!caseItem.photoUrl ? `<span style="font-size: 18px;">${emoji}</span>` : ''}
              </div>
              <div>
                <div style="font-weight: 600; color: var(--hub-text-primary);">
                  ${caseItem.petName}
                </div>
                <div style="font-size: 11px; color: ${config.color}; font-weight: 500;">
                  ${getTimeAgo(caseItem.lastSeenAt)}
                </div>
              </div>
            </div>
            <div style="font-size: 11px; color: var(--hub-text-muted); margin-bottom: 8px;">
              ${caseItem.species?.charAt(0)}${caseItem.species?.slice(1).toLowerCase()}
              ${caseItem.breed ? ` • ${caseItem.breed}` : ''}
            </div>
            <button
              onclick="window.__hubHelpCase && window.__hubHelpCase('${caseItem.id}')"
              style="
                width: 100%; padding: 8px;
                background: ${config.color}; color: white;
                border: none; border-radius: 6px;
                font-size: 12px; font-weight: 600;
                cursor: pointer;
              "
            >
              Help with ${caseItem.petName}
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'hub-case-popup',
          closeButton: false,
        });

        markersRef.current[caseItem.id] = marker;
      });

      // Expose help function globally for popup buttons
      if (typeof window !== 'undefined') {
        window.__hubHelpCase = helpOnCase;
      }
    };

    drawMarkers();

    return () => {
      if (typeof window !== 'undefined') {
        delete window.__hubHelpCase;
      }
    };
  }, [mapReady, mapCases, selectedCaseId, selectCase, helpOnCase]);

  // Focus on selected case
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedCaseId) return;

    const selectedCase = mapCases.find(c => c.id === selectedCaseId);
    if (selectedCase && selectedCase.lastSeenLat && selectedCase.lastSeenLng) {
      mapInstanceRef.current.flyTo(
        [selectedCase.lastSeenLat, selectedCase.lastSeenLng],
        16,
        { duration: 0.5 }
      );

      // Open popup
      const marker = markersRef.current[selectedCaseId];
      if (marker) {
        marker.openPopup();
      }
    }
  }, [mapReady, selectedCaseId, mapCases]);

  // Handle user location
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 15, { duration: 0.5 });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      }
    );
  }, []);

  // Draw user location marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;

    const drawUserMarker = async () => {
      const L = (await import('leaflet')).default;

      const iconHtml = `
        <div style="
          width: 20px; height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
        ">
          <div style="
            position: absolute;
            top: 50%; left: 50%;
            width: 6px; height: 6px;
            background: white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
          "></div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'hub-user-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker(userLocation, { icon })
        .addTo(mapInstanceRef.current)
        .bindTooltip('You', { permanent: false, direction: 'top' });
    };

    drawUserMarker();
  }, [mapReady, userLocation]);

  return (
    <div className="h-full relative bg-[var(--hub-bg-root)]">
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{ background: 'var(--hub-bg-root)' }}
      />

      {/* Map controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        {/* Locate me button */}
        <button
          onClick={handleLocateMe}
          className="w-10 h-10 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] flex items-center justify-center text-[var(--hub-text-secondary)] hover:text-[var(--hub-accent-primary)] hover:border-[var(--hub-accent-primary)]/40 transition-all"
          title="Find my location"
        >
          <Crosshair size={18} />
        </button>
      </div>

      {/* Case count badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="px-3 py-2 rounded-lg bg-[var(--hub-bg-panel)]/90 backdrop-blur border border-[var(--hub-border)] flex items-center gap-2">
          <MapPin size={14} className="text-[var(--hub-accent-primary)]" />
          <span className="text-xs text-[var(--hub-text-primary)] font-medium">
            {mapCases.length} active case{mapCases.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Map styles */}
      <style jsx global>{`
        .hub-case-marker {
          background: transparent !important;
          border: none !important;
        }

        .hub-case-popup .leaflet-popup-content-wrapper {
          background: var(--hub-bg-panel) !important;
          border: 1px solid var(--hub-border) !important;
          border-radius: 12px !important;
          padding: 0 !important;
        }

        .hub-case-popup .leaflet-popup-content {
          margin: 12px !important;
        }

        .hub-case-popup .leaflet-popup-tip {
          background: var(--hub-bg-panel) !important;
          border: 1px solid var(--hub-border) !important;
        }

        .hub-division-tooltip {
          background: var(--hub-bg-panel) !important;
          border: 1px solid var(--hub-border) !important;
          border-radius: 6px !important;
          color: var(--hub-text-secondary) !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

function getTimeAgo(isoString) {
  if (!isoString) return 'Unknown';
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
