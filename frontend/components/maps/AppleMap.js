'use client';

/**
 * AppleMap - Reusable Apple Maps Component
 *
 * Drop-in replacement for Leaflet maps using Apple MapKit JS.
 * Supports markers, polylines, circles, and polygons.
 */

import { useEffect, useRef, useMemo } from 'react';
import useAppleMap from '@/app/lib/maps/useAppleMap';
import { MapColors } from '@/app/lib/maps/appleMapKit';

/**
 * AppleMap Component
 *
 * @param {Object} props
 * @param {string} props.className - CSS class for container
 * @param {Object} props.center - Map center { lat, lng }
 * @param {number} props.zoom - Zoom level (1-20)
 * @param {string} props.mapType - 'standard' | 'satellite' | 'hybrid' | 'mutedStandard'
 * @param {string} props.colorScheme - 'light' | 'dark'
 * @param {boolean} props.showUserLocation - Show user location dot
 * @param {Array} props.markers - Array of marker objects { lat, lng, options }
 * @param {Array} props.polylines - Array of polyline objects { coordinates, options }
 * @param {Array} props.circles - Array of circle objects { lat, lng, radius, options }
 * @param {Array} props.polygons - Array of polygon objects { coordinates, options }
 * @param {Object} props.lastSeenLocation - Last seen marker { lat, lng }
 * @param {Array} props.sightings - Array of sighting objects
 * @param {Array} props.searchPath - GPS search path coordinates
 * @param {Function} props.onMarkerClick - Callback when marker is clicked
 * @param {Function} props.onMapClick - Callback when map is clicked
 * @param {Function} props.onMapReady - Callback when map is ready
 */
export default function AppleMap({
  className = '',
  center = { lat: 39.8283, lng: -98.5795 },
  zoom = 14,
  mapType = 'mutedStandard',
  colorScheme = 'dark',
  showUserLocation = true,
  markers = [],
  polylines = [],
  circles = [],
  polygons = [],
  lastSeenLocation = null,
  sightings = [],
  searchPath = [],
  probabilityZones = [],
  onMarkerClick,
  onMapClick,
  onMapReady,
  children,
}) {
  const prevMarkersRef = useRef([]);
  const prevOverlaysRef = useRef({ polylines: [], circles: [], polygons: [] });
  const lastSeenMarkerRef = useRef(null);
  const sightingMarkersRef = useRef([]);
  const searchPathRef = useRef(null);
  const probabilityOverlaysRef = useRef([]);

  const {
    mapRef,
    isLoading,
    error,
    mapReady,
    map,
    addMarker,
    addMarkers,
    addPolyline,
    addCircle,
    addPolygon,
    removeAnnotation,
    removeOverlay,
    clearAnnotations,
    clearOverlays,
    fitToAnnotations,
    MapColors: Colors,
  } = useAppleMap({
    center,
    zoom,
    mapType,
    colorScheme,
    showUserLocation,
    onMapReady: (mapInstance) => {
      if (onMapReady) onMapReady(mapInstance);
    },
    onAnnotationSelect: (annotation, data) => {
      if (onMarkerClick && data) {
        onMarkerClick(data);
      }
    },
  });

  // Handle custom markers
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old markers
    prevMarkersRef.current.forEach(m => removeAnnotation(m));
    prevMarkersRef.current = [];

    // Add new markers
    if (markers.length > 0) {
      const newMarkers = markers.map(m => {
        return addMarker(m.lat, m.lng, {
          ...m.options,
          data: m.data || m,
        });
      }).filter(Boolean);
      prevMarkersRef.current = newMarkers;
    }
  }, [mapReady, map, markers, addMarker, removeAnnotation]);

  // Handle last seen location marker
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old marker
    if (lastSeenMarkerRef.current) {
      removeAnnotation(lastSeenMarkerRef.current);
      lastSeenMarkerRef.current = null;
    }

    // Add new marker
    if (lastSeenLocation && lastSeenLocation.lat && lastSeenLocation.lng) {
      lastSeenMarkerRef.current = addMarker(lastSeenLocation.lat, lastSeenLocation.lng, {
        color: MapColors.LAST_SEEN,
        title: 'Last Seen',
        glyphText: '📍',
        data: { type: 'lastSeen', ...lastSeenLocation },
      });
    }
  }, [mapReady, map, lastSeenLocation, addMarker, removeAnnotation]);

  // Handle sighting markers
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old markers
    sightingMarkersRef.current.forEach(m => removeAnnotation(m));
    sightingMarkersRef.current = [];

    // Add new sighting markers
    if (sightings.length > 0) {
      sightings.forEach((sighting, index) => {
        const lat = sighting.latitude || sighting.lat;
        const lng = sighting.longitude || sighting.lng;

        if (lat && lng) {
          const marker = addMarker(lat, lng, {
            color: getSightingColor(sighting),
            title: `Sighting ${index + 1}`,
            subtitle: sighting.description || getTimeAgo(sighting.createdAt),
            glyphText: '👁',
            data: { type: 'sighting', ...sighting },
          });
          if (marker) sightingMarkersRef.current.push(marker);
        }
      });
    }
  }, [mapReady, map, sightings, addMarker, removeAnnotation]);

  // Handle search path (GPS trail)
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old path
    if (searchPathRef.current) {
      removeOverlay(searchPathRef.current);
      searchPathRef.current = null;
    }

    // Add new path
    if (searchPath && searchPath.length > 1) {
      searchPathRef.current = addPolyline(searchPath, {
        strokeColor: MapColors.SEARCH_PATH,
        strokeOpacity: 0.9,
        lineWidth: 4,
      });
    }
  }, [mapReady, map, searchPath, addPolyline, removeOverlay]);

  // Handle probability zones
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old zones
    probabilityOverlaysRef.current.forEach(o => removeOverlay(o));
    probabilityOverlaysRef.current = [];

    // Add new zones
    if (probabilityZones.length > 0) {
      probabilityZones.forEach(zone => {
        const overlay = addCircle(zone.lat, zone.lng, zone.radius, {
          strokeColor: zone.color || MapColors.MEDIUM_PROB,
          strokeOpacity: 0.6,
          fillColor: zone.color || MapColors.MEDIUM_PROB,
          fillOpacity: 0.15,
          lineWidth: 2,
        });
        if (overlay) probabilityOverlaysRef.current.push(overlay);
      });
    }
  }, [mapReady, map, probabilityZones, addCircle, removeOverlay]);

  // Handle custom circles
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old circles
    prevOverlaysRef.current.circles.forEach(o => removeOverlay(o));
    prevOverlaysRef.current.circles = [];

    // Add new circles
    if (circles.length > 0) {
      circles.forEach(c => {
        const overlay = addCircle(c.lat, c.lng, c.radius, c.options || {});
        if (overlay) prevOverlaysRef.current.circles.push(overlay);
      });
    }
  }, [mapReady, map, circles, addCircle, removeOverlay]);

  // Handle custom polylines
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old polylines
    prevOverlaysRef.current.polylines.forEach(o => removeOverlay(o));
    prevOverlaysRef.current.polylines = [];

    // Add new polylines
    if (polylines.length > 0) {
      polylines.forEach(p => {
        const overlay = addPolyline(p.coordinates, p.options || {});
        if (overlay) prevOverlaysRef.current.polylines.push(overlay);
      });
    }
  }, [mapReady, map, polylines, addPolyline, removeOverlay]);

  // Handle custom polygons
  useEffect(() => {
    if (!mapReady || !map) return;

    // Remove old polygons
    prevOverlaysRef.current.polygons.forEach(o => removeOverlay(o));
    prevOverlaysRef.current.polygons = [];

    // Add new polygons
    if (polygons.length > 0) {
      polygons.forEach(p => {
        const overlay = addPolygon(p.coordinates, p.options || {});
        if (overlay) prevOverlaysRef.current.polygons.push(overlay);
      });
    }
  }, [mapReady, map, polygons, addPolygon, removeOverlay]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '300px' }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-flash-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center z-10">
          <div className="text-center p-4">
            <div className="text-red-400 text-4xl mb-3">⚠️</div>
            <p className="text-red-300 text-sm mb-2">Map Error</p>
            <p className="text-slate-500 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Children (for custom overlays like controls) */}
      {children}
    </div>
  );
}

/**
 * Get color based on sighting recency and confidence
 */
function getSightingColor(sighting) {
  const hoursAgo = sighting.createdAt
    ? (Date.now() - new Date(sighting.createdAt).getTime()) / 3600000
    : 24;

  if (hoursAgo < 1) return MapColors.URGENT;      // Red - very recent
  if (hoursAgo < 4) return MapColors.ACTIVE;      // Orange - recent
  if (hoursAgo < 24) return MapColors.EXTENDED;   // Yellow - same day
  return '#8E8E93';                               // Gray - old
}

/**
 * Format time ago
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

// Re-export MapColors for convenience
export { MapColors };
