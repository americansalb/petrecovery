'use client';

/**
 * Monte Carlo Simulation Page with Map Visualization
 * Desktop-first design with full-screen map
 * Based on BEHAVIORAL_PROFILES.md research
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { DOG_TEMPERAMENTS, CAT_TEMPERAMENTS } from '@/app/lib/behavioral-simulation';
import {
  Map, Play, Pause, RotateCcw, BarChart3, Loader2,
  Settings, ChevronLeft, ChevronRight, X,
  SkipBack, SkipForward, ChevronsLeft, ChevronsRight,
  Minus, Plus
} from 'lucide-react';

// Dynamically import map to avoid SSR issues with Leaflet
const SimulationMap = dynamic(
  () => import('./components/SimulationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
        <Map className="w-12 h-12 text-gray-400" />
      </div>
    )
  }
);

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

interface SimResult {
  type: 'single' | 'batch';
  profile: {
    species: string;
    temperament: string;
    temperamentName: string;
  };
  result: any;
  path?: PathPoint[];
  searcherPaths?: PathPoint[][];
  simulations?: SimOutcome[]; // All simulation outcomes for batch
  terrain?: TerrainData;
  // Store batch config for re-running individual simulations
  batchConfig?: {
    latitude: number;
    longitude: number;
    maxHours: number;
    numSearchers: number;
    searchStartDelay: number;
  };
}

// Size and age options based on SURVIVAL modifiers
const SIZE_OPTIONS = [
  { value: 'TOY', label: 'Toy (< 5 lbs)' },
  { value: 'SML', label: 'Small (5-20 lbs)' },
  { value: 'MED', label: 'Medium (20-50 lbs)' },
  { value: 'LRG', label: 'Large (50-90 lbs)' },
  { value: 'GNT', label: 'Giant (90+ lbs)' },
];

const AGE_OPTIONS = [
  { value: 'PUP', label: 'Puppy/Kitten' },
  { value: 'JUV', label: 'Juvenile' },
  { value: 'YNG', label: 'Young Adult' },
  { value: 'ADT', label: 'Adult' },
  { value: 'SEN', label: 'Senior' },
];

// Speed presets for quick selection (outside component to avoid recreation)
const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 96];

export default function SimulatePage() {
  // Pet profile
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [temperament, setTemperament] = useState('C');
  const [size, setSize] = useState('MED');
  const [age, setAge] = useState('ADT');
  const [isIndoorOnly, setIsIndoorOnly] = useState(false);

  // Location
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);

  // Simulation params - default 30 days (720 hours)
  const [maxHours, setMaxHours] = useState(720);
  const [numSearchers, setNumSearchers] = useState(3);
  const [searchStartDelay, setSearchStartDelay] = useState(2);
  const [batchSize, setBatchSize] = useState(1);

  // UI state
  const [configOpen, setConfigOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSimIndex, setLoadingSimIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSimIndex, setSelectedSimIndex] = useState<number | null>(null);

  // Playback state - speed is in "simulation hours per real second"
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMinute, setPlaybackMinute] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(4); // 4 hours per second default
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);
  const wasPlayingRef = useRef(false);

  const temperaments = species === 'dog' ? DOG_TEMPERAMENTS : CAT_TEMPERAMENTS;

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPlaybackMinute(0);
    setIsPlaying(false);
    setSelectedSimIndex(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          temperament,
          size,
          age,
          isIndoorOnly,
          latitude,
          longitude,
          maxHours,
          numSearchers,
          searchStartDelay,
          batchSize: batchSize > 1 ? batchSize : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      // Store batch config for re-running individual simulations
      if (data.type === 'batch') {
        data.batchConfig = {
          latitude,
          longitude,
          maxHours,
          numSearchers,
          searchStartDelay,
        };
      }

      setResult(data);
      setResultsOpen(true);

      // If position was adjusted (moved from water to land), update the UI coordinates
      if (data.type === 'single' && data.result?.startPosition) {
        if (data.result.positionAdjusted) {
          console.log('Start position was in water, adjusted to:', data.result.startPosition);
          setLatitude(data.result.startPosition.lat);
          setLongitude(data.result.startPosition.lng);
        }
      }

      // Auto-start playback for single simulations
      if (data.type === 'single' && data.path?.length > 0) {
        setIsPlaying(true);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setLatitude(Math.round(lat * 10000) / 10000);
    setLongitude(Math.round(lng * 10000) / 10000);
  }, []);

  // Load a specific simulation's path by re-running with the same seed
  const loadSimulationPath = async (sim: SimOutcome) => {
    if (!result?.batchConfig) return;

    setLoadingSimIndex(sim.index);
    setError(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          temperament,
          size,
          age,
          isIndoorOnly,
          latitude: result.batchConfig.latitude,
          longitude: result.batchConfig.longitude,
          maxHours: result.batchConfig.maxHours,
          numSearchers: result.batchConfig.numSearchers,
          searchStartDelay: result.batchConfig.searchStartDelay,
          seed: sim.seed, // Use exact same seed to reproduce
          batchSize: 1, // Single simulation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load simulation');
      }

      // Update result with the loaded path
      setResult({
        ...result,
        path: data.path,
        searcherPaths: data.searcherPaths,
      });
      setSelectedSimIndex(sim.index);
      setPlaybackMinute(0);
      setIsPlaying(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingSimIndex(null);
    }
  };

  // Playback controls
  const togglePlayback = () => setIsPlaying(!isPlaying);
  const resetPlayback = () => {
    setPlaybackMinute(0);
    setIsPlaying(false);
  };

  // Playback animation effect using requestAnimationFrame for smooth animation
  useEffect(() => {
    if (!isPlaying || !result?.path) return;

    const maxMinute = maxHours * 60;
    let lastFrameTime: number | null = null;
    let animationId: number;

    const animate = (currentTime: number) => {
      if (lastFrameTime === null) {
        lastFrameTime = currentTime;
      }

      const deltaSeconds = (currentTime - lastFrameTime) / 1000;
      lastFrameTime = currentTime;

      // Convert speed (hours per second) to minutes per frame
      const minutesPerFrame = playbackSpeed * 60 * deltaSeconds;

      setPlaybackMinute((prev) => {
        const next = prev + minutesPerFrame;
        if (next >= maxMinute) {
          setIsPlaying(false);
          return maxMinute;
        }
        return next;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, result?.path, maxHours, playbackSpeed]);

  // Interpolate position using binary search for O(log n) performance
  // This is critical for smooth animation with 8000+ path points
  const interpolatePosition = useCallback((path: PathPoint[], currentHour: number): PathPoint | null => {
    if (!path || path.length === 0) return null;
    if (path.length === 1) return path[0];

    // Binary search to find the segment containing currentHour
    let low = 0;
    let high = path.length - 1;

    // Edge cases
    if (currentHour <= path[0].hour) return path[0];
    if (currentHour >= path[high].hour) return path[high];

    // Binary search for the correct segment
    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2);
      if (path[mid].hour <= currentHour) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const before = path[low];
    const after = path[high];

    // Linear interpolation between the two points
    const ratio = (currentHour - before.hour) / (after.hour - before.hour);
    return {
      hour: currentHour,
      lat: before.lat + (after.lat - before.lat) * ratio,
      lng: before.lng + (after.lng - before.lng) * ratio,
      fear: before.fear + (after.fear - before.fear) * ratio,
      hunger: before.hunger + (after.hunger - before.hunger) * ratio,
      state: ratio < 0.5 ? before.state : after.state,
    };
  }, []);

  // Get current positions for playback with smooth interpolation
  const getCurrentPosition = () => {
    if (!result?.path || result.path.length === 0) return null;
    const currentHour = playbackMinute / 60;
    return interpolatePosition(result.path, currentHour);
  };

  const getSearcherPositions = () => {
    if (!result?.searcherPaths || result.searcherPaths.length === 0) return [];
    const currentHour = playbackMinute / 60;
    return result.searcherPaths.map((path: PathPoint[]) => {
      if (!path || path.length === 0) return null;
      return interpolatePosition(path, currentHour);
    }).filter(Boolean) as PathPoint[];
  };

  const currentPos = getCurrentPosition();

  // Skip functions for playback navigation
  const skipTime = useCallback((minutes: number) => {
    const maxMinute = maxHours * 60;
    setPlaybackMinute((prev) => Math.max(0, Math.min(maxMinute, prev + minutes)));
  }, [maxHours]);

  const skipHour = (direction: 1 | -1) => skipTime(direction * 60);
  const skipDay = (direction: 1 | -1) => skipTime(direction * 1440);
  const stepFrame = (direction: 1 | -1) => skipTime(direction * 5); // 5 minutes per frame

  // Adjust speed up/down
  const adjustSpeed = useCallback((increase: boolean) => {
    const currentIdx = SPEED_PRESETS.findIndex(s => s >= playbackSpeed);
    const idx = currentIdx === -1 ? SPEED_PRESETS.length - 1 : currentIdx;
    const newIdx = increase
      ? Math.min(SPEED_PRESETS.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    setPlaybackSpeed(SPEED_PRESETS[newIdx]);
  }, [playbackSpeed]);

  // Keyboard shortcuts for playback control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have a simulation result and not typing in an input
      if (!result?.path || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ': // Space - toggle play/pause
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            skipDay(-1); // Shift+Left = skip back 1 day
          } else if (e.ctrlKey || e.metaKey) {
            stepFrame(-1); // Ctrl+Left = step back 1 frame
          } else {
            skipHour(-1); // Left = skip back 1 hour
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            skipDay(1); // Shift+Right = skip forward 1 day
          } else if (e.ctrlKey || e.metaKey) {
            stepFrame(1); // Ctrl+Right = step forward 1 frame
          } else {
            skipHour(1); // Right = skip forward 1 hour
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustSpeed(true); // Increase speed
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustSpeed(false); // Decrease speed
          break;
        case 'Home':
          e.preventDefault();
          setPlaybackMinute(0);
          break;
        case 'End':
          e.preventDefault();
          setPlaybackMinute(maxHours * 60);
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setPlaybackMinute(0);
            setIsPlaying(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result?.path, maxHours, skipTime, adjustSpeed]);

  // Smooth slider handling - pause during drag, resume after
  const handleSliderMouseDown = () => {
    wasPlayingRef.current = isPlaying;
    setIsDragging(true);
    setIsPlaying(false);
  };

  const handleSliderMouseUp = () => {
    setIsDragging(false);
    if (wasPlayingRef.current) {
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaybackMinute(parseInt(e.target.value));
  };

  // Format time display
  const formatTime = (minutes: number) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`;
    }
    return `${hours}h ${mins}m`;
  };

  // Format speed display
  const formatSpeed = (speed: number) => {
    if (speed >= 24) {
      return `${(speed / 24).toFixed(speed % 24 === 0 ? 0 : 1)} day/s`;
    }
    return `${speed} hr/s`;
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gray-900">
      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <SimulationMap
          center={{ lat: latitude, lng: longitude }}
          path={result?.path || []}
          currentPosition={currentPos}
          searcherPositions={getSearcherPositions()}
          playbackMinute={playbackMinute}
          onLocationSelect={handleLocationSelect}
          species={species}
          terrainData={result?.terrain}
          outcomeMarkers={result?.simulations}
          selectedOutcomeIndex={selectedSimIndex}
          onOutcomeClick={loadSimulationPath}
        />
      </div>

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur border-b flex items-center justify-between px-4 z-[1000]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={configOpen ? 'Hide Configuration' : 'Show Configuration'}
          >
            <Settings className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Lost Pet Monte Carlo Simulation
            </h1>
            <p className="text-xs text-gray-500">
              Behavioral profiles: Huang 2018, Kremer 2021, Albrecht
            </p>
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running {batchSize > 1 ? `${batchSize} simulations...` : '...'}
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run {batchSize > 1 ? `${batchSize} Simulations` : 'Simulation'}
            </>
          )}
        </button>
      </div>

      {/* Left Panel - Configuration (floating) */}
      <div
        className={`absolute top-16 left-4 bottom-24 w-80 bg-white/95 backdrop-blur rounded-xl shadow-xl z-[1000] transition-transform duration-300 overflow-hidden flex flex-col ${
          configOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Configuration</h2>
          <button
            onClick={() => setConfigOpen(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Species */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Species
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setSpecies('dog');
                  setTemperament('C');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  species === 'dog'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">🐕</span>
                <div className="text-sm font-medium mt-1">Dog</div>
              </button>
              <button
                onClick={() => {
                  setSpecies('cat');
                  setTemperament('CAU');
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  species === 'cat'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">🐈</span>
                <div className="text-sm font-medium mt-1">Cat</div>
              </button>
            </div>
          </div>

          {/* Temperament */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperament
            </label>
            <select
              value={temperament}
              onChange={(e) => setTemperament(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(temperaments).map(([code, params]) => (
                <option key={code} value={code}>
                  {params.name} ({code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1 italic">
              {temperaments[temperament as keyof typeof temperaments]?.description}
            </p>
          </div>

          {/* Size & Age */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Age
              </label>
              <select
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {AGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Indoor Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isIndoorOnly}
              onChange={(e) => setIsIndoorOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Indoor-only pet</span>
            <span className="text-xs text-gray-500">(less outdoor survival skills)</span>
          </label>

          <hr className="border-gray-200" />

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Seen Location
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Click on the map to set location
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* Simulation Parameters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Simulation Parameters
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    value={Math.round(maxHours / 24)}
                    onChange={(e) => setMaxHours((parseInt(e.target.value) || 30) * 24)}
                    min={1}
                    max={60}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Searchers</label>
                  <input
                    type="number"
                    value={numSearchers}
                    onChange={(e) => setNumSearchers(parseInt(e.target.value) || 1)}
                    min={0}
                    max={20}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Search Start Delay (hours)</label>
                <input
                  type="number"
                  value={searchStartDelay}
                  onChange={(e) => setSearchStartDelay(parseInt(e.target.value) || 0)}
                  min={0}
                  max={48}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Batch Size (Monte Carlo runs)
                </label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={1000}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  1 = single animated simulation, 100+ = statistical analysis
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Config toggle button when closed */}
      {!configOpen && (
        <button
          onClick={() => setConfigOpen(true)}
          className="absolute top-20 left-4 bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg z-[1000] hover:bg-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Right Panel - Results (floating) */}
      {result && (
        <div
          className={`absolute top-16 right-4 bottom-24 w-80 bg-white/95 backdrop-blur rounded-xl shadow-xl z-[1000] transition-transform duration-300 overflow-hidden flex flex-col ${
            resultsOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
          }`}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Results
            </h2>
            <button
              onClick={() => setResultsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Profile summary */}
            <div className="text-sm mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-2xl mr-2">{species === 'dog' ? '🐕' : '🐈'}</span>
              <span className="font-medium">{result.profile.temperamentName}</span>
              <span className="text-gray-500 ml-1">{species}</span>
            </div>

            {/* Warning if position was adjusted */}
            {result.type === 'single' && result.result?.positionAdjusted && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <span className="font-medium">Note:</span> The selected location was in water.
                Start position was automatically moved to nearest land.
              </div>
            )}

            {result.type === 'batch' ? (
              <div className="space-y-4">
                {/* Key stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">
                      {result.result.successRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-green-600 mt-1">Recovery Rate</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">
                      {result.result.medianTimeToFindHours?.toFixed(0) || 'N/A'}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">Median Hours</div>
                  </div>
                </div>

                {/* Outcome breakdown */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Outcomes</h3>
                  {[
                    { label: 'Captured by Searcher', value: result.result.outcomes.captured, color: 'green' },
                    { label: 'Self Return', value: result.result.outcomes.selfReturn, color: 'blue' },
                    { label: 'Still Missing', value: result.result.outcomes.timeout, color: 'yellow' },
                    { label: 'Deceased', value: result.result.outcomes.deceased, color: 'red' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium">
                        {item.value}
                        <span className="text-gray-400 ml-1">
                          ({((item.value / batchSize) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* All simulations list - click to animate */}
                {result.simulations && result.simulations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      All Simulations ({result.simulations.length}) - click to animate
                    </h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {result.simulations.map((sim: SimOutcome) => (
                        <button
                          key={sim.index}
                          onClick={() => loadSimulationPath(sim)}
                          disabled={loadingSimIndex !== null}
                          className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-between ${
                            selectedSimIndex === sim.index ? 'bg-blue-50 border border-blue-200' : ''
                          } ${loadingSimIndex === sim.index ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              sim.outcome === 'captured' || sim.outcome === 'self_return'
                                ? 'bg-green-500'
                                : sim.outcome === 'deceased'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                            }`} />
                            <span className={`font-medium ${
                              sim.outcome === 'captured' || sim.outcome === 'self_return'
                                ? 'text-green-600'
                                : sim.outcome === 'deceased'
                                  ? 'text-red-600'
                                  : 'text-yellow-600'
                            }`}>
                              #{sim.index + 1}
                            </span>
                            <span className="text-gray-600">
                              {sim.outcomeDescription}
                            </span>
                          </div>
                          <div className="text-gray-400 text-[10px]">
                            {sim.timeToOutcomeHours !== null && (
                              <span>{sim.timeToOutcomeHours.toFixed(0)}h</span>
                            )}
                            {loadingSimIndex === sim.index && (
                              <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Outcomes shown as markers on map. Click to animate that simulation.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Single simulation outcome */}
                <div className={`rounded-lg p-4 ${
                  result.result.outcome === 'captured' || result.result.outcome === 'self_return'
                    ? 'bg-green-50 border border-green-200'
                    : result.result.outcome === 'deceased'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="text-lg font-bold">
                    {result.result.outcomeDescription}
                  </div>
                  {result.result.timeToOutcomeHours && (
                    <div className="text-sm text-gray-600 mt-1">
                      at {result.result.timeToOutcomeHours.toFixed(1)} hours
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Statistics</h3>
                  {[
                    { label: 'Max Distance from Home', value: `${Math.round(result.result.maxDistanceFromHomeM)}m` },
                    { label: 'Total Distance Traveled', value: `${Math.round(result.result.petDistanceM)}m` },
                    { label: 'Average Fear Level', value: `${(result.result.stats.avgFear * 100).toFixed(0)}%` },
                    { label: 'Peak Hunger Level', value: `${(result.result.stats.peakHunger * 100).toFixed(0)}%` },
                    { label: 'Time Spent Hiding', value: `${result.result.stats.hidingHours.toFixed(1)}h` },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results toggle button when closed */}
      {result && !resultsOpen && (
        <button
          onClick={() => setResultsOpen(true)}
          className="absolute top-20 right-4 bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg z-[1000] hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Bottom Playback Controls */}
      {result?.path && result.path.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-xl z-[1000] p-3">
          {/* Main controls row */}
          <div className="flex items-center gap-3">
            {/* Transport controls */}
            <div className="flex items-center gap-1">
              {/* Skip to start */}
              <button
                onClick={() => setPlaybackMinute(0)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Go to start (Home)"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Skip back 1 day */}
              <button
                onClick={() => skipDay(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Back 1 day (Shift+Left)"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Skip back 1 hour */}
              <button
                onClick={() => skipHour(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Back 1 hour (Left)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Play/Pause - larger and prominent */}
              <button
                onClick={togglePlayback}
                className={`p-3 rounded-full transition-all transform hover:scale-105 ${
                  isPlaying
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
                }`}
                title="Play/Pause (Space)"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Skip forward 1 hour */}
              <button
                onClick={() => skipHour(1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Forward 1 hour (Right)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Skip forward 1 day */}
              <button
                onClick={() => skipDay(1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Forward 1 day (Shift+Right)"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>

              {/* Skip to end */}
              <button
                onClick={() => setPlaybackMinute(maxHours * 60)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Go to end (End)"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200" />

            {/* Speed control with +/- buttons */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <button
                onClick={() => adjustSpeed(false)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="Slower (Down arrow)"
                disabled={playbackSpeed <= SPEED_PRESETS[0]}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-medium w-16 text-center tabular-nums">
                {formatSpeed(playbackSpeed)}
              </span>
              <button
                onClick={() => adjustSpeed(true)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="Faster (Up arrow)"
                disabled={playbackSpeed >= SPEED_PRESETS[SPEED_PRESETS.length - 1]}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200" />

            {/* Timeline slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 text-right tabular-nums">
                {formatTime(playbackMinute)}
              </span>
              <div className="flex-1 relative group">
                <input
                  ref={sliderRef}
                  type="range"
                  min={0}
                  max={maxHours * 60}
                  value={playbackMinute}
                  onChange={handleSliderChange}
                  onMouseDown={handleSliderMouseDown}
                  onMouseUp={handleSliderMouseUp}
                  onTouchStart={handleSliderMouseDown}
                  onTouchEnd={handleSliderMouseUp}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4
                             [&::-webkit-slider-thumb]:bg-blue-500
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:cursor-grab
                             [&::-webkit-slider-thumb]:active:cursor-grabbing
                             [&::-webkit-slider-thumb]:shadow-md
                             [&::-webkit-slider-thumb]:hover:bg-blue-600
                             [&::-webkit-slider-thumb]:hover:scale-110
                             [&::-webkit-slider-thumb]:transition-all
                             [&::-moz-range-thumb]:w-4
                             [&::-moz-range-thumb]:h-4
                             [&::-moz-range-thumb]:bg-blue-500
                             [&::-moz-range-thumb]:rounded-full
                             [&::-moz-range-thumb]:cursor-grab
                             [&::-moz-range-thumb]:border-none
                             [&::-moz-range-thumb]:shadow-md"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(playbackMinute / (maxHours * 60)) * 100}%, #e5e7eb ${(playbackMinute / (maxHours * 60)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                {/* Hover preview - shows time at hover position */}
                <div className="absolute -top-8 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div
                    className="absolute bg-gray-800 text-white text-xs px-2 py-1 rounded transform -translate-x-1/2"
                    style={{ left: `${(playbackMinute / (maxHours * 60)) * 100}%` }}
                  >
                    {formatTime(playbackMinute)}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-500 w-16 tabular-nums">
                {formatTime(maxHours * 60)}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200" />

            {/* Current state display */}
            {currentPos && (
              <div className="flex items-center gap-3 text-sm">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentPos.state === 'fleeing' ? 'bg-red-100 text-red-700' :
                  currentPos.state === 'hiding' ? 'bg-gray-200 text-gray-700' :
                  currentPos.state === 'traveling' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentPos.state.charAt(0).toUpperCase() + currentPos.state.slice(1)}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="text-red-500 font-medium">{(currentPos.fear * 100).toFixed(0)}%</span> fear
                </div>
                <div className="text-xs text-gray-500">
                  <span className="text-orange-500 font-medium">{(currentPos.hunger * 100).toFixed(0)}%</span> hunger
                </div>
              </div>
            )}
          </div>

          {/* Keyboard shortcuts hint - collapsible */}
          <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-center gap-4">
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Space</kbd> Play/Pause</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">←/→</kbd> ±1 hour</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Shift+←/→</kbd> ±1 day</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">↑/↓</kbd> Speed</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">R</kbd> Reset</span>
          </div>
        </div>
      )}

      {/* Outcome Animation Overlay */}
      {result?.type === 'single' && result?.result?.outcome && (() => {
        const outcome = result.result.outcome;
        const timeToOutcome = result.result.timeToOutcomeHours;
        const currentHour = playbackMinute / 60;

        // Show outcome when playback reaches the time
        if (timeToOutcome && currentHour >= timeToOutcome - 0.5) {
          const isPositive = outcome.includes('CAPTURED') || outcome.includes('FOUND') ||
                            outcome === 'SELF_RETURN' || outcome === 'SHELTER';
          const isNegative = outcome === 'DECEASED' || outcome.includes('DEATH');

          return (
            <div className={`absolute inset-0 z-[2000] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
              isPositive ? 'bg-green-500/20' : isNegative ? 'bg-red-500/20' : 'bg-gray-500/20'
            }`}>
              <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center transform animate-bounce pointer-events-auto ${
                isPositive ? 'border-4 border-green-500' : isNegative ? 'border-4 border-red-500' : 'border-4 border-gray-500'
              }`}>
                <div className="text-6xl mb-4">
                  {isPositive ? '🎉' : isNegative ? '😢' : '⏰'}
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {isPositive ? 'Pet Found!' : isNegative ? 'Pet Lost' : 'Simulation Complete'}
                </h2>
                <p className="text-gray-600 mb-4">
                  {result.result.outcomeDescription}
                </p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    <span className="text-gray-500">Time:</span>{' '}
                    <span className="font-semibold">
                      {Math.floor(timeToOutcome / 24)}d {Math.round(timeToOutcome % 24)}h
                    </span>
                  </div>
                  <div className="bg-gray-100 px-3 py-2 rounded-lg">
                    <span className="text-gray-500">Max Distance:</span>{' '}
                    <span className="font-semibold">
                      {result.result.maxDistanceFromHomeM >= 1000
                        ? `${(result.result.maxDistanceFromHomeM / 1000).toFixed(1)} km`
                        : `${result.result.maxDistanceFromHomeM} m`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPlaybackMinute(0)}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors pointer-events-auto"
                >
                  Replay
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
