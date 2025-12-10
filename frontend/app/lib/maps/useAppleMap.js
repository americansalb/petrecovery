'use client';

/**
 * useAppleMap - React hook for Apple MapKit JS
 *
 * Provides easy-to-use interface for creating and managing Apple Maps
 * in React components with automatic cleanup and state management.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initializeMapKit,
  isMapKitInitialized,
  createCoordinate,
  createCoordinateRegion,
  createMarkerAnnotation,
  createCircleOverlay,
  createPolylineOverlay,
  createPolygonOverlay,
  MapTypes,
  MapColors,
  DefaultMapOptions,
} from './appleMapKit';

/**
 * Hook to use Apple Maps in a component
 *
 * @param {Object} options - Map configuration options
 * @param {Object} options.center - Initial center { lat, lng }
 * @param {number} options.zoom - Initial zoom level (1-20)
 * @param {string} options.mapType - Map type (standard, satellite, hybrid, mutedStandard)
 * @param {string} options.colorScheme - Color scheme ('light' | 'dark')
 * @param {boolean} options.showsUserLocation - Show user location dot
 * @param {Function} options.onMapReady - Callback when map is ready
 * @param {Function} options.onError - Callback on error
 */
export default function useAppleMap(options = {}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const annotationsRef = useRef([]);
  const overlaysRef = useRef([]);

  const {
    center = DefaultMapOptions.center,
    zoom = DefaultMapOptions.zoom,
    mapType = MapTypes.STANDARD,
    colorScheme = 'dark',
    showsUserLocation = true,
    showsUserLocationControl = true,
    tracksUserLocation = false,
    onMapReady,
    onError,
    onAnnotationSelect,
    onAnnotationDeselect,
    onRegionChange,
  } = options;

  // Initialize MapKit and create map
  useEffect(() => {
    let mounted = true;
    let map = null;

    const initMap = async () => {
      try {
        if (!mapRef.current) {
          return;
        }

        setIsLoading(true);
        setError(null);

        // Initialize MapKit JS
        const mapkit = await initializeMapKit();

        if (!mounted) return;

        // Create map instance
        map = new mapkit.Map(mapRef.current, {
          center: new mapkit.Coordinate(center.lat, center.lng),
          showsCompass: mapkit.FeatureVisibility.Adaptive,
          showsScale: mapkit.FeatureVisibility.Adaptive,
          showsUserLocation,
          showsUserLocationControl,
          tracksUserLocation,
          mapType: mapkit.Map.MapTypes[mapType.charAt(0).toUpperCase() + mapType.slice(1)] || mapkit.Map.MapTypes.Standard,
          colorScheme: colorScheme === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light,
        });

        // Set zoom via camera distance (MapKit uses camera distance, not zoom levels)
        // Approximate conversion: distance = 591657550.5 / (2 ^ zoom)
        const cameraDistance = 591657550.5 / Math.pow(2, zoom);
        map.cameraDistance = cameraDistance;

        // Store reference
        mapInstanceRef.current = map;

        // Set up event listeners
        if (onAnnotationSelect) {
          map.addEventListener('select', (event) => {
            if (event.annotation) {
              onAnnotationSelect(event.annotation, event.annotation.data);
            }
          });
        }

        if (onAnnotationDeselect) {
          map.addEventListener('deselect', (event) => {
            if (event.annotation) {
              onAnnotationDeselect(event.annotation, event.annotation.data);
            }
          });
        }

        if (onRegionChange) {
          map.addEventListener('region-change-end', () => {
            const region = map.region;
            onRegionChange({
              center: { lat: region.center.latitude, lng: region.center.longitude },
              span: { latDelta: region.span.latitudeDelta, lngDelta: region.span.longitudeDelta },
            });
          });
        }

        setMapReady(true);
        setIsLoading(false);

        if (onMapReady) {
          onMapReady(map);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[useAppleMap] Error:', err);
        setError(err.message || 'Failed to initialize map');
        setIsLoading(false);
        if (onError) {
          onError(err);
        }
      }
    };

    initMap();

    // Cleanup
    return () => {
      mounted = false;
      if (map) {
        map.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      const mapkit = window.mapkit;
      mapInstanceRef.current.center = new mapkit.Coordinate(center.lat, center.lng);
    }
  }, [center.lat, center.lng]);

  // Update map type when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && window.mapkit) {
      const mapkit = window.mapkit;
      const typeKey = mapType.charAt(0).toUpperCase() + mapType.slice(1);
      if (mapkit.Map.MapTypes[typeKey]) {
        mapInstanceRef.current.mapType = mapkit.Map.MapTypes[typeKey];
      }
    }
  }, [mapType]);

  // Update color scheme when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && window.mapkit) {
      const mapkit = window.mapkit;
      mapInstanceRef.current.colorScheme = colorScheme === 'dark'
        ? mapkit.Map.ColorSchemes.Dark
        : mapkit.Map.ColorSchemes.Light;
    }
  }, [colorScheme]);

  /**
   * Set map center
   */
  const setCenter = useCallback((lat, lng, animated = true) => {
    if (!mapInstanceRef.current) return;
    const mapkit = window.mapkit;
    const newCenter = new mapkit.Coordinate(lat, lng);
    if (animated) {
      mapInstanceRef.current.setCenterAnimated(newCenter);
    } else {
      mapInstanceRef.current.center = newCenter;
    }
  }, []);

  /**
   * Set map region (center + span)
   */
  const setRegion = useCallback((centerLat, centerLng, latSpan, lngSpan, animated = true) => {
    if (!mapInstanceRef.current) return;
    const region = createCoordinateRegion(centerLat, centerLng, latSpan, lngSpan);
    if (animated) {
      mapInstanceRef.current.setRegionAnimated(region);
    } else {
      mapInstanceRef.current.region = region;
    }
  }, []);

  /**
   * Set zoom level (approximate)
   */
  const setZoom = useCallback((zoomLevel, animated = true) => {
    if (!mapInstanceRef.current) return;
    const cameraDistance = 591657550.5 / Math.pow(2, zoomLevel);
    if (animated) {
      mapInstanceRef.current.setCameraDistanceAnimated(cameraDistance);
    } else {
      mapInstanceRef.current.cameraDistance = cameraDistance;
    }
  }, []);

  /**
   * Add a marker annotation
   */
  const addMarker = useCallback((lat, lng, options = {}) => {
    if (!mapInstanceRef.current) return null;

    const annotation = createMarkerAnnotation(lat, lng, options);
    mapInstanceRef.current.addAnnotation(annotation);
    annotationsRef.current.push(annotation);

    return annotation;
  }, []);

  /**
   * Add multiple markers at once
   */
  const addMarkers = useCallback((markers) => {
    if (!mapInstanceRef.current) return [];

    const annotations = markers.map(m =>
      createMarkerAnnotation(m.lat, m.lng, m.options || {})
    );

    mapInstanceRef.current.addAnnotations(annotations);
    annotationsRef.current.push(...annotations);

    return annotations;
  }, []);

  /**
   * Remove a specific annotation
   */
  const removeAnnotation = useCallback((annotation) => {
    if (!mapInstanceRef.current || !annotation) return;
    mapInstanceRef.current.removeAnnotation(annotation);
    annotationsRef.current = annotationsRef.current.filter(a => a !== annotation);
  }, []);

  /**
   * Clear all annotations
   */
  const clearAnnotations = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.removeAnnotations(annotationsRef.current);
    annotationsRef.current = [];
  }, []);

  /**
   * Add a circle overlay
   */
  const addCircle = useCallback((centerLat, centerLng, radiusMeters, options = {}) => {
    if (!mapInstanceRef.current) return null;

    const circle = createCircleOverlay(centerLat, centerLng, radiusMeters, options);
    mapInstanceRef.current.addOverlay(circle);
    overlaysRef.current.push(circle);

    return circle;
  }, []);

  /**
   * Add a polyline (for GPS paths)
   */
  const addPolyline = useCallback((coordinates, options = {}) => {
    if (!mapInstanceRef.current || !coordinates.length) return null;

    const polyline = createPolylineOverlay(coordinates, options);
    mapInstanceRef.current.addOverlay(polyline);
    overlaysRef.current.push(polyline);

    return polyline;
  }, []);

  /**
   * Add a polygon (for search areas)
   */
  const addPolygon = useCallback((coordinates, options = {}) => {
    if (!mapInstanceRef.current || !coordinates.length) return null;

    const polygon = createPolygonOverlay(coordinates, options);
    mapInstanceRef.current.addOverlay(polygon);
    overlaysRef.current.push(polygon);

    return polygon;
  }, []);

  /**
   * Remove a specific overlay
   */
  const removeOverlay = useCallback((overlay) => {
    if (!mapInstanceRef.current || !overlay) return;
    mapInstanceRef.current.removeOverlay(overlay);
    overlaysRef.current = overlaysRef.current.filter(o => o !== overlay);
  }, []);

  /**
   * Clear all overlays
   */
  const clearOverlays = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.removeOverlays(overlaysRef.current);
    overlaysRef.current = [];
  }, []);

  /**
   * Clear everything (annotations + overlays)
   */
  const clearAll = useCallback(() => {
    clearAnnotations();
    clearOverlays();
  }, [clearAnnotations, clearOverlays]);

  /**
   * Fit map to show all annotations
   */
  const fitToAnnotations = useCallback((padding = { top: 50, right: 50, bottom: 50, left: 50 }) => {
    if (!mapInstanceRef.current || annotationsRef.current.length === 0) return;

    const mapkit = window.mapkit;
    const annotations = annotationsRef.current;

    // Get bounding coordinates
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    annotations.forEach(a => {
      const lat = a.coordinate.latitude;
      const lng = a.coordinate.longitude;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    // Add padding to span
    const latSpan = (maxLat - minLat) * 1.2 || 0.01;
    const lngSpan = (maxLng - minLng) * 1.2 || 0.01;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(centerLat, centerLng),
      new mapkit.CoordinateSpan(latSpan, lngSpan)
    );

    mapInstanceRef.current.setRegionAnimated(region);
  }, []);

  /**
   * Show user location (re-center on user)
   */
  const showUserLocation = useCallback(() => {
    if (!mapInstanceRef.current) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('[useAppleMap] Geolocation error:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, [setCenter]);

  return {
    // Ref to attach to container element
    mapRef,

    // State
    isLoading,
    error,
    mapReady,

    // Map instance (for advanced usage)
    map: mapInstanceRef.current,

    // Actions
    setCenter,
    setRegion,
    setZoom,

    // Annotations
    addMarker,
    addMarkers,
    removeAnnotation,
    clearAnnotations,

    // Overlays
    addCircle,
    addPolyline,
    addPolygon,
    removeOverlay,
    clearOverlays,

    // Utilities
    clearAll,
    fitToAnnotations,
    showUserLocation,

    // Constants
    MapTypes,
    MapColors,
  };
}
