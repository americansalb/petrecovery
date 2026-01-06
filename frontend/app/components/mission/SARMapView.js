'use client';

/**
 * SAR Map View - Simplified map for Search and Rescue operations
 *
 * NOTE: Continuous GPS tracking has been removed as it doesn't work reliably
 * in web browsers. For real-time GPS tracking, users should use the mobile app.
 *
 * Features:
 * - Last seen location marker
 * - Sighting markers with time decay coloring
 * - Probability circles (search radius based on time elapsed)
 * - User location (one-time capture via button)
 * - Marked search locations (instead of continuous GPS path)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';
import { useGPS } from '@/app/lib/gpsService';
import { Map as MapIcon, Satellite, Locate, Maximize } from 'lucide-react';

// Travel speeds (miles per hour) for search radius calculation
const PET_SPEEDS = {
  DOG: { wander: 3, run: 15 },
  CAT: { wander: 1.5, run: 8 },
  DEFAULT: { wander: 2, run: 10 }
};

export default function SARMapView({
  center = [41.8781, -87.6298],
  lastSeen = null,
  sightings = [],
  pois = [], // Shelters, vets, animal control
  petSpecies = 'DOG',
  hoursElapsed = 24,
  showControls = false,
  markedLocations = [], // Marked search locations (replaces gpsPath)
  coverageTrails = [], // Historical search trails from all team members
  activeSearchersCount = 0, // Number of team members actively searching
  showProbabilityCircles = false,
  showProbabilityZones = false, // Show research-based probability zones
  probabilityZones = null, // Data from calculateProbabilityZones()
  showLegend = true,
  interactive = true
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const markedLocationsLayersRef = useRef([]); // For marked location markers
  const coverageLayersRef = useRef([]); // For team coverage trails
  const poiMarkersRef = useRef([]); // For shelter/vet markers
  const userMarkerRef = useRef(null);
  const [showPOIs, setShowPOIs] = useState(false); // Toggle POI visibility (Off by default for cleaner map)
  const [mapLayer, setMapLayer] = useState('satellite');
  const baseLayersRef = useRef({});
  const [showCoverage, setShowCoverage] = useState(true); // Toggle coverage overlay (On by default to show search trails)
  const renderGenRef = useRef(0); // Track render generation for cleanup race conditions

  // Use GPS service for one-time location capture
  const { location: gpsLocation, getPosition, isSupported, isLoading: gpsLoading } = useGPS();
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

  // Center on user location
  const centerOnUser = useCallback(async () => {
    try {
      const pos = await getPosition();
      if (pos && mapInstance.current) {
        mapInstance.current.flyTo([pos.lat, pos.lng], 17, {
          animate: true,
          duration: 1
        });
      }
    } catch (err) {
      console.error('Failed to get location:', err);
    }
  }, [getPosition]);

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

    // Cleanup map on unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Center map on lastSeen when it becomes available (only once per mission)
  const hasInitialCenterRef = useRef(false);
  const lastSeenCenterKeyRef = useRef(null);
  useEffect(() => {
    if (!mapInstance.current || !lastSeen) return;

    // Check if lastSeen has valid coordinates
    if (!lastSeen.lat || !lastSeen.lng) return;

    // Track by key so we re-center when mission changes
    const key = `${lastSeen.lat.toFixed(4)},${lastSeen.lng.toFixed(4)}`;
    if (lastSeenCenterKeyRef.current !== key) {
      // Mission changed - reset and center
      hasInitialCenterRef.current = false;
      lastSeenCenterKeyRef.current = key;
    }

    if (!hasInitialCenterRef.current) {
      mapInstance.current.setView([lastSeen.lat, lastSeen.lng], 15);
      hasInitialCenterRef.current = true;
    }
  }, [lastSeen]);

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

  // Update user location marker
  useEffect(() => {
    if (!mapInstance.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLocation);
    } else {
      // User marker - blue dot with pulse
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
  const hasFitBoundsRef = useRef(false);
  const lastSeenKeyRef = useRef(null);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (!lastSeen) return;

    // Track lastSeen by key to reset bounds when mission changes
    const lastSeenKey = `${lastSeen.lat?.toFixed(5)},${lastSeen.lng?.toFixed(5)}`;
    if (lastSeenKeyRef.current !== lastSeenKey) {
      // Mission changed - reset fit bounds flag
      hasFitBoundsRef.current = false;
      lastSeenKeyRef.current = lastSeenKey;
    }

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
        hasFitBoundsRef.current = true;
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

    // Increment generation to invalidate any in-progress async operations
    const currentGen = ++renderGenRef.current;

    // Robust cleanup - remove all layers synchronously before adding new ones
    const cleanupLayers = () => {
      markersRef.current.forEach(m => {
        try { m.remove(); } catch (e) { /* already removed */ }
      });
      circlesRef.current.forEach(c => {
        try { c.remove(); } catch (e) { /* already removed */ }
      });
      markersRef.current = [];
      circlesRef.current = [];
    };

    cleanupLayers();

    // Add last seen marker
    if (lastSeen) {
      const isLatestSighting = lastSeen.isLatestSighting;
      const markerColor = isLatestSighting ? '#f59e0b' : '#ef4444';
      const emoji = isLatestSighting ? '👁' : '📍';
      const labelText = isLatestSighting ? 'Latest Sighting' : 'Last Seen';

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

      // Add search probability circles (OPTIONAL)
      if (showProbabilityCircles) {
        const radius = getSearchRadius();
        const milesToMeters = (miles) => miles * 1609.34;

        // Inner circle (high probability)
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

      // Add research-based probability zones
      if (showProbabilityZones && probabilityZones?.zones) {
        const milesToMeters = (miles) => miles * 1609.34;
        const zoneCenter = probabilityZones.center || [lastSeen.lat, lastSeen.lng];

        // Helper to generate arc coordinates for a pie slice
        const generateArcCoords = (centerCoords, innerRadius, outerRadius, startAngle, endAngle, numPoints = 16) => {
          const coords = [];
          const [lat, lng] = centerCoords;

          // Outer arc (from startAngle to endAngle)
          for (let i = 0; i <= numPoints; i++) {
            const angle = startAngle + (i / numPoints) * (endAngle - startAngle);
            const radians = ((90 - angle) * Math.PI) / 180;
            const latOffset = (outerRadius / 111320) * Math.sin(radians);
            const lngOffset = (outerRadius / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(radians);
            coords.push([lat + latOffset, lng + lngOffset]);
          }

          // Inner arc (from endAngle back to startAngle)
          if (innerRadius > 0) {
            for (let i = numPoints; i >= 0; i--) {
              const angle = startAngle + (i / numPoints) * (endAngle - startAngle);
              const radians = ((90 - angle) * Math.PI) / 180;
              const latOffset = (innerRadius / 111320) * Math.sin(radians);
              const lngOffset = (innerRadius / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(radians);
              coords.push([lat + latOffset, lng + lngOffset]);
            }
          } else {
            coords.push(centerCoords);
          }

          return coords;
        };

        // Sort zones from smallest to largest
        const sortedZones = [...probabilityZones.zones].sort((a, b) => a.radius - b.radius);
        const ZONE_OPACITY = 0.35;

        // Octant definitions
        const octants = [
          { name: 'N', fullName: 'North', startAngle: -22.5, endAngle: 22.5 },
          { name: 'NE', fullName: 'Northeast', startAngle: 22.5, endAngle: 67.5 },
          { name: 'E', fullName: 'East', startAngle: 67.5, endAngle: 112.5 },
          { name: 'SE', fullName: 'Southeast', startAngle: 112.5, endAngle: 157.5 },
          { name: 'S', fullName: 'South', startAngle: 157.5, endAngle: 202.5 },
          { name: 'SW', fullName: 'Southwest', startAngle: 202.5, endAngle: 247.5 },
          { name: 'W', fullName: 'West', startAngle: 247.5, endAngle: 292.5 },
          { name: 'NW', fullName: 'Northwest', startAngle: 292.5, endAngle: 337.5 },
        ];

        sortedZones.forEach((zone, zoneIndex) => {
          const outerRadius = milesToMeters(zone.radius);
          const innerRadius = zoneIndex === 0 ? 0 : milesToMeters(sortedZones[zoneIndex - 1].radius);

          octants.forEach((octant) => {
            const sliceCoords = generateArcCoords(
              zoneCenter,
              innerRadius,
              outerRadius,
              octant.startAngle,
              octant.endAngle
            );

            const polygon = L.polygon(sliceCoords, {
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: ZONE_OPACITY,
              weight: 0,
              opacity: 0,
            });

            const zoneProbability = zone.probabilityPercent || zone.cumulativePercent;
            const octantProbability = (zoneProbability / 8).toFixed(1);
            const radiusMiles = zone.radius;
            const radiusText = radiusMiles < 0.1
              ? `${(radiusMiles * 5280).toFixed(0)} ft`
              : `${radiusMiles.toFixed(2)} mi`;

            const zoneDescriptions = {
              HIGH: { label: 'HIGH PROBABILITY', tip: 'Best place to search first!' },
              MEDIUM: { label: 'MEDIUM PROBABILITY', tip: 'Good area to search' },
              LOW: { label: 'LOW PROBABILITY', tip: 'Less likely, but worth checking' },
              EXTENDED: { label: 'EXTENDED SEARCH', tip: 'Outer edge of search area' },
            };
            const zoneInfo = zoneDescriptions[zone.name] || { label: zone.name, tip: '' };

            polygon.bindPopup(`
              <div style="text-align:center;padding:8px;min-width:200px;">
                <div style="font-weight:700;color:${zone.color};font-size:13px;margin-bottom:2px;">
                  ${zoneInfo.label}
                </div>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                  ${octant.fullName} Section
                </div>
                <div style="background:#f8f9fa;border-radius:8px;padding:10px;margin-bottom:8px;">
                  <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Full Zone</div>
                  <div style="font-size:24px;font-weight:700;color:${zone.color};">${zoneProbability}%</div>
                  <div style="font-size:10px;color:#888;margin-bottom:8px;">within ${radiusText}</div>
                  <div style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:4px;">
                    <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">This Sector (${octant.name})</div>
                    <div style="font-size:18px;font-weight:600;color:${zone.color};">${octantProbability}%</div>
                  </div>
                </div>
                <div style="font-size:11px;color:#22c55e;font-weight:500;">
                  ${zoneInfo.tip}
                </div>
              </div>
            `);

            polygon.addTo(mapInstance.current);
            polygon.bringToBack();
            circlesRef.current.push(polygon);
          });
        });

        // Draw octant divider lines
        const outermostRadius = milesToMeters(sortedZones[sortedZones.length - 1].radius);
        const [centerLat, centerLng] = zoneCenter;
        const boundaryAngles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

        boundaryAngles.forEach((angle) => {
          const radians = ((90 - angle) * Math.PI) / 180;
          const endLatOffset = (outermostRadius / 111320) * Math.sin(radians);
          const endLngOffset = (outermostRadius / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(radians);
          const endPoint = [centerLat + endLatOffset, centerLng + endLngOffset];

          const line = L.polyline([zoneCenter, endPoint], {
            color: '#ffffff',
            weight: 2,
            opacity: 0.7,
            dashArray: '8, 6',
          });
          line.addTo(mapInstance.current);
          circlesRef.current.push(line);
        });

        // Direction labels
        const octantLabels = [
          { angle: 0, label: 'N' },
          { angle: 45, label: 'NE' },
          { angle: 90, label: 'E' },
          { angle: 135, label: 'SE' },
          { angle: 180, label: 'S' },
          { angle: 225, label: 'SW' },
          { angle: 270, label: 'W' },
          { angle: 315, label: 'NW' },
        ];

        octantLabels.forEach(({ angle, label }) => {
          const radians = ((90 - angle) * Math.PI) / 180;
          const labelLatOffset = (outermostRadius / 111320) * Math.sin(radians) * 0.90;
          const labelLngOffset = (outermostRadius / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(radians) * 0.90;
          const labelPoint = [centerLat + labelLatOffset, centerLng + labelLngOffset];

          const labelIcon = L.divIcon({
            className: 'octant-label',
            html: `<div style="
              background: rgba(15, 23, 42, 0.85);
              color: white;
              font-size: 12px;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 6px;
              border: 1px solid rgba(255,255,255,0.3);
              white-space: nowrap;
            ">${label}</div>`,
            iconSize: [28, 20],
            iconAnchor: [14, 10],
          });

          const labelMarker = L.marker(labelPoint, {
            icon: labelIcon,
            interactive: false,
          });
          labelMarker.addTo(mapInstance.current);
          circlesRef.current.push(labelMarker);
        });
      }
    }

    // Add sighting markers with expanding zones
    sightings.forEach((sighting) => {
      if (!sighting.latitude || !sighting.longitude) return;

      const sightingTime = sighting.sightedAt || sighting.createdAt || new Date().toISOString();
      const hoursSinceSighting = (Date.now() - new Date(sightingTime).getTime()) / 3600000;
      const isConfirmed = sighting.verified === true || sighting.isConfirmed === true;
      const zoneColor = isConfirmed ? '#22c55e' : '#3b82f6';

      // Calculate expanding radius
      const baseRadiusMiles = 0.1;
      const growthRatePerHour = 0.25;
      const maxRadiusMiles = 3;
      const radiusMiles = Math.min(baseRadiusMiles + (Math.max(0, hoursSinceSighting) * growthRatePerHour), maxRadiusMiles);
      const radiusMeters = radiusMiles * 1609.34;

      // Draw the expanding sighting zone
      const sightingZone = L.circle([sighting.latitude, sighting.longitude], {
        radius: radiusMeters,
        color: zoneColor,
        fillColor: zoneColor,
        fillOpacity: 0.12,
        weight: 2,
        opacity: 0.7,
        dashArray: isConfirmed ? '' : '6, 4',
      });

      const timeAgoText = hoursSinceSighting < 1
        ? 'Just now'
        : hoursSinceSighting < 24
          ? `${Math.floor(hoursSinceSighting)}h ago`
          : `${Math.floor(hoursSinceSighting / 24)}d ago`;

      const radiusText = radiusMiles < 0.5
        ? `${Math.round(radiusMiles * 5280)} ft radius`
        : `${radiusMiles.toFixed(1)} mi radius`;

      const statusLabel = isConfirmed ? '✓ CONFIRMED' : 'UNCONFIRMED';
      const statusColor = isConfirmed ? '#22c55e' : '#3b82f6';

      const buildPopupContent = () => `
        <div style="text-align:center;padding:6px;min-width:160px;">
          <div style="font-weight:700;color:${statusColor};font-size:12px;margin-bottom:4px;">
            👁 ${statusLabel}
          </div>
          <div style="font-size:14px;font-weight:600;color:#333;">
            ${timeAgoText} • ${radiusText}
          </div>
          ${sighting.description ? `
            <div style="font-size:11px;color:#666;margin-top:6px;padding-top:6px;border-top:1px solid #eee;">
              "${sighting.description.slice(0, 60)}${sighting.description.length > 60 ? '...' : ''}"
            </div>
          ` : ''}
        </div>
      `;

      sightingZone.bindPopup(buildPopupContent());
      sightingZone.addTo(mapInstance.current);
      sightingZone.bringToBack();
      circlesRef.current.push(sightingZone);

      // Add eye marker at center of sighting
      const sightingIcon = L.divIcon({
        className: 'sighting-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${zoneColor};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px ${zoneColor}80;
            font-size: 16px;
          ">👁</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon, zIndexOffset: 500 })
        .bindPopup(buildPopupContent())
        .addTo(mapInstance.current);
      markersRef.current.push(marker);
    });

    // Return cleanup function
    return () => {
      if (currentGen === renderGenRef.current) {
        cleanupLayers();
      }
    };
  }, [lastSeen, sightings, petSpecies, hoursElapsed, showProbabilityZones, probabilityZones]);

  // Render marked search locations (replaces GPS path)
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing marked location layers
    markedLocationsLayersRef.current.forEach(layer => {
      try { layer.remove(); } catch (e) { /* already removed */ }
    });
    markedLocationsLayersRef.current = [];

    if (!markedLocations || markedLocations.length === 0) return;

    // Add markers for each marked location
    markedLocations.forEach((mark, index) => {
      if (!mark.lat || !mark.lng) return;

      // Determine marker color based on whether it's in the search zone
      const markerColor = mark.inZone !== false ? '#a855f7' : '#6b7280'; // Purple if in zone, gray if out

      const markIcon = L.divIcon({
        className: 'marked-location',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px ${markerColor}80;
            font-size: 11px;
            font-weight: 700;
            color: white;
          ">${index + 1}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const timeAgo = mark.timestamp
        ? new Date(mark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      const marker = L.marker([mark.lat, mark.lng], { icon: markIcon })
        .bindPopup(`
          <div style="text-align:center;padding:4px;">
            <div style="font-weight:600;color:${markerColor};">Location #${index + 1}</div>
            ${timeAgo ? `<div style="font-size:11px;color:#666;">${timeAgo}</div>` : ''}
            ${mark.notes ? `<div style="font-size:11px;color:#333;margin-top:4px;">${mark.notes}</div>` : ''}
            ${mark.inZone === false ? `<div style="font-size:10px;color:#f59e0b;margin-top:4px;">Outside search zone</div>` : ''}
          </div>
        `)
        .addTo(mapInstance.current);

      markedLocationsLayersRef.current.push(marker);

      // Add a small circle around each marked location to show approximate search coverage
      const coverageCircle = L.circle([mark.lat, mark.lng], {
        radius: 50, // 50 meters radius for visual coverage
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.15,
        weight: 1,
        opacity: 0.5,
      }).addTo(mapInstance.current);
      coverageCircle.bringToBack();
      markedLocationsLayersRef.current.push(coverageCircle);
    });

  }, [markedLocations]);

  // Render team coverage trails (historical data from other team members)
  useEffect(() => {
    if (!mapInstance.current || !showCoverage) return;

    // Clear existing coverage layers
    coverageLayersRef.current.forEach(layer => {
      try { layer.remove(); } catch (e) { /* already removed */ }
    });
    coverageLayersRef.current = [];

    if (!coverageTrails || coverageTrails.length === 0) return;

    // Render each team member's trail
    coverageTrails.forEach(trail => {
      if (!trail.path || trail.path.length < 2) return;

      const pathCoords = trail.path.map(p => [p.lat, p.lng]);
      const lineColor = trail.color || '#6366f1';

      // Draw trail line
      const trailLine = L.polyline(pathCoords, {
        color: lineColor,
        weight: 3,
        opacity: 0.6,
        smoothFactor: 1,
      }).addTo(mapInstance.current);

      trailLine.on('click', (e) => {
        const searchDate = trail.endedAt
          ? new Date(trail.endedAt).toLocaleDateString()
          : new Date(trail.startedAt).toLocaleDateString();

        L.popup()
          .setLatLng(e.latlng)
          .setContent(`
            <div>
              <b style="color:${lineColor}">${trail.userName || 'Team Member'}</b>
              <br><small style="color:#666">${searchDate}</small>
            </div>
          `)
          .openOn(mapInstance.current);
      });
      coverageLayersRef.current.push(trailLine);
    });

  }, [coverageTrails, showCoverage]);

  // Render POI markers (shelters, vets, animal control)
  useEffect(() => {
    if (!mapInstance.current || !showPOIs) return;

    // Clear existing POI markers
    poiMarkersRef.current.forEach(marker => {
      try { marker.remove(); } catch (e) { /* already removed */ }
    });
    poiMarkersRef.current = [];

    if (!pois || pois.length === 0) return;

    const typeColors = {
      SHELTER: '#6366f1',
      RESCUE: '#8b5cf6',
      VET: '#10b981',
      ANIMAL_CONTROL: '#f59e0b',
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

      {/* Layer Toggle & Location Buttons */}
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
            onClick={centerOnUser}
            disabled={gpsLoading}
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-blue-600/80 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-blue-500/90 active:scale-95 transition-all disabled:opacity-50"
            title="My Location"
          >
            <Locate size={20} className={`text-white ${gpsLoading ? 'animate-pulse' : ''}`} />
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
      )}

      {/* Legend */}
      {showLegend && (
        <MapLegend
          showSightings={sightings.length > 0}
          showSearchPath={markedLocations && markedLocations.length > 0 || coverageTrails.length > 0}
          showActiveSearches={activeSearchersCount > 0}
          showPOIs={pois.length > 0}
          showProbabilityZones={showProbabilityZones}
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
