'use client';

/**
 * Simulation Map Component - Beautiful Animated Visualization
 * Smooth marker movement, fading trails, and polished visual design
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Polygon, useMap, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PathPoint {
  hour: number;
  lat: number;
  lng: number;
  fear: number;
  hunger: number;
  state: string;
}

interface Position {
  lat: number;
  lng: number;
}

interface RoadSegment {
  type: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'railway';
  points: Position[];
  name?: string;
  crossingDifficulty: number;
  dangerLevel: number;
}

interface TerrainData {
  waterPolygons?: Array<{
    points: Position[];
    bbox: { south: number; west: number; north: number; east: number };
  }>;
  roads?: RoadSegment[];
  hasHighways?: boolean;
  hasRailways?: boolean;
}

interface SimOutcome {
  id: string;
  index: number;
  seed: number;
  outcome: string;
  outcomeDescription: string;
  timeToOutcomeHours: number | null;
  finalPosition: Position;
  maxDistanceM: number;
}

interface SimulationMapProps {
  center: { lat: number; lng: number };
  path: PathPoint[];
  currentPosition: PathPoint | null;
  searcherPositions: PathPoint[];
  playbackMinute: number;
  onLocationSelect: (lat: number, lng: number) => void;
  species: 'dog' | 'cat';
  terrainData?: TerrainData;
  outcomeMarkers?: SimOutcome[]; // Batch simulation outcomes
  selectedOutcomeIndex?: number | null;
  onOutcomeClick?: (sim: SimOutcome) => void;
}

// Inject CSS for smooth animations
const injectStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('simulation-map-styles')) return;

  const style = document.createElement('style');
  style.id = 'simulation-map-styles';
  style.textContent = `
    /* Smooth marker transitions */
    .leaflet-marker-icon {
      transition: transform 0.15s ease-out !important;
    }

    /* Pet marker pulse animation */
    @keyframes pet-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
      50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
    }

    .pet-marker-inner {
      animation: pet-pulse 2s ease-in-out infinite;
    }

    /* Fleeing state - faster pulse */
    .pet-marker-fleeing .pet-marker-inner {
      animation: pet-pulse 0.8s ease-in-out infinite;
    }

    /* Hiding state - no pulse, fade */
    .pet-marker-hiding .pet-marker-inner {
      animation: none;
      opacity: 0.7;
    }

    /* Searcher active animation */
    @keyframes searcher-scan {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .searcher-active {
      animation: searcher-scan 1.5s ease-in-out infinite;
    }

    /* Outcome marker hover effect */
    .outcome-marker {
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .outcome-marker:hover {
      transform: scale(1.3) !important;
      z-index: 1000 !important;
    }
    .outcome-marker-selected {
      transform: scale(1.4);
      z-index: 1001 !important;
    }

    /* Home marker glow */
    @keyframes home-glow {
      0%, 100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.5), 0 2px 8px rgba(0,0,0,0.3); }
      50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 2px 8px rgba(0,0,0,0.3); }
    }

    .home-marker-inner {
      animation: home-glow 3s ease-in-out infinite;
    }

    /* Trail fade gradient effect */
    .trail-segment {
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;
  document.head.appendChild(style);
};

// Create custom pet icon with state-based styling
const createPetIcon = (species: 'dog' | 'cat', state: string) => {
  const emoji = species === 'dog' ? '🐕' : '🐈';
  const bgColor = state === 'fleeing' ? '#ef4444' :
                  state === 'hiding' ? '#6b7280' :
                  state === 'traveling' ? '#f59e0b' : '#22c55e';
  const stateClass = `pet-marker-${state}`;

  return L.divIcon({
    className: `pet-marker ${stateClass}`,
    html: `<div class="pet-marker-inner" style="
      background: ${bgColor};
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      border: 3px solid white;
      box-shadow: 0 0 15px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const homeIcon = L.divIcon({
  className: 'home-marker',
  html: `<div class="home-marker-inner" style="
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 3px solid white;
  ">🏠</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Searcher icons with different colors and animations
const searcherColors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

const createSearcherIcon = (index: number, isActive: boolean) => {
  const color = searcherColors[index % searcherColors.length];
  const activeClass = isActive ? 'searcher-active' : '';

  return L.divIcon({
    className: `searcher-marker ${activeClass}`,
    html: `<div style="
      background: linear-gradient(135deg, ${color}, ${color}dd);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      opacity: ${isActive ? 1 : 0.5};
    ">👤</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Create outcome marker icon for batch results
const createOutcomeIcon = (outcome: string, index: number, isSelected: boolean) => {
  const bgColor = (outcome === 'captured' || outcome === 'self_return') ? '#22c55e' :
                  outcome === 'deceased' ? '#ef4444' : '#eab308';
  const emoji = (outcome === 'captured' || outcome === 'self_return') ? '✓' :
                outcome === 'deceased' ? '✗' : '?';
  const size = isSelected ? 28 : 20;
  const selectedClass = isSelected ? 'outcome-marker-selected' : '';

  return L.divIcon({
    className: `outcome-marker ${selectedClass}`,
    html: `<div style="
      background: ${bgColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isSelected ? 14 : 10}px;
      font-weight: bold;
      color: white;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Component to handle map clicks for location selection
function LocationSelector({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map when center changes
function MapCenterUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center.lat, center.lng, map]);

  return null;
}

// Get path color based on state
function getPathColor(state: string): string {
  switch (state) {
    case 'fleeing': return '#ef4444';
    case 'hiding': return '#6b7280';
    case 'traveling': return '#f59e0b';
    case 'foraging': return '#22c55e';
    default: return '#3b82f6';
  }
}

// Road styling
function getRoadColor(road: RoadSegment): string {
  switch (road.type) {
    case 'motorway': return '#dc2626';
    case 'trunk': return '#ea580c';
    case 'primary': return '#ca8a04';
    case 'secondary': return '#65a30d';
    case 'railway': return '#7c3aed';
    default: return '#6b7280';
  }
}

function getRoadWeight(road: RoadSegment): number {
  switch (road.type) {
    case 'motorway': return 5;
    case 'trunk': return 4;
    case 'primary': return 3;
    case 'secondary': return 2;
    case 'railway': return 3;
    default: return 2;
  }
}

// Animated path component with fading trail
function AnimatedPath({
  path,
  currentHour
}: {
  path: PathPoint[];
  currentHour: number;
}) {
  // Build segments with opacity based on recency
  const segments = useMemo(() => {
    if (path.length < 2) return [];

    const result: Array<{
      positions: [number, number][];
      color: string;
      opacity: number;
    }> = [];

    // Filter points up to current time
    const visiblePoints = path.filter(p => p.hour <= currentHour);
    if (visiblePoints.length < 2) return [];

    // Create segments with fading opacity
    const fadeWindow = 24; // Hours over which trail fades
    let currentSegment: { positions: [number, number][]; color: string; hours: number[] } | null = null;

    for (let i = 0; i < visiblePoints.length; i++) {
      const point = visiblePoints[i];
      const color = getPathColor(point.state);

      if (!currentSegment || currentSegment.color !== color) {
        if (currentSegment && currentSegment.positions.length > 0) {
          // Calculate opacity based on most recent point in segment
          const maxHour = Math.max(...currentSegment.hours);
          const age = currentHour - maxHour;
          const opacity = Math.max(0.15, 1 - (age / fadeWindow) * 0.85);

          result.push({
            positions: currentSegment.positions,
            color: currentSegment.color,
            opacity,
          });

          // Start new segment with last point for continuity
          const lastPos = currentSegment.positions[currentSegment.positions.length - 1];
          currentSegment = { positions: [lastPos], color, hours: [point.hour] };
        } else {
          currentSegment = { positions: [], color, hours: [] };
        }
      }

      currentSegment.positions.push([point.lat, point.lng]);
      currentSegment.hours.push(point.hour);
    }

    // Add final segment
    if (currentSegment && currentSegment.positions.length >= 2) {
      const maxHour = Math.max(...currentSegment.hours);
      const age = currentHour - maxHour;
      const opacity = Math.max(0.15, 1 - (age / fadeWindow) * 0.85);

      result.push({
        positions: currentSegment.positions,
        color: currentSegment.color,
        opacity,
      });
    }

    return result;
  }, [path, currentHour]);

  return (
    <>
      {segments.map((segment, index) => (
        <Polyline
          key={`trail-${index}`}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 4,
            opacity: segment.opacity,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
    </>
  );
}

// Searcher trail component
function SearcherTrail({
  searcherIndex,
  path,
  currentHour,
  color,
}: {
  searcherIndex: number;
  path: PathPoint[];
  currentHour: number;
  color: string;
}) {
  const positions = useMemo(() => {
    return path
      .filter(p => p.hour <= currentHour && p.state === 'searching')
      .map(p => [p.lat, p.lng] as [number, number]);
  }, [path, currentHour]);

  if (positions.length < 2) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: 2,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '4, 8',
      }}
    />
  );
}

export default function SimulationMap({
  center,
  path,
  currentPosition,
  searcherPositions,
  playbackMinute,
  onLocationSelect,
  species,
  terrainData,
  outcomeMarkers,
  selectedOutcomeIndex,
  onOutcomeClick,
}: SimulationMapProps) {
  const [showTerrain, setShowTerrain] = useState(true);
  const [showOutcomes, setShowOutcomes] = useState(true);
  const currentHour = playbackMinute / 60;

  // Inject animation styles on mount
  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      >
        {/* Dark-mode friendly map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Click handler for location selection */}
        <LocationSelector onSelect={onLocationSelect} />

        {/* Recenter map when center changes */}
        <MapCenterUpdater center={center} />

        {/* Search radius circle - subtle */}
        <Circle
          center={[center.lat, center.lng]}
          radius={2000}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.03,
            weight: 1,
            dashArray: '8, 8',
          }}
        />

        {/* Water areas */}
        {showTerrain && terrainData?.waterPolygons?.map((water, index) => (
          <Polygon
            key={`water-${index}`}
            positions={water.points.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#0ea5e9',
              fillOpacity: 0.35,
              weight: 2,
            }}
          />
        ))}

        {/* Roads and railways */}
        {showTerrain && terrainData?.roads?.map((road, index) => (
          <Polyline
            key={`road-${index}`}
            positions={road.points.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: getRoadColor(road),
              weight: getRoadWeight(road),
              opacity: 0.6,
              dashArray: road.type === 'railway' ? '10, 5' : undefined,
            }}
          />
        ))}

        {/* Animated pet trail with fading */}
        <AnimatedPath path={path} currentHour={currentHour} />

        {/* Home marker */}
        <Marker position={[center.lat, center.lng]} icon={homeIcon} />

        {/* Current pet position with animated icon */}
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={createPetIcon(species, currentPosition.state)}
          />
        )}

        {/* Searcher positions */}
        {searcherPositions.map((pos, index) => (
          <Marker
            key={`searcher-${index}`}
            position={[pos.lat, pos.lng]}
            icon={createSearcherIcon(index, pos.state === 'searching')}
          />
        ))}

        {/* Outcome markers for batch simulations */}
        {showOutcomes && outcomeMarkers?.map((sim) => (
          <Marker
            key={`outcome-${sim.index}`}
            position={[sim.finalPosition.lat, sim.finalPosition.lng]}
            icon={createOutcomeIcon(sim.outcome, sim.index, selectedOutcomeIndex === sim.index)}
            eventHandlers={{
              click: () => onOutcomeClick?.(sim),
            }}
          />
        ))}
      </MapContainer>

      {/* Toggle buttons */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        {outcomeMarkers && outcomeMarkers.length > 0 && (
          <button
            onClick={() => setShowOutcomes(!showOutcomes)}
            className={`px-3 py-2 rounded-lg shadow-lg text-xs font-medium transition-all duration-200 ${
              showOutcomes
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-white/90 text-gray-600 hover:bg-white border border-gray-200'
            }`}
          >
            {showOutcomes ? `Hide Outcomes (${outcomeMarkers.length})` : `Show Outcomes (${outcomeMarkers.length})`}
          </button>
        )}
        {(terrainData?.waterPolygons?.length || terrainData?.roads?.length) ? (
          <button
            onClick={() => setShowTerrain(!showTerrain)}
            className={`px-3 py-2 rounded-lg shadow-lg text-xs font-medium transition-all duration-200 ${
              showTerrain
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-white/90 text-gray-600 hover:bg-white border border-gray-200'
            }`}
          >
            {showTerrain ? 'Hide Terrain' : 'Show Terrain'}
          </button>
        ) : null}
      </div>

      {/* Compact status indicator */}
      {currentPosition && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg px-4 py-3 z-[1000]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{species === 'dog' ? '🐕' : '🐈'}</span>
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getPathColor(currentPosition.state) }}
                />
                <span className="text-sm font-medium capitalize">{currentPosition.state}</span>
              </div>
              <div className="text-xs text-gray-500">
                Day {Math.floor(currentHour / 24) + 1}, {Math.floor(currentHour % 24)}:00
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend - collapsible */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <details className="bg-white/95 backdrop-blur rounded-lg shadow-lg">
          <summary className="px-3 py-2 cursor-pointer text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg">
            Legend
          </summary>
          <div className="px-3 pb-3 pt-1 border-t border-gray-100">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600 mt-2">Pet States</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <span>Fleeing</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500"></div>
                  <span>Hiding</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <span>Traveling</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  <span>Foraging</span>
                </div>
              </div>

              {showTerrain && (terrainData?.waterPolygons?.length || terrainData?.roads?.length) ? (
                <>
                  <div className="text-xs font-semibold text-gray-600 mt-3 pt-2 border-t border-gray-100">Terrain</div>
                  <div className="space-y-1">
                    {terrainData?.waterPolygons && terrainData.waterPolygons.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded bg-sky-400"></div>
                        <span>Water</span>
                      </div>
                    )}
                    {terrainData?.hasHighways && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-1 bg-red-600 rounded"></div>
                        <span>Highway</span>
                      </div>
                    )}
                    {terrainData?.hasRailways && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-1 bg-purple-600 rounded"></div>
                        <span>Railway</span>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </details>
      </div>

      {/* Instructions */}
      {path.length === 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur rounded-xl shadow-lg px-5 py-3 z-[1000]">
          <p className="text-sm text-gray-600">
            Click map to set start location, then run simulation
          </p>
        </div>
      )}
    </div>
  );
}
