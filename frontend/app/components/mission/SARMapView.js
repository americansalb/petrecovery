'use client';

/**
 * SAR Map View - Simplified map for Search and Rescue operations
 *
 * Features:
 * - Last seen location marker
 * - Sighting markers with time decay coloring
 * - Probability circles (search radius based on time elapsed)
 * - User location tracking
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';

// Travel speeds (miles per hour) for search radius calculation
const PET_SPEEDS = {
  DOG: { wander: 3, run: 15 },
  CAT: { wander: 1.5, run: 8 },
  DEFAULT: { wander: 2, run: 10 }
};

// Vision radius for coverage (14 meters = ~45 feet)
const VISION_RADIUS_METERS = 14;

// Coverage opacity levels based on search count
const getCoverageOpacity = (searchCount) => {
  if (searchCount <= 0) return 0;
  if (searchCount === 1) return 0.15;
  if (searchCount === 2) return 0.25;
  if (searchCount === 3) return 0.35;
  if (searchCount === 4) return 0.45;
  if (searchCount === 5) return 0.55;
  return 0.65; // 6+ people = max
};

// Calculate decayed opacity (25% reduction per 12 hours, min 7.5%)
const getDecayedOpacity = (baseOpacity, hoursAgo) => {
  const periods = Math.floor(hoursAgo / 12);
  let opacity = baseOpacity;
  for (let i = 0; i < periods; i++) {
    opacity *= 0.75;
  }
  return Math.max(opacity, 0.075);
};

export default function SARMapView({
  center = [41.8781, -87.6298],
  lastSeen = null,
  sightings = [],
  pois = [], // Shelters, vets, animal control
  petSpecies = 'DOG',
  hoursElapsed = 24,
  showControls = false,
  gpsPath = [], // Current user's active GPS path
  coverageTrails = [], // Historical search trails from all team members
  activeSearchersCount = 0, // Number of team members actively searching
  showProbabilityCircles = false,
  showLegend = true,
  interactive = true
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const gpsLayersRef = useRef([]);
  const coverageLayersRef = useRef([]); // For team coverage trails
  const poiMarkersRef = useRef([]); // For shelter/vet markers
  const [userLocation, setUserLocation] = useState(null);
  const userMarkerRef = useRef(null);
  const [showPOIs, setShowPOIs] = useState(true); // Toggle POI visibility
  const [mapLayer, setMapLayer] = useState('satellite');
  const baseLayersRef = useRef({});
  const [showCoverage, setShowCoverage] = useState(true); // Toggle coverage overlay
  const heatmapLayersRef = useRef([]);

  // Calculate search radius based on time and pet type
  const getSearchRadius = () => {
    const speeds = PET_SPEEDS[petSpecies] || PET_SPEEDS.DEFAULT;
    if (hoursElapsed <= 6) {
      return { inner: 0.5, middle: 1, outer: speeds.wander * 2 };
    } else if (hoursElapsed <= 24) {
      return { inner: 1, middle: 3, outer: speeds.wander * 6 };
    } else if (hoursElapsed <= 72) {
      return { inner: 2, middle: 5, outer: speeds.wander * 12 };
    }
    return { inner: 3, middle: 8, outer: speeds.wander * 24 };
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center,
      zoom: 15,
      zoomControl: showControls,
      attributionControl: false,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive
    });

    // Create base layers
    baseLayersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    });

    baseLayersRef.current.street = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    });

    // Add default layer (satellite)
    baseLayersRef.current[mapLayer].addTo(mapInstance.current);

    // Track user location - uses browser's FREE Geolocation API (not Apple/Google)
    let watchId = null;
    if ('geolocation' in navigator) {
      console.log('[Map] Starting geolocation watch...');

      // First check permission status
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          console.log('[Map] Geolocation permission status:', result.state);
        }).catch(() => {});
      }

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          console.log('[Map] Got user location:', loc, 'accuracy:', pos.coords.accuracy);
          setUserLocation(loc);
        },
        (err) => {
          console.error('[Map] Geolocation error:', err.code, err.message);
          // Error codes: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
          if (err.code === 1) {
            console.error('[Map] Location permission denied - user needs to enable in browser settings');
          } else if (err.code === 2) {
            console.error('[Map] Position unavailable - GPS may be disabled on device');
          } else if (err.code === 3) {
            console.error('[Map] Geolocation timeout - trying again...');
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } else {
      console.warn('[Map] Geolocation not available in this browser');
    }

    // Cleanup both geolocation watcher AND map on unmount
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Note: We intentionally don't auto-pan on center changes during GPS tracking
  // This was causing constant zooming/panning. Users can manually pan the map.
  // Initial center is set during map initialization above.

  // Handle layer switching
  useEffect(() => {
    if (!mapInstance.current || !baseLayersRef.current.satellite || !baseLayersRef.current.street) return;

    // Remove current layer
    const currentLayer = mapLayer === 'satellite' ? 'street' : 'satellite';
    if (baseLayersRef.current[currentLayer]) {
      mapInstance.current.removeLayer(baseLayersRef.current[currentLayer]);
    }

    // Add new layer
    baseLayersRef.current[mapLayer].addTo(mapInstance.current);
  }, [mapLayer]);

  // Update user location marker - big and visible with pulsing effect
  useEffect(() => {
    if (!mapInstance.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLocation);
    } else {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="position: relative;">
              <div style="
                position: absolute;
                width: 40px;
                height: 40px;
                background: rgba(59, 130, 246, 0.3);
                border-radius: 50%;
                animation: userPulse 2s ease-out infinite;
                left: -6px;
                top: -6px;
              "></div>
              <div style="
                width: 28px;
                height: 28px;
                background: #3b82f6;
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
                position: relative;
                z-index: 1;
              "></div>
            </div>
            <div style="
              margin-top: 4px;
              padding: 2px 8px;
              background: rgba(59, 130, 246, 0.9);
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              color: white;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">You</div>
          </div>
          <style>
            @keyframes userPulse {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(2.5); opacity: 0; }
            }
          </style>
        `,
        iconSize: [80, 50],
        iconAnchor: [40, 14]
      });
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(mapInstance.current);
    }
  }, [userLocation]);

  // Fit bounds to show both user location and last seen
  // Only mark as done when we have BOTH locations
  const hasFitBoundsRef = useRef(false);
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!lastSeen) return;

    // If we already fit with user location, don't do it again
    if (hasFitBoundsRef.current) return;

    // Wait a moment for map to initialize
    const timer = setTimeout(() => {
      if (!mapInstance.current) return;

      const bounds = L.latLngBounds([]);

      // Add last seen to bounds
      if (lastSeen?.lat && lastSeen?.lng) {
        bounds.extend([lastSeen.lat, lastSeen.lng]);
      }

      // Add user location if available
      if (userLocation) {
        bounds.extend(userLocation);
        // Only mark as done if we have user location
        // This ensures we'll re-fit when user location becomes available
        hasFitBoundsRef.current = true;
        console.log('[Map] Fitting bounds with both locations');
      } else {
        console.log('[Map] Fitting bounds without user location (will re-fit when available)');
      }

      // If we have valid bounds, fit to them
      if (bounds.isValid()) {
        mapInstance.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [lastSeen, userLocation]);

  // Update markers and circles
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers and circles
    markersRef.current.forEach(m => m.remove());
    circlesRef.current.forEach(c => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    // Add last seen marker with label
    if (lastSeen) {
      // Determine if this is a sighting or original last seen
      const isLatestSighting = lastSeen.isLatestSighting;
      const markerColor = isLatestSighting ? '#f59e0b' : '#ef4444'; // amber for sighting, red for last seen
      const emoji = isLatestSighting ? '👁' : '📍';
      const labelText = isLatestSighting ? 'Latest Sighting' : 'Last Seen';

      const lastSeenIcon = L.divIcon({
        className: 'last-seen-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, ${markerColor}, ${markerColor}dd);
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 20px ${markerColor}80;
              font-size: 18px;
            ">${emoji}</div>
            <div style="
              margin-top: 4px;
              padding: 2px 8px;
              background: rgba(15, 23, 42, 0.9);
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              color: white;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${labelText}</div>
          </div>
        `,
        iconSize: [80, 60],
        iconAnchor: [40, 20]
      });

      const lastSeenMarker = L.marker([lastSeen.lat, lastSeen.lng], { icon: lastSeenIcon })
        .bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <strong style="color: ${markerColor};">${labelText}</strong>
            <br/>
            <span style="font-size: 12px; color: #666;">${lastSeen.address || 'Unknown address'}</span>
          </div>
        `)
        .addTo(mapInstance.current);
      markersRef.current.push(lastSeenMarker);

      // Add search probability circles (OPTIONAL - usually too confusing)
      if (showProbabilityCircles) {
        const radius = getSearchRadius();
        const milesToMeters = (miles) => miles * 1609.34;

        // Inner circle (high probability) - much less prominent
        const innerCircle = L.circle([lastSeen.lat, lastSeen.lng], {
          radius: milesToMeters(radius.inner),
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.05,
          weight: 1,
          dashArray: '5, 5'
        }).addTo(mapInstance.current);
        circlesRef.current.push(innerCircle);

        // Middle circle (medium probability)
        const middleCircle = L.circle([lastSeen.lat, lastSeen.lng], {
          radius: milesToMeters(radius.middle),
          color: '#eab308',
          fillColor: '#eab308',
          fillOpacity: 0.03,
          weight: 1,
          dashArray: '10, 5'
        }).addTo(mapInstance.current);
        circlesRef.current.push(middleCircle);

        // Outer circle (low probability)
        const outerCircle = L.circle([lastSeen.lat, lastSeen.lng], {
          radius: milesToMeters(radius.outer),
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 0.02,
          weight: 1,
          dashArray: '15, 10'
        }).addTo(mapInstance.current);
        circlesRef.current.push(outerCircle);
      }
    }

    // Add sighting markers
    sightings.forEach((sighting, index) => {
      const hoursSinceSighting = sighting.sightedAt
        ? Math.floor((Date.now() - new Date(sighting.sightedAt).getTime()) / 3600000)
        : 0;

      // Color based on recency
      let color = '#f59e0b'; // amber default
      if (hoursSinceSighting < 1) color = '#ef4444'; // red - very recent
      else if (hoursSinceSighting < 6) color = '#f97316'; // orange
      else if (hoursSinceSighting < 24) color = '#eab308'; // yellow
      else color = '#6b7280'; // gray - old

      const sightingIcon = L.divIcon({
        className: 'sighting-marker',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 10px ${color}80;
            font-size: 14px;
          ">👁</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon })
        .bindPopup(`
          <div style="min-width: 180px;">
            <strong style="color: ${color};">Sighting #${index + 1}</strong>
            <br/>
            <span style="font-size: 12px; color: #666;">
              ${sighting.description || 'No description'}
            </span>
            <br/>
            <span style="font-size: 11px; color: #999;">
              ${sighting.address || 'Unknown location'}
            </span>
            <br/>
            <span style="font-size: 10px; color: #999;">
              ${hoursSinceSighting < 1 ? 'Just now' : hoursSinceSighting < 24 ? `${hoursSinceSighting}h ago` : `${Math.floor(hoursSinceSighting / 24)}d ago`}
            </span>
          </div>
        `)
        .addTo(mapInstance.current);
      markersRef.current.push(marker);
    });

    // Add GPS paths (search areas walked)
    gpsLayersRef.current.forEach(layer => layer.remove());
    gpsLayersRef.current = [];

    if (gpsPath && gpsPath.length > 1) {
      // Convert GPS path to leaflet format
      const pathCoords = gpsPath.map(point => [point.lat, point.lng]);

      // Calculate search duration
      const startTime = gpsPath[0].timestamp;
      const endTime = gpsPath[gpsPath.length - 1].timestamp;
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      // Draw semi-transparent polygon corridor showing search area covered
      const searchCorridor = L.polyline(pathCoords, {
        color: '#a855f7', // Purple
        weight: 40, // Wide corridor to show search area
        opacity: 0.25,
        smoothFactor: 1,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(mapInstance.current);

      // Add click handler to show details
      searchCorridor.on('click', () => {
        L.popup()
          .setLatLng(pathCoords[Math.floor(pathCoords.length / 2)])
          .setContent(`
            <div style="min-width: 200px;">
              <strong style="color: #a855f7;">GPS Tracked Search Area</strong>
              <br/>
              <span style="font-size: 12px; color: #666;">
                Duration: ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}
              </span>
              <br/>
              <span style="font-size: 12px; color: #666;">
                ${gpsPath.length} GPS points recorded
              </span>
              <br/>
              <span style="font-size: 11px; color: #999;">
                ${new Date(startTime).toLocaleTimeString()} - ${new Date(endTime).toLocaleTimeString()}
              </span>
            </div>
          `)
          .openOn(mapInstance.current);
      });
      gpsLayersRef.current.push(searchCorridor);

      // Draw center line showing exact path walked
      const polyline = L.polyline(pathCoords, {
        color: '#a855f7', // Purple
        weight: 3,
        opacity: 0.9,
        smoothFactor: 1
      }).addTo(mapInstance.current);
      gpsLayersRef.current.push(polyline);

      // Add start marker (green)
      const startIcon = L.divIcon({
        className: 'gps-start-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: #22c55e;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const startMarker = L.marker(pathCoords[0], { icon: startIcon })
        .bindPopup(`
          <div style="min-width: 150px;">
            <strong style="color: #22c55e;">Search Started</strong>
            <br/>
            <span style="font-size: 11px; color: #666;">
              ${new Date(startTime).toLocaleTimeString()}
            </span>
          </div>
        `)
        .addTo(mapInstance.current);
      gpsLayersRef.current.push(startMarker);

      // Add end marker (orange)
      const endIcon = L.divIcon({
        className: 'gps-end-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: #f97316;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const endMarker = L.marker(pathCoords[pathCoords.length - 1], { icon: endIcon })
        .bindPopup(`
          <div style="min-width: 150px;">
            <strong style="color: #f97316;">Search Ended</strong>
            <br/>
            <span style="font-size: 11px; color: #666;">
              ${new Date(endTime).toLocaleTimeString()}
            </span>
            <br/>
            <span style="font-size: 11px; color: #666;">
              Duration: ${durationMinutes} min
            </span>
          </div>
        `)
        .addTo(mapInstance.current);
      gpsLayersRef.current.push(endMarker);

      // Note: We don't fitBounds here to avoid constant zooming during active tracking
      // Users can manually pan/zoom. The map stays centered on last seen location.
    }

    // Note: We removed the individual coverage circles (heatmap) as they were visually cluttered.
    // The purple corridor already shows the search coverage area effectively.
    heatmapLayersRef.current.forEach(layer => layer.remove());
    heatmapLayersRef.current = [];

  }, [lastSeen, sightings, petSpecies, hoursElapsed, gpsPath]);

  // Render team coverage trails
  useEffect(() => {
    if (!mapInstance.current || !showCoverage) return;

    // Clear existing coverage layers
    coverageLayersRef.current.forEach(layer => layer.remove());
    coverageLayersRef.current = [];

    if (!coverageTrails || coverageTrails.length === 0) return;

    // Render each team member's trail
    coverageTrails.forEach(trail => {
      if (!trail.path || trail.path.length < 2) return;

      const pathCoords = trail.path.map(p => [p.lat, p.lng]);
      const hoursAgo = trail.hoursAgo || 0;

      // Base opacity (1 person searched = 15%)
      const baseOpacity = getCoverageOpacity(1);
      // Apply time decay
      const decayedOpacity = getDecayedOpacity(baseOpacity, hoursAgo);

      // Draw purple coverage corridor (vision radius)
      const coverageCorridor = L.polyline(pathCoords, {
        color: '#a855f7', // Purple
        weight: VISION_RADIUS_METERS * 2, // Diameter in pixels (approximate)
        opacity: decayedOpacity,
        smoothFactor: 1,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(mapInstance.current);

      // Add click handler for popup
      coverageCorridor.on('click', (e) => {
        const searchDate = trail.endedAt
          ? new Date(trail.endedAt).toLocaleDateString()
          : new Date(trail.startedAt).toLocaleDateString();
        const searchTime = trail.endedAt
          ? new Date(trail.endedAt).toLocaleTimeString()
          : new Date(trail.startedAt).toLocaleTimeString();

        L.popup()
          .setLatLng(e.latlng)
          .setContent(`
            <div style="min-width: 180px;">
              <strong style="color: ${trail.color};">${trail.userName}</strong>
              <br/>
              <span style="font-size: 12px; color: #666;">
                Searched: ${searchDate}
              </span>
              <br/>
              <span style="font-size: 11px; color: #999;">
                ${searchTime}
              </span>
              ${trail.isActive ? '<br/><span style="color: #22c55e; font-weight: bold;">🔴 Active Now</span>' : ''}
            </div>
          `)
          .openOn(mapInstance.current);
      });
      coverageLayersRef.current.push(coverageCorridor);

      // Draw individual colored trail line on top
      const trailLine = L.polyline(pathCoords, {
        color: trail.color,
        weight: 3,
        opacity: trail.isActive ? 0.9 : 0.6,
        smoothFactor: 1,
        dashArray: trail.isActive ? null : '5, 5', // Dashed for historical
      }).addTo(mapInstance.current);
      coverageLayersRef.current.push(trailLine);

      // Add pulsing dot for active searchers
      if (trail.isActive && pathCoords.length > 0) {
        const lastPoint = pathCoords[pathCoords.length - 1];
        const activeIcon = L.divIcon({
          className: 'active-searcher-marker',
          html: `
            <div style="
              width: 16px;
              height: 16px;
              background: ${trail.color};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 10px ${trail.color}80;
              animation: pulse 1.5s infinite;
            "></div>
            <style>
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.7; }
              }
            </style>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const activeMarker = L.marker(lastPoint, { icon: activeIcon })
          .bindPopup(`<strong style="color: ${trail.color};">${trail.userName}</strong><br/>Searching now...`)
          .addTo(mapInstance.current);
        coverageLayersRef.current.push(activeMarker);
      }
    });

  }, [coverageTrails, showCoverage]);

  // Render POI markers (shelters, vets, animal control)
  useEffect(() => {
    if (!mapInstance.current || !showPOIs) return;

    // Clear existing POI markers
    poiMarkersRef.current.forEach(marker => marker.remove());
    poiMarkersRef.current = [];

    if (!pois || pois.length === 0) return;

    // Color mapping for POI types
    const typeColors = {
      SHELTER: '#6366f1', // Indigo
      RESCUE: '#8b5cf6', // Purple
      VET: '#10b981', // Emerald
      ANIMAL_CONTROL: '#f59e0b', // Amber
    };

    pois.forEach(poi => {
      if (!poi.latitude || !poi.longitude) return;

      const color = typeColors[poi.type?.toUpperCase()] || '#6366f1';
      const icon = poi.icon || '🏠';

      const poiIcon = L.divIcon({
        className: 'poi-marker',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
          ">${icon}</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([poi.latitude, poi.longitude], { icon: poiIcon })
        .bindPopup(`
          <div style="min-width: 200px;">
            <strong style="color: ${color};">${poi.name}</strong>
            <br/>
            <span style="font-size: 11px; color: #666; text-transform: capitalize;">
              ${poi.type?.toLowerCase() || 'Shelter'}
            </span>
            <br/>
            <span style="font-size: 12px; color: #333;">
              ${poi.address || ''}
            </span>
            ${poi.phone ? `<br/><a href="tel:${poi.phone}" style="color: #3b82f6; font-size: 12px;">${poi.phone}</a>` : ''}
            ${poi.distance ? `<br/><span style="font-size: 11px; color: #999;">${poi.distance} miles away</span>` : ''}
          </div>
        `)
        .addTo(mapInstance.current);

      poiMarkersRef.current.push(marker);
    });

  }, [pois, showPOIs]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* Layer Toggle & Location Buttons - Always show for interactive maps */}
      {interactive && (
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => setMapLayer(mapLayer === 'satellite' ? 'street' : 'satellite')}
            className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-4 py-2.5 text-white font-semibold text-sm hover:bg-slate-800 transition flex items-center gap-2 shadow-lg"
          >
            {mapLayer === 'satellite' ? (
              <>
                <span>🗺️</span>
                <span>Street View</span>
              </>
            ) : (
              <>
                <span>🛰️</span>
                <span>Satellite</span>
              </>
            )}
          </button>
          {/* Center on my location button */}
          <button
            onClick={() => {
              if (!mapInstance.current) return;
              if (userLocation) {
                mapInstance.current.setView(userLocation, 17, { animate: true });
              } else {
                // Try to get location
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const loc = [pos.coords.latitude, pos.coords.longitude];
                    setUserLocation(loc);
                    mapInstance.current.setView(loc, 17, { animate: true });
                  },
                  (err) => {
                    console.error('[Map] Failed to get location:', err);
                    alert('Could not get your location. Please check GPS permissions.');
                  },
                  { enableHighAccuracy: true }
                );
              }
            }}
            className="bg-blue-600/90 backdrop-blur border border-blue-500 rounded-xl px-4 py-2.5 text-white font-semibold text-sm hover:bg-blue-500 transition flex items-center gap-2 shadow-lg"
          >
            <span>📍</span>
            <span>My Location</span>
          </button>
          {/* Fit all locations button */}
          <button
            onClick={() => {
              if (!mapInstance.current) return;
              const bounds = L.latLngBounds([]);
              if (lastSeen?.lat && lastSeen?.lng) bounds.extend([lastSeen.lat, lastSeen.lng]);
              if (userLocation) bounds.extend(userLocation);
              if (bounds.isValid()) {
                mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              }
            }}
            className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-4 py-2.5 text-white font-semibold text-sm hover:bg-slate-800 transition flex items-center gap-2 shadow-lg"
          >
            <span>🎯</span>
            <span>Fit All</span>
          </button>
        </div>
      )}

      {/* Legend - Collapsible, positioned top-left */}
      {showLegend && (
        <MapLegend
          showSightings={sightings.length > 0}
          showSearchPath={gpsPath && gpsPath.length > 0 || coverageTrails.length > 0}
          showActiveSearches={activeSearchersCount > 0}
          showPOIs={pois.length > 0}
          activeSearchersCount={activeSearchersCount}
        />
      )}

      {/* Zoom Controls (if enabled) */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
          <button
            onClick={() => mapInstance.current?.zoomIn()}
            className="w-10 h-10 bg-slate-900/90 backdrop-blur text-white rounded-xl flex items-center justify-center hover:bg-slate-800"
          >
            +
          </button>
          <button
            onClick={() => mapInstance.current?.zoomOut()}
            className="w-10 h-10 bg-slate-900/90 backdrop-blur text-white rounded-xl flex items-center justify-center hover:bg-slate-800"
          >
            −
          </button>
          <button
            onClick={() => userLocation && mapInstance.current?.setView(userLocation, 17)}
            className="w-10 h-10 bg-slate-900/90 backdrop-blur text-white rounded-xl flex items-center justify-center hover:bg-slate-800"
            title="Center on my location"
          >
            📍
          </button>
        </div>
      )}
    </div>
  );
}
