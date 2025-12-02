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
  petSpecies = 'DOG',
  hoursElapsed = 24,
  showControls = false,
  gpsPath = [], // NEW: GPS tracking path
  showProbabilityCircles = false // NEW: Make circles optional
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const gpsLayersRef = useRef([]);
  const [userLocation, setUserLocation] = useState(null);
  const userMarkerRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('satellite'); // 'satellite' or 'street'
  const baseLayersRef = useRef({});

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
      attributionControl: false
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

    // Track user location
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(loc);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update map center when it changes
  useEffect(() => {
    if (mapInstance.current && center) {
      mapInstance.current.setView(center, 15);
    }
  }, [center]);

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
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
        .addTo(mapInstance.current);
    }
  }, [userLocation]);

  // Update markers and circles
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers and circles
    markersRef.current.forEach(m => m.remove());
    circlesRef.current.forEach(c => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    // Add last seen marker
    if (lastSeen) {
      const lastSeenIcon = L.divIcon({
        className: 'last-seen-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
            font-size: 16px;
          ">📍</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const lastSeenMarker = L.marker([lastSeen.lat, lastSeen.lng], { icon: lastSeenIcon })
        .bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <strong style="color: #ef4444;">Ran Away From Home</strong>
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

      // Fit bounds to show entire GPS path
      mapInstance.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

  }, [lastSeen, sightings, petSpecies, hoursElapsed, gpsPath]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* Layer Toggle Button */}
      <div className="absolute top-4 right-4 z-[400]">
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
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-xl p-3 text-xs z-[400] border border-slate-700">
        <div className="text-slate-400 font-semibold mb-2 text-[10px] uppercase tracking-wide">Map Legend</div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center text-[10px]">📍</div>
          <span className="text-slate-200 font-medium">Ran away from home</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-500 border border-white flex items-center justify-center text-[10px]">👁</div>
          <span className="text-slate-200 font-medium">Reported sighting</span>
        </div>
        {gpsPath && gpsPath.length > 0 && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-3 bg-purple-500/30 rounded border border-purple-500" />
            <span className="text-slate-200 font-medium">GPS tracked search area (click for details)</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
          <span className="text-slate-200 font-medium">Your location</span>
        </div>
      </div>

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
