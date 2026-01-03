'use client';

/**
 * SimulatorMap - Interactive map for simulation visualization
 *
 * Features:
 * - Click to set last seen location
 * - Probability zones overlay
 * - Animated pet and searcher markers during playback
 * - Path trails
 * - Heatmap of find locations from batch simulations
 * - Terrain overlay (OSM barriers and zones)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Probability zone colors
const ZONE_COLORS = {
  HIGH: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444' },
  MEDIUM: { fill: 'rgba(249, 115, 22, 0.2)', stroke: '#f97316' },
  LOW: { fill: 'rgba(234, 179, 8, 0.2)', stroke: '#eab308' },
  EXTENDED: { fill: 'rgba(107, 114, 128, 0.15)', stroke: '#6b7280' },
};

// Calculate probability zone radii based on config
function calculateZoneRadii(config) {
  // Base radius depends on species and size
  const baseRadii = {
    DOG: { TINY: 0.3, SMALL: 0.5, MEDIUM: 1.0, LARGE: 1.5, GIANT: 2.5 },
    CAT: { indoor: 0.15, outdoor: 0.4 },
    BIRD: { default: 2.0 },
    OTHER: { default: 0.5 },
  };

  let baseRadius;
  if (config.petSpecies === 'DOG') {
    baseRadius = baseRadii.DOG[config.petSize] || 1.0;
  } else if (config.petSpecies === 'CAT') {
    baseRadius = config.isIndoorPet ? baseRadii.CAT.indoor : baseRadii.CAT.outdoor;
  } else {
    baseRadius = baseRadii[config.petSpecies]?.default || 0.5;
  }

  // Apply search radius scaling
  const scaleFactor = config.searchRadiusMiles / 2.0;

  return {
    HIGH: baseRadius * scaleFactor,
    MEDIUM: baseRadius * 2 * scaleFactor,
    LOW: baseRadius * 4 * scaleFactor,
    EXTENDED: baseRadius * 8 * scaleFactor,
  };
}

// Convert miles to meters for Leaflet
function milesToMeters(miles) {
  return miles * 1609.34;
}

// Species-specific pet icons
const PET_ICONS = {
  DOG: '🐕',
  CAT: '🐈',
  BIRD: '🦜',
  OTHER: '🐾',
};

export default function SimulatorMap({
  config,
  simulation,
  playbackState,
  onLocationSelect,
  batch, // Optional: batch results for heatmap
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({
    center: null,
    pet: null,
    searchers: [],
    zones: [],
    paths: [],
    terrain: [],
    heatmap: [],
  });
  const [showTerrain, setShowTerrain] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [config.centerLatitude, config.centerLongitude],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Click handler for location selection
    map.on('click', (e) => {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center marker and zones when config changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers and zones
    if (markersRef.current.center) {
      markersRef.current.center.remove();
    }
    markersRef.current.zones.forEach(zone => zone.remove());
    markersRef.current.zones = [];

    // Add center marker (last seen location)
    const centerIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #4f46e5;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: 12px;">★</span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    markersRef.current.center = L.marker(
      [config.centerLatitude, config.centerLongitude],
      { icon: centerIcon }
    ).addTo(map);

    // Add probability zones
    const zoneRadii = calculateZoneRadii(config);

    // Draw zones from largest to smallest so smaller ones are on top
    ['EXTENDED', 'LOW', 'MEDIUM', 'HIGH'].forEach(zoneName => {
      const zone = L.circle([config.centerLatitude, config.centerLongitude], {
        radius: milesToMeters(zoneRadii[zoneName]),
        fillColor: ZONE_COLORS[zoneName].fill,
        fillOpacity: 0.3,
        color: ZONE_COLORS[zoneName].stroke,
        weight: 2,
        dashArray: zoneName === 'EXTENDED' ? '5, 5' : null,
      }).addTo(map);

      markersRef.current.zones.push(zone);
    });

    // Pan to center
    map.setView([config.centerLatitude, config.centerLongitude], 14);
  }, [config.centerLatitude, config.centerLongitude, config.petSpecies, config.petSize, config.isIndoorPet, config.searchRadiusMiles]);

  // Update pet and searcher markers during playback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !simulation) return;

    // Clear existing pet marker
    if (markersRef.current.pet) {
      markersRef.current.pet.remove();
      markersRef.current.pet = null;
    }

    // Clear existing searcher markers
    markersRef.current.searchers.forEach(m => m.remove());
    markersRef.current.searchers = [];

    // Clear existing paths
    markersRef.current.paths.forEach(p => p.remove());
    markersRef.current.paths = [];

    if (!playbackState.petPosition) return;

    // Add pet marker
    const petState = playbackState.petPosition.state || 'WANDERING';
    const petColors = {
      FLEEING: '#ef4444',
      HIDING: '#8b5cf6',
      FORAGING: '#f59e0b',
      WANDERING: '#10b981',
      TERRITORIAL: '#3b82f6',
      SHELTERED: '#6b7280',
    };

    // Get species-specific emoji
    const petEmoji = PET_ICONS[config.petSpecies] || PET_ICONS.OTHER;

    // Add pulse animation and state-specific styling
    const isMoving = petState === 'FLEEING' || petState === 'WANDERING' || petState === 'FORAGING';
    const pulseAnimation = isMoving ? 'animation: pulse 1s infinite;' : '';

    const petIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes hide {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
        </style>
        <div style="
          width: 32px;
          height: 32px;
          background: ${petColors[petState] || '#10b981'};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          ${isMoving ? 'animation: pulse 1s infinite;' : ''}
          ${petState === 'HIDING' ? 'animation: hide 2s infinite; opacity: 0.8;' : ''}
        ">
          <span style="font-size: 16px;">${petEmoji}</span>
        </div>
        ${petState !== 'SHELTERED' ? `
          <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            background: ${petColors[petState] || '#10b981'};
            color: white;
            padding: 1px 4px;
            border-radius: 3px;
            white-space: nowrap;
            font-weight: 500;
          ">${petState}</div>
        ` : ''}
      `,
      iconSize: [32, 40],
      iconAnchor: [16, 16],
    });

    markersRef.current.pet = L.marker(
      [playbackState.petPosition.lat, playbackState.petPosition.lng],
      { icon: petIcon }
    ).addTo(map);

    // Add searcher markers
    playbackState.searcherPositions.forEach((searcher, index) => {
      const searcherIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
          ">${index + 1}</div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker(
        [searcher.lat, searcher.lng],
        { icon: searcherIcon }
      ).addTo(map);

      markersRef.current.searchers.push(marker);
    });

    // Draw pet path trail
    if (simulation.petPathJson) {
      try {
        const petPath = JSON.parse(simulation.petPathJson);
        const pathUpToCurrent = petPath
          .filter(p => p.minute <= playbackState.currentMinute)
          .map(p => [p.lat, p.lng]);

        if (pathUpToCurrent.length > 1) {
          const trail = L.polyline(pathUpToCurrent, {
            color: '#10b981',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5',
          }).addTo(map);

          markersRef.current.paths.push(trail);
        }
      } catch (e) {
        console.error('Failed to parse pet path:', e);
      }
    }
  }, [simulation, playbackState.petPosition, playbackState.searcherPositions, playbackState.currentMinute]);

  // Display terrain features (barriers and zones)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !simulation?.terrainJson) return;

    // Clear existing terrain
    markersRef.current.terrain.forEach(layer => layer.remove());
    markersRef.current.terrain = [];

    if (!showTerrain) return;

    try {
      const terrain = JSON.parse(simulation.terrainJson);

      // Draw zones first (underneath barriers)
      if (terrain.zones) {
        terrain.zones.forEach(zone => {
          if (zone.coords && zone.coords.length > 2) {
            const polygon = L.polygon(zone.coords, {
              fillColor: zone.color,
              fillOpacity: 0.15,
              color: zone.color,
              weight: 1,
              opacity: 0.4,
            }).addTo(map);
            polygon.bindTooltip(zone.name, { sticky: true });
            markersRef.current.terrain.push(polygon);
          }
        });
      }

      // Draw barriers on top
      if (terrain.barriers) {
        terrain.barriers.forEach(barrier => {
          if (barrier.coords && barrier.coords.length > 1) {
            const line = L.polyline(barrier.coords, {
              color: barrier.color,
              weight: barrier.type === 'WATER' ? 4 : 3,
              opacity: 0.8,
              dashArray: barrier.type === 'FENCE' ? '4, 4' : null,
            }).addTo(map);
            line.bindTooltip(barrier.name, { sticky: true });
            markersRef.current.terrain.push(line);
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse terrain data:', e);
    }
  }, [simulation?.terrainJson, showTerrain]);

  // Display heatmap from batch simulation results
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing heatmap
    markersRef.current.heatmap.forEach(layer => layer.remove());
    markersRef.current.heatmap = [];

    if (!batch?.simulations || !showHeatmap) return;

    // Extract found locations
    const foundLocations = batch.simulations
      .filter(sim => sim.foundLatitude && sim.foundLongitude && !sim.outcome?.startsWith('TIMEOUT'))
      .map(sim => ({
        lat: sim.foundLatitude,
        lng: sim.foundLongitude,
        outcome: sim.outcome,
      }));

    if (foundLocations.length === 0) return;

    // Calculate density grid for heatmap effect
    const gridSize = 0.002; // ~200 meters
    const densityMap = new Map();

    foundLocations.forEach(loc => {
      const gridKey = `${Math.floor(loc.lat / gridSize)}_${Math.floor(loc.lng / gridSize)}`;
      densityMap.set(gridKey, (densityMap.get(gridKey) || 0) + 1);
    });

    const maxDensity = Math.max(...densityMap.values());

    // Create heatmap circles
    densityMap.forEach((count, key) => {
      const [latGrid, lngGrid] = key.split('_').map(Number);
      const lat = (latGrid + 0.5) * gridSize;
      const lng = (lngGrid + 0.5) * gridSize;
      const intensity = count / maxDensity;

      // Color gradient: yellow -> orange -> red based on density
      const hue = 60 - (intensity * 60); // 60 (yellow) to 0 (red)
      const color = `hsl(${hue}, 100%, 50%)`;

      const circle = L.circle([lat, lng], {
        radius: 50 + (intensity * 100), // 50-150m radius
        fillColor: color,
        fillOpacity: 0.3 + (intensity * 0.4),
        color: color,
        weight: 1,
        opacity: 0.5,
      }).addTo(map);

      circle.bindTooltip(`${count} pets found here`, { sticky: true });
      markersRef.current.heatmap.push(circle);
    });

    // Add individual find markers with smaller dots
    foundLocations.forEach(loc => {
      const outcomeColors = {
        FOUND_BY_SEARCHER: '#10b981',
        RETURNED_HOME: '#3b82f6',
        FOUND_VIA_SHELTER: '#8b5cf6',
        FOUND_VIA_SOCIAL: '#ec4899',
        FOUND_VIA_PLATFORM: '#6366f1',
      };

      const color = outcomeColors[loc.outcome] || '#10b981';

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 4,
        fillColor: color,
        fillOpacity: 0.8,
        color: '#fff',
        weight: 1,
      }).addTo(map);

      marker.bindTooltip(loc.outcome?.replace(/_/g, ' ') || 'Found', { sticky: true });
      markersRef.current.heatmap.push(marker);
    });

  }, [batch?.simulations, showHeatmap]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapRef} className="w-full h-full" />

      {/* Map controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Terrain toggle */}
        {simulation?.terrainJson && (
          <button
            onClick={() => setShowTerrain(!showTerrain)}
            className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition-colors ${
              showTerrain
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {showTerrain ? 'Terrain ON' : 'Terrain OFF'}
          </button>
        )}

        {/* Heatmap toggle */}
        {batch?.simulations?.length > 0 && (
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition-colors ${
              showHeatmap
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
          </button>
        )}
      </div>

      {/* Heatmap legend */}
      {batch?.simulations?.length > 0 && showHeatmap && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 backdrop-blur rounded-lg border border-gray-200 p-3 text-xs">
          <div className="font-medium text-gray-700 mb-2">Find Locations</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span>High density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-400"></div>
              <span>Medium density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
              <span>Low density</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 text-gray-500">
            {batch.simulations.filter(s => s.foundLatitude && !s.outcome?.startsWith('TIMEOUT')).length} finds plotted
          </div>
        </div>
      )}
    </div>
  );
}
