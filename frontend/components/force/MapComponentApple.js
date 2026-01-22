'use client';

/**
 * MapComponentApple - Apple MapKit implementation for Force Hub
 *
 * Renders the interactive Apple Map with case pins, force coverage area,
 * and case markers with photo/emoji support.
 *
 * Features:
 * - Dark mode Apple Maps
 * - Custom case markers with photos
 * - Force coverage circle overlay
 * - Click handlers for case selection
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import useAppleMap from '@/app/lib/maps/useAppleMap';
import { MapColors } from '@/app/lib/maps/appleMapKit';

// Species emoji mapping
const SPECIES_EMOJI = {
  DOG: '🐕',
  CAT: '🐈',
  BIRD: '🐦',
  RABBIT: '🐰',
  OTHER: '🐾',
};

export default function MapComponentApple({
  cases = [],
  divisions = [],
  force = {},
  onCaseClick,
}) {
  const caseMarkersRef = useRef([]);
  const coverageOverlayRef = useRef(null);

  // Compute center from force data
  const mapCenter = useMemo(() => ({
    lat: force.centerLat || force.centerLatitude || 41.8781,
    lng: force.centerLng || force.centerLongitude || -87.6298,
  }), [force.centerLat, force.centerLatitude, force.centerLng, force.centerLongitude]);

  const {
    mapRef,
    isLoading,
    error,
    mapReady,
    map,
    addMarker,
    addCircle,
    removeAnnotation,
    removeOverlay,
    clearAnnotations,
    setCenter,
    fitToAnnotations,
  } = useAppleMap({
    center: mapCenter,
    zoom: 13,
    mapType: 'mutedStandard',
    colorScheme: 'dark',
    showUserLocation: false,
    onAnnotationSelect: (annotation, data) => {
      if (data?.missionId && onCaseClick) {
        onCaseClick(data.missionId);
      }
    },
  });

  // Add force coverage circle
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old coverage overlay
    if (coverageOverlayRef.current) {
      removeOverlay(coverageOverlayRef.current);
      coverageOverlayRef.current = null;
    }

    // Add coverage area circle (default 10 mile radius = ~16000 meters)
    if (mapCenter.lat && mapCenter.lng) {
      const radiusMeters = (force.coverageRadiusMiles || 10) * 1609.34;
      coverageOverlayRef.current = addCircle(mapCenter.lat, mapCenter.lng, radiusMeters, {
        strokeColor: '#3b82f6', // blue-500
        strokeOpacity: 0.6,
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        lineWidth: 2,
      });
    }

    return () => {
      if (coverageOverlayRef.current) {
        removeOverlay(coverageOverlayRef.current);
        coverageOverlayRef.current = null;
      }
    };
  }, [mapReady, map, mapCenter, force.coverageRadiusMiles, addCircle, removeOverlay]);

  // Update case markers when cases change
  useEffect(() => {
    if (!mapReady || !map) return;

    // Clear existing markers
    caseMarkersRef.current.forEach(marker => removeAnnotation(marker));
    caseMarkersRef.current = [];

    if (!cases || cases.length === 0) return;

    // Group cases by location to handle overlapping
    const locationGroups = new Map();
    cases.forEach(missionData => {
      const lat = missionData.lastSeenLat || missionData.lastSeenLatitude;
      const lng = missionData.lastSeenLng || missionData.lastSeenLongitude;
      if (!lat || !lng) return;

      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key).push(missionData);
    });

    // Add markers with offset for overlapping cases
    locationGroups.forEach((casesAtLocation) => {
      casesAtLocation.forEach((missionData, index) => {
        const baseLat = missionData.lastSeenLat || missionData.lastSeenLatitude;
        const baseLng = missionData.lastSeenLng || missionData.lastSeenLongitude;

        // Calculate spiral offset for overlapping markers
        let offsetLat = 0;
        let offsetLng = 0;
        if (index > 0) {
          const angle = (index * 60) * (Math.PI / 180);
          const radius = 0.0003 * Math.ceil(index / 6);
          offsetLat = Math.sin(angle) * radius;
          offsetLng = Math.cos(angle) * radius;
        }

        const lat = baseLat + offsetLat;
        const lng = baseLng + offsetLng;

        // Determine marker color based on status
        let markerColor = MapColors.URGENT; // red for active
        if (missionData.status === 'PENDING') markerColor = MapColors.ACTIVE; // orange
        if (missionData.status === 'REUNITED') markerColor = MapColors.SUCCESS; // green

        // Get glyph (emoji)
        const emoji = SPECIES_EMOJI[missionData.species] || SPECIES_EMOJI.OTHER;

        const marker = addMarker(lat, lng, {
          color: markerColor,
          title: missionData.petName || 'Missing Pet',
          subtitle: getTimeAgo(missionData.lastSeenAt || missionData.createdAt),
          glyphText: emoji,
          data: {
            missionId: missionData.id,
            petName: missionData.petName,
            species: missionData.species,
            status: missionData.status,
            photoUrl: missionData.photoUrl,
          },
        });

        if (marker) {
          caseMarkersRef.current.push(marker);
        }
      });
    });

    // Fit map to show all markers if we have them
    if (caseMarkersRef.current.length > 0) {
      // Don't auto-fit, let the user control the view
      // fitToAnnotations();
    }

  }, [mapReady, map, cases, addMarker, removeAnnotation]);

  return (
    <div className="relative">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-[600px] rounded-2xl overflow-hidden border-2 border-slate-700/60 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center z-10 rounded-2xl">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-flash-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading Apple Maps...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-900/95 flex items-center justify-center z-10 rounded-2xl">
          <div className="text-center p-6">
            <div className="text-red-400 text-4xl mb-3">⚠️</div>
            <p className="text-red-300 font-medium mb-2">Map Error</p>
            <p className="text-slate-500 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Apple Maps Badge */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-400 flex items-center gap-1">
          <span></span>
          <span>Apple Maps</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Calculate time ago string
 */
function getTimeAgo(dateString) {
  if (!dateString) return '';

  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
