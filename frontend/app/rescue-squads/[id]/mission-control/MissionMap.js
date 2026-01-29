'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Urgency color based on hours missing
function getUrgencyColor(lastSeenAt) {
  if (!lastSeenAt) return '#f59e0b';
  const hours = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hours < 4) return '#dc2626';
  if (hours < 24) return '#f59e0b';
  return '#eab308';
}

export default function MissionMap({ squad, cases, selectedMission, onSelectCase }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default to squad center or Chicago
    const center = squad?.centerLatitude && squad?.centerLongitude
      ? [squad.centerLatitude, squad.centerLongitude]
      : [41.8781, -87.6298];

    mapInstanceRef.current = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, 12);

    // Dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    // Add squad center marker
    if (squad?.centerLatitude && squad?.centerLongitude) {
      const squadIcon = L.divIcon({
        className: 'squad-center-marker',
        html: `<div style="
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.3);
          border: 3px solid #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">🏠</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([squad.centerLatitude, squad.centerLongitude], { icon: squadIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${squad.name}</b><br>Force Headquarters`);

      // Add radius circle
      if (squad.radiusMiles) {
        L.circle([squad.centerLatitude, squad.centerLongitude], {
          radius: squad.radiusMiles * 1609.34, // Convert miles to meters
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.05,
          weight: 1,
          dashArray: '5, 10',
        }).addTo(mapInstanceRef.current);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [squad]);

  // Update case markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add case markers
    cases.forEach(caseItem => {
      if (!caseItem.lastSeenLatitude || !caseItem.lastSeenLongitude) return;

      const urgencyColor = getUrgencyColor(caseItem.lastSeenAt);
      const isSelected = selectedMission?.id === caseItem.id;

      const caseIcon = L.divIcon({
        className: 'case-marker',
        html: `<div style="
          width: ${isSelected ? '48px' : '36px'};
          height: ${isSelected ? '48px' : '36px'};
          background: ${urgencyColor};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isSelected ? '24px' : '18px'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
          transition: all 0.2s;
          ${isSelected ? 'transform: scale(1.1);' : ''}
        ">${caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}</div>`,
        iconSize: [isSelected ? 48 : 36, isSelected ? 48 : 36],
        iconAnchor: [isSelected ? 24 : 18, isSelected ? 24 : 18],
      });

      const marker = L.marker(
        [caseItem.lastSeenLatitude, caseItem.lastSeenLongitude],
        { icon: caseIcon }
      )
        .addTo(mapInstanceRef.current)
        .on('click', () => onSelectCase(caseItem));

      // Popup content
      const popupContent = `
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
            ${caseItem.petName || 'Unknown'}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
            ${caseItem.petSpecies} • ${caseItem.petBreed || 'Unknown breed'}
          </div>
          <div style="font-size: 11px; color: #888; margin-bottom: 8px;">
            ${caseItem.lastSeenAddress || 'Location unknown'}
          </div>
          <div style="
            padding: 6px 12px;
            background: ${urgencyColor};
            color: white;
            border-radius: 4px;
            text-align: center;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
          ">
            View Details
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers if we have cases
    if (cases.length > 0 && markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      // Only fit bounds if not tracking a specific selected case
      if (!selectedMission) {
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [cases, selectedMission, onSelectCase]);

  // Pan to selected case
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedMission?.lastSeenLatitude || !selectedMission?.lastSeenLongitude) return;

    mapInstanceRef.current.setView(
      [selectedMission.lastSeenLatitude, selectedMission.lastSeenLongitude],
      14,
      { animate: true }
    );
  }, [selectedMission]);

  return (
    <div
      ref={mapRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0f172a',
      }}
    />
  );
}
