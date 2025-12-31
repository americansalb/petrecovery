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
import { useGPS, GPS_MODE } from '@/app/lib/gpsService';
import { Map as MapIcon, Satellite, Locate, Maximize, Layers } from 'lucide-react';

// Travel speeds (miles per hour) for search radius calculation
const PET_SPEEDS = {
  DOG: { wander: 3, run: 15 },
  CAT: { wander: 1.5, run: 8 },
  DEFAULT: { wander: 2, run: 10 }
};

// Vision radius for coverage (14 meters = ~45 feet)
const VISION_RADIUS_METERS = 14;

// Max distance between consecutive points before we consider it a GPS jump (meters)
const MAX_POINT_GAP_METERS = 100; // ~330 feet - if gap is bigger, don't draw a line

// Helper to calculate distance between two points (meters)
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Smooth GPS path using weighted moving average to reduce jitter from weak signals
function smoothPath(pathCoords, windowSize = 3) {
  if (!pathCoords || pathCoords.length < windowSize) return pathCoords;

  const smoothed = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < pathCoords.length; i++) {
    // For edge points, use smaller window
    const start = Math.max(0, i - half);
    const end = Math.min(pathCoords.length - 1, i + half);
    const windowPoints = pathCoords.slice(start, end + 1);

    // Weighted average - center point has more weight
    let totalWeight = 0;
    let sumLat = 0;
    let sumLng = 0;

    windowPoints.forEach((point, idx) => {
      // Weight decreases with distance from center
      const distFromCenter = Math.abs(idx - (i - start));
      const weight = 1 / (distFromCenter + 1);
      totalWeight += weight;
      sumLat += point[0] * weight;
      sumLng += point[1] * weight;
    });

    smoothed.push([sumLat / totalWeight, sumLng / totalWeight]);
  }

  return smoothed;
}

// Split path into segments, breaking at GPS jumps
function splitPathAtJumps(pathCoords, maxGapMeters = MAX_POINT_GAP_METERS) {
  if (!pathCoords || pathCoords.length < 2) return [pathCoords];

  const segments = [];
  let currentSegment = [pathCoords[0]];

  for (let i = 1; i < pathCoords.length; i++) {
    const prev = pathCoords[i - 1];
    const curr = pathCoords[i];
    const dist = getDistanceMeters(prev[0], prev[1], curr[0], curr[1]);

    if (dist > maxGapMeters) {
      // GPS jump detected - end current segment, start new one
      if (currentSegment.length > 1) {
        // Apply smoothing before adding segment
        segments.push(smoothPath(currentSegment));
      }
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }

  // Add final segment with smoothing
  if (currentSegment.length > 1) {
    segments.push(smoothPath(currentSegment));
  }

  return segments;
}

// Coverage opacity levels based on search count - VISIBLE values
const getCoverageOpacity = (searchCount) => {
  if (searchCount <= 0) return 0;
  if (searchCount === 1) return 0.35;  // 35% - clearly visible
  if (searchCount === 2) return 0.45;
  if (searchCount === 3) return 0.55;
  if (searchCount === 4) return 0.65;
  if (searchCount === 5) return 0.75;
  return 0.85; // 6+ people = max
};

// Calculate decayed opacity (15% reduction per 24 hours, min 20%)
// Slower decay so old searches remain visible
const getDecayedOpacity = (baseOpacity, hoursAgo) => {
  const periods = Math.floor(hoursAgo / 24); // per day instead of per 12 hours
  let opacity = baseOpacity;
  for (let i = 0; i < periods; i++) {
    opacity *= 0.85; // 15% reduction instead of 25%
  }
  return Math.max(opacity, 0.20); // Minimum 20% instead of 7.5%
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
  showProbabilityZones = false, // New: Show research-based probability zones
  probabilityZones = null, // New: Data from calculateProbabilityZones()
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
  const userMarkerRef = useRef(null);
  const [showPOIs, setShowPOIs] = useState(false); // Toggle POI visibility (Off by default for cleaner map)
  const [mapLayer, setMapLayer] = useState('satellite');
  const baseLayersRef = useRef({});
  const [showCoverage, setShowCoverage] = useState(true); // Toggle coverage overlay (On by default to show search trails)
  const heatmapLayersRef = useRef([]);

  // Use centralized GPS service instead of local watchPosition
  const { location: gpsLocation, error: gpsError, startTracking, getPosition, isSupported } = useGPS();
  const userLocation = gpsLocation?.coords || null;

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

    // Start GPS tracking via centralized service (balanced mode for map viewing)
    startTracking(GPS_MODE.BALANCED);

    // Cleanup map on unmount (GPS cleanup handled by GPSProvider)
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [startTracking]);

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
      // Simpler user marker - just a blue dot with pulse, no label to avoid overlap
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 36px;
              height: 36px;
              background: rgba(59, 130, 246, 0.25);
              border-radius: 50%;
              animation: userPulse 2s ease-out infinite;
            "></div>
            <div style="
              width: 18px;
              height: 18px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
              position: relative;
              z-index: 1;
            "></div>
          </div>
          <style>
            @keyframes userPulse {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(2); opacity: 0; }
            }
          </style>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 })
        .bindPopup('<b>You</b>')
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

    // Add last seen marker - compact, no overlapping labels
    if (lastSeen) {
      // Determine if this is a sighting or original last seen
      const isLatestSighting = lastSeen.isLatestSighting;
      const markerColor = isLatestSighting ? '#f59e0b' : '#ef4444'; // amber for sighting, red for last seen
      const emoji = isLatestSighting ? '👁' : '📍';
      const labelText = isLatestSighting ? 'Latest Sighting' : 'Last Seen';

      // Compact marker without permanent label (tap to see popup)
      const lastSeenIcon = L.divIcon({
        className: 'last-seen-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px ${markerColor}80;
            font-size: 16px;
          ">${emoji}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const lastSeenMarker = L.marker([lastSeen.lat, lastSeen.lng], { icon: lastSeenIcon })
        .bindPopup(`<b style="color:${markerColor}">${labelText}</b><br><small>${lastSeen.address || ''}</small>`)
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

      // Add research-based probability zones (NEW - toggleable)
      if (showProbabilityZones && probabilityZones?.zones) {
        const milesToMeters = (miles) => miles * 1609.34;
        const zoneCenter = probabilityZones.center || [lastSeen.lat, lastSeen.lng];

        // Render zones from largest to smallest so smaller ones appear on top
        const sortedZones = [...probabilityZones.zones].sort((a, b) => b.radius - a.radius);

        sortedZones.forEach(zone => {
          const circle = L.circle(zoneCenter, {
            radius: milesToMeters(zone.radius),
            color: zone.color,
            fillColor: zone.color,
            fillOpacity: zone.fillOpacity,
            weight: 3, // Visible border
            opacity: 0.8, // Strong border visibility
            dashArray: '8, 4', // Dashed border
          });

          // Add popup with zone info
          const radiusText = zone.radius < 1
            ? `${Math.round(zone.radius * 5280)} feet`
            : `${zone.radius.toFixed(1)} miles`;

          // Use cumulative percent - "X% chance pet is within this distance"
          const displayPercent = zone.cumulativePercent || zone.probabilityPercent;

          circle.bindPopup(`
            <div style="text-align:center;padding:4px;">
              <b style="color:${zone.color}">${zone.name}</b><br>
              <span style="font-size:16px;font-weight:bold">${displayPercent}%</span><br>
              <small style="color:#666">within ${radiusText}</small>
            </div>
          `);

          circle.addTo(mapInstance.current);
          circlesRef.current.push(circle);
        });
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
          <div style="max-width:200px">
            <b style="color:${color}">Sighting #${index + 1}</b>
            <small style="color:#666;display:block">${hoursSinceSighting < 1 ? 'Just now' : hoursSinceSighting < 24 ? `${hoursSinceSighting}h ago` : `${Math.floor(hoursSinceSighting / 24)}d ago`}</small>
            ${sighting.description ? `<p style="margin:4px 0 0;font-size:12px">${sighting.description.slice(0, 80)}${sighting.description.length > 80 ? '...' : ''}</p>` : ''}
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

      // Split path into segments at GPS jumps to avoid drawing lines across the map
      const segments = splitPathAtJumps(pathCoords);

      // Calculate search duration
      const startTime = gpsPath[0].timestamp;
      const endTime = gpsPath[gpsPath.length - 1].timestamp;
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      // Draw each segment separately
      segments.forEach((segmentCoords, idx) => {
        if (segmentCoords.length < 2) return;

        // Draw visible corridor showing search area covered (vision radius ~14m = ~45ft)
        const searchCorridor = L.polyline(segmentCoords, {
          color: '#a855f7', // Purple
          weight: 50, // Wide corridor to show search area
          opacity: 0.45, // 45% - clearly visible but not overwhelming
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapInstance.current);
        searchCorridor.bringToFront();

        // Add click handler to show details (only on first segment)
        if (idx === 0) {
          searchCorridor.on('click', () => {
            L.popup()
              .setLatLng(segmentCoords[Math.floor(segmentCoords.length / 2)])
              .setContent(`
                <div style="min-width: 200px;">
                  <b style="color:#a855f7">Your Search</b><br>
                  <span style="font-size:13px">${durationMinutes} min</span>
                </div>
              `)
              .openOn(mapInstance.current);
          });
        }
        gpsLayersRef.current.push(searchCorridor);

        // Draw center line showing exact path walked
        const polyline = L.polyline(segmentCoords, {
          color: '#a855f7', // Purple
          weight: 3,
          opacity: 0.9,
          smoothFactor: 1
        }).addTo(mapInstance.current);
        polyline.bringToFront();
        gpsLayersRef.current.push(polyline);
      });

      // Note: Removed start marker as requested - the path itself shows where search started

      // Note: We don't fitBounds here to avoid constant zooming during active tracking
    }

    // Note: We removed the individual coverage circles (heatmap) as they were visually cluttered.
    // The purple corridor already shows the search coverage area effectively.
    heatmapLayersRef.current.forEach(layer => layer.remove());
    heatmapLayersRef.current = [];

  }, [lastSeen, sightings, petSpecies, hoursElapsed, gpsPath, showProbabilityZones, probabilityZones]);

  // Render team coverage trails
  useEffect(() => {
    if (!mapInstance.current || !showCoverage) return;

    // Clear existing coverage layers
    coverageLayersRef.current.forEach(layer => layer.remove());
    coverageLayersRef.current = [];

    if (!coverageTrails || coverageTrails.length === 0) {
      console.log('[Map] No coverage trails to render');
      return;
    }

    // Filter out current user's ACTIVE session - it's already rendered via gpsPath prop
    // This prevents duplicate rendering (purple gpsPath + blue coverage trail)
    const trailsToRender = coverageTrails.filter(trail => {
      // Skip current user's active session - already shown via gpsPath
      if (trail.isCurrentUser && trail.isActive) {
        console.log('[Map] Skipping current user active trail (already rendered via gpsPath)');
        return false;
      }
      return true;
    });

    if (trailsToRender.length === 0) {
      console.log('[Map] No coverage trails to render after filtering');
      return;
    }

    console.log('[Map] Rendering', trailsToRender.length, 'coverage trails');

    // Render each team member's trail
    trailsToRender.forEach(trail => {
      if (!trail.path || trail.path.length < 2) {
        console.log('[Map] Skipping trail with insufficient points:', trail.path?.length || 0);
        return;
      }

      const pathCoords = trail.path.map(p => [p.lat, p.lng]);
      const hoursAgo = trail.hoursAgo || 0;
      const isCurrentUser = trail.isCurrentUser || false;

      console.log('[Map] Drawing trail:', trail.userName, 'points:', pathCoords.length, 'hoursAgo:', hoursAgo.toFixed(1), 'isActive:', trail.isActive);

      // Split path into segments at GPS jumps
      const segments = splitPathAtJumps(pathCoords);

      // SAME decay for everyone - the point is to show areas need searching again
      const baseOpacity = getCoverageOpacity(1);
      const decayedOpacity = getDecayedOpacity(baseOpacity, hoursAgo);

      // Current user's paths are BLUE, others keep their team color
      const corridorColor = isCurrentUser ? '#3b82f6' : '#a855f7';
      const lineColor = isCurrentUser ? '#3b82f6' : trail.color;
      const lineOpacity = trail.isActive ? 0.9 : Math.max(decayedOpacity * 4, 0.3);

      // Draw each segment separately
      segments.forEach(segmentCoords => {
        if (segmentCoords.length < 2) return;

        // Calculate corridor opacity - more visible than before
        const corridorOpacity = trail.isActive ? 0.45 : Math.max(decayedOpacity, 0.25);

        const coverageCorridor = L.polyline(segmentCoords, {
          color: corridorColor,
          weight: 50, // Wide corridor matching active search
          opacity: corridorOpacity,
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(mapInstance.current);
        coverageCorridor.bringToFront();

        // Add click handler for popup
        coverageCorridor.on('click', (e) => {
          const searchDate = trail.endedAt
            ? new Date(trail.endedAt).toLocaleDateString()
            : new Date(trail.startedAt).toLocaleDateString();
          const displayName = isCurrentUser ? 'Your Search' : trail.userName;
          const displayColor = isCurrentUser ? '#3b82f6' : trail.color;

          L.popup()
            .setLatLng(e.latlng)
            .setContent(`
              <div>
                <b style="color:${displayColor}">${displayName}</b>
                ${trail.isActive ? '<span style="color:#22c55e;margin-left:6px">● Live</span>' : `<br><small style="color:#666">${searchDate}</small>`}
              </div>
            `)
            .openOn(mapInstance.current);
        });
        coverageLayersRef.current.push(coverageCorridor);

        // Draw trail line on top - all solid lines for consistency
        const trailLine = L.polyline(segmentCoords, {
          color: lineColor,
          weight: 3,
          opacity: lineOpacity,
          smoothFactor: 1,
        }).addTo(mapInstance.current);
        trailLine.bringToFront();
        coverageLayersRef.current.push(trailLine);
      });

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
          {/* Layer Toggle */}
          <button
            onClick={() => setMapLayer(mapLayer === 'satellite' ? 'street' : 'satellite')}
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-slate-900/90 active:scale-95 transition-all"
            title="Switch Map View"
          >
            {mapLayer === 'satellite' ? (
              <MapIcon size={20} className="text-slate-200 group-hover:text-white" />
            ) : (
              <Satellite size={20} className="text-slate-200 group-hover:text-white" />
            )}
          </button>

          {/* Center on my location button */}
          <button
            onClick={async () => {
              // Pulse animation
              const btn = document.getElementById('my-loc-btn');
              if (btn) btn.classList.add('animate-pulse');

              const pos = await getPosition();
              if (pos && mapInstance.current) {
                mapInstance.current.flyTo([pos.latitude, pos.longitude], 17, {
                  animate: true,
                  duration: 1
                });
              } else {
                startTracking(GPS_MODE.HIGH_ACCURACY);
              }

              setTimeout(() => {
                if (btn) btn.classList.remove('animate-pulse');
              }, 1000);
            }}
            id="my-loc-btn"
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-blue-600/80 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-blue-500/90 active:scale-95 transition-all"
            title="My Location"
          >
            <Locate size={20} className="text-white" />
          </button>

          {/* Fit Bounds */}
          <button
            onClick={() => {
              if (mapInstance.current && lastSeen) {
                const bounds = L.latLngBounds([lastSeen.lat, lastSeen.lng]);
                if (userLocation) bounds.extend(userLocation);
                mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
              }
            }}
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-slate-900/90 active:scale-95 transition-all"
            title="Fit All"
          >
            <Maximize size={20} className="text-slate-200 group-hover:text-white" />
          </button>
        </div>
      )
      }

      {/* Legend - Collapsible, positioned top-left */}
      {
        showLegend && (
          <MapLegend
            showSightings={sightings.length > 0}
            showSearchPath={gpsPath && gpsPath.length > 0 || coverageTrails.length > 0}
            showActiveSearches={activeSearchersCount > 0}
            showPOIs={pois.length > 0}
            activeSearchersCount={activeSearchersCount}
          />
        )
      }

      {/* Zoom Controls (if enabled) */}
      {
        showControls && (
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
        )
      }
    </div >
  );
}
