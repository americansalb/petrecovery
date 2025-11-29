'use client';

/**
 * TacticalMap - Full Screen Map Layer
 *
 * Layer 0 of the Map-OS architecture.
 * Shows case pins, volunteer positions, and squad zones.
 * Tapping a case doesn't navigate - it focuses the map and morphs the HUD.
 */

import { useEffect, useRef, useState } from 'react';
import { useSquad, VIEW_MODES, ALERT_LEVELS } from '../context/SquadContext';

// Urgency calculation
function getUrgencyLevel(lastSeenAt) {
  if (!lastSeenAt) return 'MEDIUM';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hours < 4) return 'CRITICAL';
  if (hours < 24) return 'HIGH';
  if (hours < 72) return 'MEDIUM';
  return 'LOW';
}

function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'CRITICAL': return '#ef4444'; // Red
    case 'HIGH': return '#f97316';     // Orange
    case 'MEDIUM': return '#eab308';   // Yellow
    case 'LOW': return '#6b7280';      // Gray
    default: return '#f97316';
  }
}

export default function TacticalMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const volunteerMarkersRef = useRef({});
  const squadCircleRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const {
    squad,
    cases,
    volunteers,
    viewMode,
    selectedCaseId,
    mapCenter,
    mapZoom,
    alertLevel,
    myPosition,
    selectCase,
  } = useSquad();

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Default center (will update when squad loads)
      const center = mapCenter || [40.7128, -74.006];

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center,
        zoom: mapZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark tactical tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
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
  }, []);

  // Update map center/zoom
  useEffect(() => {
    if (!mapInstanceRef.current || !mapCenter) return;
    mapInstanceRef.current.flyTo(mapCenter, mapZoom, { duration: 0.5 });
  }, [mapCenter, mapZoom]);

  // Draw squad coverage circle
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !squad) return;

    const L = require('leaflet');

    // Remove old circle
    if (squadCircleRef.current) {
      squadCircleRef.current.remove();
    }

    if (squad.centerLatitude && squad.centerLongitude) {
      const radiusMeters = (squad.radiusMiles || 10) * 1609.34;

      squadCircleRef.current = L.circle(
        [squad.centerLatitude, squad.centerLongitude],
        {
          radius: radiusMeters,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.05,
          weight: 2,
          dashArray: '8, 8',
        }
      ).addTo(mapInstanceRef.current);
    }
  }, [mapReady, squad]);

  // Draw case markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const L = require('leaflet');

    // Clear old markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    cases.forEach(caseItem => {
      if (!caseItem.lastSeenLatitude || !caseItem.lastSeenLongitude) return;

      const urgency = getUrgencyLevel(caseItem.lastSeenAt);
      const color = getUrgencyColor(urgency);
      const isSelected = caseItem.id === selectedCaseId;
      const size = isSelected ? 48 : urgency === 'CRITICAL' ? 40 : 32;

      // Custom icon with pet photo or species icon
      const iconHtml = `
        <div class="case-marker ${urgency.toLowerCase()} ${isSelected ? 'selected' : ''}"
             style="
               width: ${size}px;
               height: ${size}px;
               border-radius: 50%;
               border: 3px solid ${color};
               background: ${caseItem.petPhotoUrl ? `url(${caseItem.petPhotoUrl})` : '#1e293b'};
               background-size: cover;
               background-position: center;
               display: flex;
               align-items: center;
               justify-content: center;
               box-shadow: 0 0 ${urgency === 'CRITICAL' ? '20px' : '10px'} ${color}40;
               cursor: pointer;
               transition: all 0.2s;
               ${urgency === 'CRITICAL' ? 'animation: pulse-glow 2s infinite;' : ''}
             ">
          ${!caseItem.petPhotoUrl ? `<span style="font-size: ${size * 0.5}px;">
            ${caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}
          </span>` : ''}
        </div>
        ${urgency === 'CRITICAL' ? `
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background: ${color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
            animation: pulse 1.5s infinite;
          ">!</div>
        ` : ''}
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'tactical-case-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker(
        [caseItem.lastSeenLatitude, caseItem.lastSeenLongitude],
        { icon }
      ).addTo(mapInstanceRef.current);

      // Click to focus
      marker.on('click', () => {
        selectCase(caseItem);
      });

      // Tooltip
      marker.bindTooltip(`
        <div style="text-align: center; min-width: 120px;">
          <strong>${caseItem.petName || 'Unknown'}</strong><br/>
          <span style="color: ${color}; font-weight: bold;">
            ${getTimeAgo(caseItem.lastSeenAt)}
          </span>
        </div>
      `, {
        direction: 'top',
        offset: [0, -size / 2 - 5],
        className: 'tactical-tooltip',
      });

      markersRef.current[caseItem.id] = marker;
    });
  }, [mapReady, cases, selectedCaseId, selectCase]);

  // Draw volunteer markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const L = require('leaflet');

    // Clear old volunteer markers
    Object.values(volunteerMarkersRef.current).forEach(marker => marker.remove());
    volunteerMarkersRef.current = {};

    volunteers.forEach(volunteer => {
      if (!volunteer.latitude || !volunteer.longitude) return;

      const iconHtml = `
        <div style="
          width: 16px;
          height: 16px;
          background: #22c55e;
          border: 2px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 8px #22c55e80;
        "></div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'volunteer-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker(
        [volunteer.latitude, volunteer.longitude],
        { icon }
      ).addTo(mapInstanceRef.current);

      marker.bindTooltip(volunteer.name || 'Volunteer', {
        direction: 'top',
        offset: [0, -10],
        className: 'tactical-tooltip',
      });

      volunteerMarkersRef.current[volunteer.id] = marker;
    });
  }, [mapReady, volunteers]);

  // Draw my position
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !myPosition) return;

    const L = require('leaflet');

    const iconHtml = `
      <div style="
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 12px #3b82f680;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: #fff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        "></div>
      </div>
    `;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'my-position-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    // TODO: Add/update my position marker
  }, [mapReady, myPosition]);

  // Containment mode overlay
  useEffect(() => {
    if (alertLevel === ALERT_LEVELS.CRITICAL && mapInstanceRef.current) {
      mapContainerRef.current.classList.add('containment-mode');
    } else {
      mapContainerRef.current?.classList.remove('containment-mode');
    }
  }, [alertLevel]);

  return (
    <>
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0f172a',
        }}
      />

      {/* CSS for markers and animations */}
      <style jsx global>{`
        .tactical-case-marker {
          background: transparent !important;
          border: none !important;
        }

        .tactical-tooltip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          color: #fff !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          font-size: 12px !important;
          padding: 8px 12px !important;
        }

        .tactical-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }

        .leaflet-container {
          background: #0f172a !important;
          font-family: system-ui, -apple-system, sans-serif !important;
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px #ef444440;
          }
          50% {
            box-shadow: 0 0 30px #ef444480;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }

        .containment-mode {
          animation: containment-flash 2s infinite;
        }

        @keyframes containment-flash {
          0%, 100% {
            box-shadow: inset 0 0 0 0 transparent;
          }
          50% {
            box-shadow: inset 0 0 60px #ef444430;
          }
        }

        /* Hide Leaflet branding */
        .leaflet-control-attribution {
          display: none !important;
        }
      `}</style>
    </>
  );
}

// Helper
function getTimeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
