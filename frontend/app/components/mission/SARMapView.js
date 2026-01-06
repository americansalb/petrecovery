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
  interactive = true
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const searchPathLayersRef = useRef([]);
  const coverageLayersRef = useRef([]);
  const poiMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [showPOIs, setShowPOIs] = useState(false);
  const [mapLayer, setMapLayer] = useState('satellite');
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

    // Draw coverage corridor
    if (searchPath.length >= 2) {
      const corridorCoords = generateCorridorPolygon(searchPath, CORRIDOR_WIDTH_METERS);
      if (corridorCoords) {
        const corridor = L.polygon(corridorCoords, {
          color: '#a855f7',
          fillColor: '#a855f7',
          fillOpacity: 0.2,
          weight: 1,
          opacity: 0.5,
        });
        corridor.addTo(mapInstance.current);
        corridor.bringToBack();
        searchPathLayersRef.current.push(corridor);
      }

      // Draw connecting line
      const lineCoords = searchPath.map(p => [p.lat, p.lng]);
      const pathLine = L.polyline(lineCoords, {
        color: '#a855f7',
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

      let markerColor = '#a855f7';
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

    // Last seen marker
    if (lastSeen) {
      const isLatestSighting = lastSeen.isLatestSighting;
      const markerColor = isLatestSighting ? '#f59e0b' : '#ef4444';
      const emoji = isLatestSighting ? '👁' : '📍';
      const labelText = isLatestSighting ? 'Latest Sighting' : 'Last Seen';

      const lastSeenIcon = L.divIcon({
        className: 'last-seen-marker',
        html: `<div style="width: 32px; height: 32px; background: ${markerColor}; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px ${markerColor}80; font-size: 16px;">${emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
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

          octants.forEach((octant) => {
            const sliceCoords = generateArcCoords(zoneCenter, innerRadius, outerRadius, octant.startAngle, octant.endAngle);
            const polygon = L.polygon(sliceCoords, {
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.35,
              weight: 0,
            });
            polygon.bindPopup(`<div style="text-align:center;"><b style="color:${zone.color}">${zone.name}</b><br>${octant.name} - ${zone.probabilityPercent || zone.cumulativePercent}%</div>`);
            polygon.addTo(mapInstance.current);
            polygon.bringToBack();
            circlesRef.current.push(polygon);
          });
        });
      }
    }

    // Sighting markers
    sightings.forEach((sighting) => {
      if (!sighting.latitude || !sighting.longitude) return;

      const sightingTime = sighting.sightedAt || sighting.createdAt || new Date().toISOString();
      const hoursSinceSighting = (Date.now() - new Date(sightingTime).getTime()) / 3600000;
      const isConfirmed = sighting.verified === true || sighting.isConfirmed === true;
      const zoneColor = isConfirmed ? '#22c55e' : '#3b82f6';

      const radiusMiles = Math.min(0.1 + (Math.max(0, hoursSinceSighting) * 0.25), 3);
      const radiusMeters = radiusMiles * 1609.34;

      const sightingZone = L.circle([sighting.latitude, sighting.longitude], {
        radius: radiusMeters,
        color: zoneColor,
        fillColor: zoneColor,
        fillOpacity: 0.12,
        weight: 2,
        opacity: 0.7,
        dashArray: isConfirmed ? '' : '6, 4',
      });

      const timeAgoText = hoursSinceSighting < 1 ? 'Just now' :
        hoursSinceSighting < 24 ? `${Math.floor(hoursSinceSighting)}h ago` :
        `${Math.floor(hoursSinceSighting / 24)}d ago`;

      sightingZone.bindPopup(`<div style="text-align:center;"><b style="color:${zoneColor}">👁 ${isConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'}</b><br>${timeAgoText}</div>`);
      sightingZone.addTo(mapInstance.current);
      sightingZone.bringToBack();
      circlesRef.current.push(sightingZone);

      const sightingIcon = L.divIcon({
        className: 'sighting-marker',
        html: `<div style="width: 32px; height: 32px; background: ${zoneColor}; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px ${zoneColor}80; font-size: 16px;">👁</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon, zIndexOffset: 500 })
        .bindPopup(`<div style="text-align:center;"><b style="color:${zoneColor}">👁 ${isConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'}</b><br>${timeAgoText}</div>`)
        .addTo(mapInstance.current);
      markersRef.current.push(marker);
    });

    return () => {
      if (currentGen === renderGenRef.current) cleanupLayers();
    };
  }, [lastSeen, sightings, petSpecies, hoursElapsed, showProbabilityZones, probabilityZones]);

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

  // Render POI markers
  useEffect(() => {
    if (!mapInstance.current || !showPOIs) return;

    poiMarkersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
    poiMarkersRef.current = [];

    if (!pois || pois.length === 0) return;

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

      {/* Map Controls */}
      {interactive && (
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => setMapLayer(mapLayer === 'satellite' ? 'street' : 'satellite')}
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-slate-900/90 active:scale-95 transition-all"
            title="Switch Map View"
          >
            {mapLayer === 'satellite' ? <MapIcon size={20} /> : <Satellite size={20} />}
          </button>

          <button
            onClick={centerOnUser}
            disabled={gpsLoading}
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-blue-600/80 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-blue-500/90 active:scale-95 transition-all disabled:opacity-50"
            title="My Location"
          >
            <Locate size={20} className={gpsLoading ? 'animate-pulse' : ''} />
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
            className="group w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 text-white shadow-xl hover:bg-slate-900/90 active:scale-95 transition-all"
            title="Fit All"
          >
            <Maximize size={20} />
          </button>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <MapLegend
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
