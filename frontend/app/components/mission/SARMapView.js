'use client';

/**
 * SAR Map View - Search and Rescue Map with Connected Path Drawing
 *
 * Features:
 * - Last seen location marker
 * - Sighting markers with expanding zones
 * - Probability zones (research-based octants)
 * - User location (one-time capture)
 * - Search path as connected points with coverage corridor
 * - Desktop mode: Click map to add points
 * - Mobile mode: Mark current GPS location
 * - Historical coverage trails from team members
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';
import { useGPS } from '@/app/lib/gpsService';
import { Map as MapIcon, Satellite, Locate, Maximize, MousePointer } from 'lucide-react';

// Travel speeds for search radius calculation
const PET_SPEEDS = {
  DOG: { wander: 3, run: 15 },
  CAT: { wander: 1.5, run: 8 },
  DEFAULT: { wander: 2, run: 10 }
};

// Coverage corridor width in meters (50m total = 25m each side)
const CORRIDOR_WIDTH_METERS = 50;

export default function SARMapView({
  center = [41.8781, -87.6298],
  lastSeen = null,
  sightings = [],
  pois = [],
  petSpecies = 'DOG',
  hoursElapsed = 24,
  showControls = false,
  // Search path - connected points
  searchPath = [],
  onMapClick = null, // Callback for desktop click-to-add: (lat, lng) => void
  isEditMode = false, // When true, map clicks add points
  // Historical coverage
  coverageTrails = [],
  activeSearchersCount = 0,
  // Display options
  showProbabilityCircles = false,
  showProbabilityZones = false,
  probabilityZones = null,
  showLegend = true,
  interactive = true,
  // Controlled POI visibility (undefined keeps the internal toggle)
  showPOIs: showPOIsProp = undefined,
  // Base layer on mount: 'satellite' | 'street' (street = dark cartography)
  defaultLayer = 'satellite',
  // Optional per-zone color override, e.g. { HIGH: '#facc15', ... }
  zoneColors = null,
  // Optional per-zone fill-opacity override, e.g. { HIGH: 0.16, EXTENDED: 0 }.
  // A 0 skips the fill polygons entirely (the dashed beam edge still marks
  // the boundary) so outer rings never tint the whole viewport.
  zoneFills = null,
  // Fly the camera somewhere on demand: { lat, lng, zoom?, key }
  // (key changes are what trigger the flight, so the same spot can refocus)
  focusPoint = null,
  // Pixel offsets so floating panels never cover the controls/legend
  controlsOffset = null,
  legendOffset = null
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const searchPathLayersRef = useRef([]);
  const coverageLayersRef = useRef([]);
  const poiMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [showPOIsState, setShowPOIs] = useState(false);
  const showPOIs = showPOIsProp ?? showPOIsState;
  const [mapLayer, setMapLayer] = useState(defaultLayer === 'street' ? 'street' : 'satellite');
  const baseLayersRef = useRef({});
  const [showCoverage, setShowCoverage] = useState(true);
  const renderGenRef = useRef(0);

  // GPS for user location
  const { location: gpsLocation, getPosition, isSupported, isLoading: gpsLoading } = useGPS();
  const userLocation = gpsLocation?.coords || null;

  // Calculate search radius based on time and pet type
  const getSearchRadius = () => {
    const speeds = PET_SPEEDS[petSpecies] || PET_SPEEDS.DEFAULT;
    if (hoursElapsed <= 6) return { inner: 0.5, middle: 1, outer: speeds.wander * 2 };
    if (hoursElapsed <= 24) return { inner: 1, middle: 3, outer: speeds.wander * 6 };
    if (hoursElapsed <= 72) return { inner: 2, middle: 5, outer: speeds.wander * 12 };
    return { inner: 3, middle: 8, outer: speeds.wander * 24 };
  };

  // Generate corridor polygon around a path
  const generateCorridorPolygon = useCallback((pathPoints, widthMeters) => {
    if (pathPoints.length < 2) return null;

    const halfWidth = widthMeters / 2;
    const leftSide = [];
    const rightSide = [];

    for (let i = 0; i < pathPoints.length; i++) {
      const current = pathPoints[i];
      let bearing;

      if (i === 0) {
        bearing = calculateBearing(current, pathPoints[i + 1]);
      } else if (i === pathPoints.length - 1) {
        bearing = calculateBearing(pathPoints[i - 1], current);
      } else {
        const bearingIn = calculateBearing(pathPoints[i - 1], current);
        const bearingOut = calculateBearing(current, pathPoints[i + 1]);
        bearing = averageBearing(bearingIn, bearingOut);
      }

      const leftBearing = (bearing - 90 + 360) % 360;
      const rightBearing = (bearing + 90) % 360;

      leftSide.push(offsetPoint(current.lat, current.lng, halfWidth, leftBearing));
      rightSide.push(offsetPoint(current.lat, current.lng, halfWidth, rightBearing));
    }

    return [...leftSide, ...rightSide.reverse()];
  }, []);

  // Calculate bearing between two points (degrees)
  const calculateBearing = (from, to) => {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Average two bearings
  const averageBearing = (b1, b2) => {
    const x = Math.cos(b1 * Math.PI / 180) + Math.cos(b2 * Math.PI / 180);
    const y = Math.sin(b1 * Math.PI / 180) + Math.sin(b2 * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Offset a point by distance and bearing
  const offsetPoint = (lat, lng, distanceMeters, bearing) => {
    const R = 6371000;
    const d = distanceMeters / R;
    const brng = bearing * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
  };

  // Center on user location
  const centerOnUser = useCallback(async () => {
    try {
      const pos = await getPosition();
      if (pos && mapInstance.current) {
        mapInstance.current.flyTo([pos.lat, pos.lng], 17, { animate: true, duration: 1 });
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
      doubleClickZoom: interactive && !isEditMode,
      boxZoom: interactive,
      keyboard: interactive
    });

    baseLayersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    });
    baseLayersRef.current.street = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    });

    baseLayersRef.current[mapLayer].addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Handle map clicks for desktop edit mode
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = (e) => {
      if (isEditMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    if (isEditMode) {
      mapInstance.current.on('click', handleClick);
    } else {
      mapInstance.current.off('click', handleClick);
    }

    return () => {
      mapInstance.current?.off('click', handleClick);
    };
  }, [isEditMode, onMapClick]);

  // Center on lastSeen
  const hasInitialCenterRef = useRef(false);
  const lastSeenCenterKeyRef = useRef(null);
  useEffect(() => {
    if (!mapInstance.current || !lastSeen?.lat || !lastSeen?.lng) return;

    const key = `${lastSeen.lat.toFixed(4)},${lastSeen.lng.toFixed(4)}`;
    if (lastSeenCenterKeyRef.current !== key) {
      hasInitialCenterRef.current = false;
      lastSeenCenterKeyRef.current = key;
    }

    if (!hasInitialCenterRef.current) {
      mapInstance.current.setView([lastSeen.lat, lastSeen.lng], 15);
      hasInitialCenterRef.current = true;
    }
  }, [lastSeen]);

  // Layer switching
  useEffect(() => {
    if (!mapInstance.current || !baseLayersRef.current.satellite) return;
    const other = mapLayer === 'satellite' ? 'street' : 'satellite';
    if (baseLayersRef.current[other]) mapInstance.current.removeLayer(baseLayersRef.current[other]);
    baseLayersRef.current[mapLayer].addTo(mapInstance.current);
  }, [mapLayer]);

  // Update user location marker
  useEffect(() => {
    if (!mapInstance.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLocation);
    } else {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; background: rgba(59, 130, 246, 0.25); border-radius: 50%; animation: userPulse 2s ease-out infinite;"></div>
            <div style="width: 18px; height: 18px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); position: relative; z-index: 1;"></div>
          </div>
          <style>@keyframes userPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }</style>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 })
        .bindPopup('<b>You</b>')
        .addTo(mapInstance.current);
    }
  }, [userLocation]);

  // Render search path with corridor
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing path layers
    searchPathLayersRef.current.forEach(layer => {
      try { layer.remove(); } catch (e) {}
    });
    searchPathLayersRef.current = [];

    if (!searchPath || searchPath.length === 0) return;

    // Draw coverage corridor — your beam: the ground your flashlight covered
    if (searchPath.length >= 2) {
      const corridorCoords = generateCorridorPolygon(searchPath, CORRIDOR_WIDTH_METERS);
      if (corridorCoords) {
        const corridor = L.polygon(corridorCoords, {
          color: '#facc15',
          fillColor: '#facc15',
          fillOpacity: 0.14,
          weight: 1,
          opacity: 0.4,
        });
        corridor.addTo(mapInstance.current);
        corridor.bringToBack();
        searchPathLayersRef.current.push(corridor);
      }

      // Draw connecting line
      const lineCoords = searchPath.map(p => [p.lat, p.lng]);
      const pathLine = L.polyline(lineCoords, {
        color: '#facc15',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      pathLine.addTo(mapInstance.current);
      searchPathLayersRef.current.push(pathLine);
    }

    // Draw point markers
    searchPath.forEach((point, index) => {
      const isFirst = index === 0;
      const isLast = index === searchPath.length - 1;
      const isOutOfZone = point.inZone === false;

      let markerColor = '#eab308';
      let markerSize = 22;
      let content = `${index + 1}`;

      if (isFirst) {
        markerColor = '#22c55e';
        markerSize = 28;
        content = '▶';
      } else if (isLast && searchPath.length > 1) {
        markerColor = '#3b82f6';
        markerSize = 28;
        content = '●';
      } else if (isOutOfZone) {
        markerColor = '#6b7280';
      }

      const pointIcon = L.divIcon({
        className: 'search-path-marker',
        html: `
          <div style="
            width: ${markerSize}px;
            height: ${markerSize}px;
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px ${markerColor}80;
            font-size: ${isFirst || isLast ? '14px' : '11px'};
            font-weight: 700;
            color: white;
          ">${content}</div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2]
      });

      const timeStr = point.timestamp
        ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      const marker = L.marker([point.lat, point.lng], {
        icon: pointIcon,
        zIndexOffset: isFirst || isLast ? 500 : 100
      }).bindPopup(`
        <div style="text-align:center;padding:4px;min-width:100px;">
          <div style="font-weight:600;color:${markerColor};">
            ${isFirst ? 'Start Point' : isLast ? 'Current Position' : `Point ${index + 1}`}
          </div>
          ${timeStr ? `<div style="font-size:11px;color:#666;">${timeStr}</div>` : ''}
          ${point.isManual ? `<div style="font-size:10px;color:#888;">Manually placed</div>` : ''}
          ${isOutOfZone ? `<div style="font-size:10px;color:#f59e0b;">Outside search zone</div>` : ''}
        </div>
      `).addTo(mapInstance.current);

      searchPathLayersRef.current.push(marker);
    });
  }, [searchPath, generateCorridorPolygon]);

  // Render markers and circles (lastSeen, sightings, probability zones)
  useEffect(() => {
    if (!mapInstance.current) return;

    const currentGen = ++renderGenRef.current;

    const cleanupLayers = () => {
      markersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      circlesRef.current.forEach(c => { try { c.remove(); } catch (e) {} });
      markersRef.current = [];
      circlesRef.current = [];
    };

    cleanupLayers();

    // Last seen marker: a pulsing beacon, the visual anchor of the mission
    if (lastSeen) {
      const isLatestSighting = lastSeen.isLatestSighting;
      const markerColor = isLatestSighting ? '#f59e0b' : '#ef4444';
      const labelText = isLatestSighting ? 'Latest Sighting' : 'Last Seen';

      const lastSeenIcon = L.divIcon({
        className: 'last-seen-marker',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; background: ${markerColor}40; border-radius: 50%; animation: beaconPulse 2s ease-out infinite;"></div>
            <div style="position: relative; width: 18px; height: 18px; background: ${markerColor}; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px ${markerColor}b3;"></div>
          </div>
          <style>@keyframes beaconPulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.1); opacity: 0; } }</style>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const lastSeenMarker = L.marker([lastSeen.lat, lastSeen.lng], { icon: lastSeenIcon })
        .bindPopup(`<b style="color:${markerColor}">${labelText}</b><br><small>${lastSeen.address || ''}</small>`)
        .addTo(mapInstance.current);
      markersRef.current.push(lastSeenMarker);

      // Probability circles
      if (showProbabilityCircles) {
        const radius = getSearchRadius();
        const milesToMeters = (miles) => miles * 1609.34;

        [[radius.inner, '#22c55e'], [radius.middle, '#eab308'], [radius.outer, '#6366f1']].forEach(([r, color]) => {
          const circle = L.circle([lastSeen.lat, lastSeen.lng], {
            radius: milesToMeters(r),
            color,
            fillColor: color,
            fillOpacity: 0.03,
            weight: 1,
            dashArray: '5, 5'
          }).addTo(mapInstance.current);
          circlesRef.current.push(circle);
        });
      }

      // Research-based probability zones (octants)
      if (showProbabilityZones && probabilityZones?.zones) {
        const milesToMeters = (miles) => miles * 1609.34;
        const zoneCenter = probabilityZones.center || [lastSeen.lat, lastSeen.lng];

        const generateArcCoords = (centerCoords, innerRadius, outerRadius, startAngle, endAngle, numPoints = 16) => {
          const coords = [];
          const [lat, lng] = centerCoords;

          for (let i = 0; i <= numPoints; i++) {
            const angle = startAngle + (i / numPoints) * (endAngle - startAngle);
            const radians = ((90 - angle) * Math.PI) / 180;
            const latOffset = (outerRadius / 111320) * Math.sin(radians);
            const lngOffset = (outerRadius / (111320 * Math.cos(lat * Math.PI / 180))) * Math.cos(radians);
            coords.push([lat + latOffset, lng + lngOffset]);
          }

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

        const sortedZones = [...probabilityZones.zones].sort((a, b) => a.radius - b.radius);
        const octants = [
          { name: 'N', startAngle: -22.5, endAngle: 22.5 },
          { name: 'NE', startAngle: 22.5, endAngle: 67.5 },
          { name: 'E', startAngle: 67.5, endAngle: 112.5 },
          { name: 'SE', startAngle: 112.5, endAngle: 157.5 },
          { name: 'S', startAngle: 157.5, endAngle: 202.5 },
          { name: 'SW', startAngle: 202.5, endAngle: 247.5 },
          { name: 'W', startAngle: 247.5, endAngle: 292.5 },
          { name: 'NW', startAngle: 292.5, endAngle: 337.5 },
        ];

        sortedZones.forEach((zone, zoneIndex) => {
          const outerRadius = milesToMeters(zone.radius);
          const innerRadius = zoneIndex === 0 ? 0 : milesToMeters(sortedZones[zoneIndex - 1].radius);
          const zoneColor = (zoneColors && zoneColors[zone.name]) || zone.color;
          // Fill priority: explicit override, then the research lib's own
          // per-zone opacity. A 0 skips the ring so the map stays dark.
          const zoneFill = zoneFills && typeof zoneFills[zone.name] === 'number'
            ? zoneFills[zone.name]
            : typeof zone.fillOpacity === 'number' ? zone.fillOpacity : 0.2;
          if (zoneFill <= 0) return;

          octants.forEach((octant) => {
            const sliceCoords = generateArcCoords(zoneCenter, innerRadius, outerRadius, octant.startAngle, octant.endAngle);
            const polygon = L.polygon(sliceCoords, {
              color: zoneColor,
              fillColor: zoneColor,
              fillOpacity: zoneFill,
              weight: 0,
            });
            polygon.bindPopup(`<div style="text-align:center;"><b style="color:${zoneColor}">${zone.name === 'HIGH' ? 'Most likely area' : zone.name === 'EXTENDED' ? 'Outer edge' : `${zone.name.charAt(0)}${zone.name.slice(1).toLowerCase()} likelihood`}</b><br>${octant.name} · ${zone.probabilityPercent || zone.cumulativePercent}% of cases</div>`);
            polygon.addTo(mapInstance.current);
            polygon.bringToBack();
            circlesRef.current.push(polygon);
          });
        });

        // The beam edge: one dashed ring marking the outer search boundary
        const maxRadius = sortedZones.length ? milesToMeters(sortedZones[sortedZones.length - 1].radius) : 0;
        if (maxRadius > 0) {
          const edgeColor = (zoneColors && zoneColors.HIGH) || '#facc15';
          const beamEdge = L.circle(zoneCenter, {
            radius: maxRadius,
            color: edgeColor,
            weight: 1.5,
            opacity: 0.35,
            dashArray: '6, 10',
            fill: false,
          });
          beamEdge.addTo(mapInstance.current);
          beamEdge.bringToBack();
          circlesRef.current.push(beamEdge);
        }
      }
    }

    // Sighting markers
    sightings.forEach((sighting) => {
      if (!sighting.latitude || !sighting.longitude) return;

      const sightingTime = sighting.sightedAt || sighting.createdAt || new Date().toISOString();
      const hoursSinceSighting = (Date.now() - new Date(sightingTime).getTime()) / 3600000;
      const isConfirmed = sighting.verified === true || sighting.isConfirmed === true;
      // Confirmed = emerald (good news); unconfirmed = amber (a warm lead)
      const zoneColor = isConfirmed ? '#34d399' : '#fbbf24';

      const timeAgoText = hoursSinceSighting < 1 ? 'Just now' :
        hoursSinceSighting < 24 ? `${Math.floor(hoursSinceSighting)}h ago` :
        `${Math.floor(hoursSinceSighting / 24)}d ago`;

      const popupHtml = `<div style="text-align:center;"><b style="color:${zoneColor}">${isConfirmed ? 'Confirmed sighting' : 'Reported sighting'}</b><br>${timeAgoText}${sighting.description ? `<br><small>${String(sighting.description).slice(0, 120)}</small>` : ''}</div>`;

      // The uncertainty circle grows with age but FADES as it grows —
      // a fresh sighting glows, a stale one keeps only its pin. This is
      // what keeps the map dark instead of washed in overlay color.
      if (hoursSinceSighting < 24) {
        const radiusMiles = Math.min(0.1 + (Math.max(0, hoursSinceSighting) * 0.25), 3);
        const radiusMeters = radiusMiles * 1609.34;
        const fillOpacity = hoursSinceSighting <= 1 ? 0.12 : hoursSinceSighting <= 6 ? 0.05 : 0;
        const lineOpacity = hoursSinceSighting <= 1 ? 0.6 : hoursSinceSighting <= 6 ? 0.4 : 0.25;

        const sightingZone = L.circle([sighting.latitude, sighting.longitude], {
          radius: radiusMeters,
          color: zoneColor,
          fillColor: zoneColor,
          fillOpacity,
          weight: 1.5,
          opacity: lineOpacity,
          dashArray: isConfirmed ? '' : '6, 4',
        });

        sightingZone.bindPopup(popupHtml);
        sightingZone.addTo(mapInstance.current);
        sightingZone.bringToBack();
        circlesRef.current.push(sightingZone);
      }

      const eyeSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      const sightingIcon = L.divIcon({
        className: 'sighting-marker',
        html: `<div style="width: 28px; height: 28px; background: ${zoneColor}; border: 2.5px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px ${zoneColor}80;">${eyeSvg}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon, zIndexOffset: 500 })
        .bindPopup(popupHtml)
        .addTo(mapInstance.current);
      markersRef.current.push(marker);
    });

    return () => {
      if (currentGen === renderGenRef.current) cleanupLayers();
    };
  }, [lastSeen, sightings, petSpecies, hoursElapsed, showProbabilityZones, probabilityZones, zoneColors, zoneFills]);

  // Render historical coverage trails
  useEffect(() => {
    if (!mapInstance.current || !showCoverage) return;

    coverageLayersRef.current.forEach(layer => { try { layer.remove(); } catch (e) {} });
    coverageLayersRef.current = [];

    if (!coverageTrails || coverageTrails.length === 0) return;

    coverageTrails.forEach(trail => {
      if (!trail.path || trail.path.length < 2) return;

      const pathCoords = trail.path.map(p => [p.lat, p.lng]);
      const lineColor = trail.color || '#6366f1';

      const trailLine = L.polyline(pathCoords, {
        color: lineColor,
        weight: 3,
        opacity: 0.5,
      }).addTo(mapInstance.current);

      trailLine.on('click', (e) => {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`<b style="color:${lineColor}">${trail.userName || 'Team Member'}</b>`)
          .openOn(mapInstance.current);
      });
      coverageLayersRef.current.push(trailLine);
    });
  }, [coverageTrails, showCoverage]);

  // Fly the camera to an externally requested point (e.g. a hot sighting)
  useEffect(() => {
    if (!mapInstance.current || !focusPoint?.lat || !focusPoint?.lng) return;
    try {
      mapInstance.current.flyTo([focusPoint.lat, focusPoint.lng], focusPoint.zoom || 16, { duration: 1.2 });
    } catch (e) {}
  }, [focusPoint?.key, focusPoint?.lat, focusPoint?.lng]);

  // Render POI markers
  useEffect(() => {
    if (!mapInstance.current) return;

    poiMarkersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
    poiMarkersRef.current = [];

    if (!showPOIs || !pois || pois.length === 0) return;

    const typeColors = { SHELTER: '#6366f1', RESCUE: '#8b5cf6', VET: '#10b981', ANIMAL_CONTROL: '#f59e0b' };

    pois.forEach(poi => {
      if (!poi.latitude || !poi.longitude) return;
      const color = typeColors[poi.type?.toUpperCase()] || '#6366f1';

      const poiIcon = L.divIcon({
        className: 'poi-marker',
        html: `<div style="width: 28px; height: 28px; background: ${color}; border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px;">${poi.icon || '🏠'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([poi.latitude, poi.longitude], { icon: poiIcon })
        .bindPopup(`<strong style="color:${color};">${poi.name}</strong><br/>${poi.address || ''}`)
        .addTo(mapInstance.current);
      poiMarkersRef.current.push(marker);
    });
  }, [pois, showPOIs]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapRef}
        className={`w-full h-full ${isEditMode ? 'cursor-crosshair' : ''}`}
      />

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="absolute top-4 left-4 z-[400] bg-purple-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <MousePointer size={16} />
          <span>Click map to add points</span>
        </div>
      )}

      {/* Map Controls — one consistent stack */}
      {interactive && (
        <div
          className="absolute top-4 right-4 z-[400] flex flex-col gap-2"
          style={controlsOffset ? { top: controlsOffset.top, right: controlsOffset.right } : undefined}
        >
          <div className="flex flex-col rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
            <button
              onClick={() => mapInstance.current?.zoomIn()}
              className="w-11 h-11 flex items-center justify-center text-slate-100 hover:bg-white/10 active:scale-95 transition-all border-b border-white/10 text-xl font-semibold leading-none"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => mapInstance.current?.zoomOut()}
              className="w-11 h-11 flex items-center justify-center text-slate-100 hover:bg-white/10 active:scale-95 transition-all text-xl font-semibold leading-none"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>

          <button
            onClick={() => setMapLayer(mapLayer === 'satellite' ? 'street' : 'satellite')}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-slate-100 shadow-xl hover:bg-white/10 active:scale-95 transition-all"
            title={mapLayer === 'satellite' ? 'Switch to map view' : 'Switch to satellite view'}
            aria-label={mapLayer === 'satellite' ? 'Switch to map view' : 'Switch to satellite view'}
          >
            {mapLayer === 'satellite' ? <MapIcon size={19} /> : <Satellite size={19} />}
          </button>

          <button
            onClick={centerOnUser}
            disabled={gpsLoading}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-sky-300 shadow-xl hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            title="My location"
            aria-label="Center on my location"
          >
            <Locate size={19} className={gpsLoading ? 'animate-pulse' : ''} />
          </button>

          <button
            onClick={() => {
              if (mapInstance.current && lastSeen) {
                const bounds = L.latLngBounds([[lastSeen.lat, lastSeen.lng]]);
                if (userLocation) bounds.extend(userLocation);
                searchPath.forEach(p => bounds.extend([p.lat, p.lng]));
                mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
              }
            }}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-slate-100 shadow-xl hover:bg-white/10 active:scale-95 transition-all"
            title="Fit the whole search"
            aria-label="Fit the whole search area"
          >
            <Maximize size={19} />
          </button>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <MapLegend
          style={legendOffset ? { top: legendOffset.top, left: legendOffset.left } : undefined}
          showSightings={sightings.length > 0}
          showSearchPath={searchPath.length > 0 || coverageTrails.length > 0}
          showActiveSearches={activeSearchersCount > 0}
          showPOIs={pois.length > 0}
          showProbabilityZones={showProbabilityZones}
          activeSearchersCount={activeSearchersCount}
        />
      )}
    </div>
  );
}
