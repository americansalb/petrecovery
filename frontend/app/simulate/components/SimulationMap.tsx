'use client';

/**
 * Simulation Map Component - Built from scratch
 * Displays pet and searcher agents moving through terrain with water/road visualization
 */

import { useEffect, useState } from 'react';
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

interface SimulationMapProps {
  center: { lat: number; lng: number };
  path: PathPoint[];
  currentPosition: PathPoint | null;
  searcherPositions: PathPoint[];
  playbackMinute: number;
  onLocationSelect: (lat: number, lng: number) => void;
  species: 'dog' | 'cat';
  terrainData?: TerrainData;
}

// Create custom icons for pet and home
const createPetIcon = (species: 'dog' | 'cat', state: string) => {
  const emoji = species === 'dog' ? '🐕' : '🐈';
  const bgColor = state === 'fleeing' ? '#ef4444' :
                  state === 'hiding' ? '#6b7280' :
                  state === 'traveling' ? '#f59e0b' : '#22c55e';

  return L.divIcon({
    className: 'pet-marker',
    html: `<div style="
      background: ${bgColor};
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const homeIcon = L.divIcon({
  className: 'home-marker',
  html: `<div style="
    background: #3b82f6;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">🏠</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Searcher icons with different colors
const searcherColors = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

const createSearcherIcon = (index: number, isActive: boolean) => {
  const color = searcherColors[index % searcherColors.length];
  const opacity = isActive ? 1 : 0.5;

  return L.divIcon({
    className: 'searcher-marker',
    html: `<div style="
      background: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      opacity: ${opacity};
    ">🔍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

// Build path segments with colors based on state
function buildColoredPath(path: PathPoint[]): Array<{ positions: [number, number][]; color: string }> {
  if (path.length < 2) return [];

  const segments: Array<{ positions: [number, number][]; color: string }> = [];
  let currentSegment: { positions: [number, number][]; color: string } | null = null;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const color = getPathColor(point.state);

    if (!currentSegment || currentSegment.color !== color) {
      // Start new segment
      if (currentSegment && currentSegment.positions.length > 0) {
        // Add last point of previous segment to start of new one for continuity
        const lastPos = currentSegment.positions[currentSegment.positions.length - 1];
        currentSegment = { positions: [lastPos], color };
      } else {
        currentSegment = { positions: [], color };
      }
      segments.push(currentSegment);
    }

    currentSegment.positions.push([point.lat, point.lng]);
  }

  return segments.filter(s => s.positions.length >= 2);
}

// Road color based on type and danger level
function getRoadColor(road: RoadSegment): string {
  switch (road.type) {
    case 'motorway': return '#dc2626'; // Red - very dangerous
    case 'trunk': return '#ea580c';    // Orange - dangerous
    case 'primary': return '#ca8a04';  // Yellow - moderate danger
    case 'secondary': return '#65a30d'; // Light green - low danger
    case 'railway': return '#7c3aed';  // Purple - railways
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

export default function SimulationMap({
  center,
  path,
  currentPosition,
  searcherPositions,
  playbackMinute,
  onLocationSelect,
  species,
  terrainData,
}: SimulationMapProps) {
  const [pathSegments, setPathSegments] = useState<Array<{ positions: [number, number][]; color: string }>>([]);
  const [showTerrain, setShowTerrain] = useState(true);

  // Build colored path segments when path changes
  useEffect(() => {
    if (path.length > 0) {
      // Only show path up to current playback time
      const currentHour = playbackMinute / 60;
      const visiblePath = path.filter(p => p.hour <= currentHour);
      setPathSegments(buildColoredPath(visiblePath));
    } else {
      setPathSegments([]);
    }
  }, [path, playbackMinute]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      >
        {/* OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Click handler for location selection */}
        <LocationSelector onSelect={onLocationSelect} />

        {/* Recenter map when center changes */}
        <MapCenterUpdater center={center} />

        {/* Home marker */}
        <Marker position={[center.lat, center.lng]} icon={homeIcon} />

        {/* Search radius circle */}
        <Circle
          center={[center.lat, center.lng]}
          radius={2000}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5, 5',
          }}
        />

        {/* Water areas */}
        {showTerrain && terrainData?.waterPolygons?.map((water, index) => (
          <Polygon
            key={`water-${index}`}
            positions={water.points.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: '#0ea5e9',
              fillColor: '#0ea5e9',
              fillOpacity: 0.3,
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
              opacity: 0.7,
              dashArray: road.type === 'railway' ? '10, 5' : undefined,
            }}
          />
        ))}

        {/* Colored path segments */}
        {pathSegments.map((segment, index) => (
          <Polyline
            key={index}
            positions={segment.positions}
            pathOptions={{
              color: segment.color,
              weight: 3,
              opacity: 0.8,
            }}
          />
        ))}

        {/* Current pet position */}
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
      </MapContainer>

      {/* Terrain toggle button */}
      {(terrainData?.waterPolygons?.length || terrainData?.roads?.length) && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={() => setShowTerrain(!showTerrain)}
            className={`px-3 py-2 rounded-lg shadow-lg text-xs font-medium transition-colors ${
              showTerrain
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            {showTerrain ? 'Hide Terrain' : 'Show Terrain'}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] max-w-[200px]">
        <div className="text-xs font-semibold mb-2">Agents</div>
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">{species === 'dog' ? '🐕' : '🐈'}</span>
            <span>Lost Pet</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">🔍</span>
            <span>Searchers</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">🏠</span>
            <span>Home</span>
          </div>
        </div>
        <div className="text-xs font-semibold mb-2">Pet States</div>
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Fleeing</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Hiding</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Traveling</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Foraging</span>
          </div>
        </div>

        {/* Terrain legend */}
        {showTerrain && (terrainData?.waterPolygons?.length || terrainData?.roads?.length) && (
          <>
            <div className="text-xs font-semibold mb-2 pt-2 border-t border-gray-200">Terrain</div>
            <div className="space-y-1">
              {terrainData?.waterPolygons && terrainData.waterPolygons.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded bg-sky-400"></div>
                  <span>Water (blocked)</span>
                </div>
              )}
              {terrainData?.hasHighways && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-1 bg-red-600 rounded"></div>
                  <span>Highway (danger)</span>
                </div>
              )}
              {terrainData?.roads?.some(r => r.type === 'trunk') && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-1 bg-orange-500 rounded"></div>
                  <span>Major Road</span>
                </div>
              )}
              {terrainData?.hasRailways && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-1 bg-purple-600 rounded" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, white 3px, white 5px)'}}></div>
                  <span>Railway</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Instructions */}
      {path.length === 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-2 z-[1000]">
          <p className="text-sm text-gray-600">
            Click map to set start location, then run simulation
          </p>
        </div>
      )}
    </div>
  );
}
