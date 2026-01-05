'use client';

/**
 * Monte Carlo Simulation Page with Map Visualization
 * Desktop-first design with full-screen map
 * Based on BEHAVIORAL_PROFILES.md research
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DOG_TEMPERAMENTS, CAT_TEMPERAMENTS } from '@/app/lib/behavioral-simulation';
import {
  Map, Play, Pause, RotateCcw, BarChart3, Loader2,
  Settings, ChevronLeft, ChevronRight, X
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
  sampleSimulations?: any[];
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

  // Simulation params
  const [maxHours, setMaxHours] = useState(72);
  const [numSearchers, setNumSearchers] = useState(3);
  const [searchStartDelay, setSearchStartDelay] = useState(2);
  const [batchSize, setBatchSize] = useState(1);

  // UI state
  const [configOpen, setConfigOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSimIndex, setSelectedSimIndex] = useState<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMinute, setPlaybackMinute] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);

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

      setResult(data);
      setResultsOpen(true);

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

  // Playback controls
  const togglePlayback = () => setIsPlaying(!isPlaying);
  const resetPlayback = () => {
    setPlaybackMinute(0);
    setIsPlaying(false);
  };

  // Playback animation effect
  useEffect(() => {
    if (!isPlaying || !result?.path) return;

    const maxMinute = maxHours * 60;
    const interval = setInterval(() => {
      setPlaybackMinute((prev) => {
        const next = prev + playbackSpeed;
        if (next >= maxMinute) {
          setIsPlaying(false);
          return maxMinute;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, result?.path, maxHours, playbackSpeed]);

  // Get current positions for playback
  const getCurrentPosition = () => {
    if (!result?.path || result.path.length === 0) return null;
    const hourToFind = playbackMinute / 60;
    return result.path.find((p: PathPoint) => p.hour >= hourToFind) || result.path[result.path.length - 1];
  };

  const getSearcherPositions = () => {
    if (!result?.searcherPaths || result.searcherPaths.length === 0) return [];
    const hourToFind = playbackMinute / 60;
    return result.searcherPaths.map((path: PathPoint[]) => {
      if (path.length === 0) return null;
      return path.find((p: PathPoint) => p.hour >= hourToFind) || path[path.length - 1];
    }).filter(Boolean) as PathPoint[];
  };

  const currentPos = getCurrentPosition();

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
                  <label className="block text-xs text-gray-500 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    value={maxHours}
                    onChange={(e) => setMaxHours(parseInt(e.target.value) || 72)}
                    min={1}
                    max={720}
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

                {/* Sample simulations list */}
                {result.sampleSimulations && result.sampleSimulations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Sample Simulations (click to view)
                    </h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {result.sampleSimulations.map((sim: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedSimIndex(idx);
                            // Load this simulation's path for viewing
                            if (sim.petPath) {
                              setResult({
                                ...result,
                                path: sim.petPath,
                                searcherPaths: sim.searcherPaths,
                              });
                              setPlaybackMinute(0);
                              setIsPlaying(true);
                            }
                          }}
                          className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 transition-colors ${
                            selectedSimIndex === idx ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                        >
                          <span className={`font-medium ${
                            sim.outcome === 'captured' || sim.outcome === 'self_return'
                              ? 'text-green-600'
                              : sim.outcome === 'deceased'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                          }`}>
                            #{idx + 1}
                          </span>
                          {' - '}
                          {sim.outcomeDescription}
                          {sim.timeToOutcomeHours && (
                            <span className="text-gray-400 ml-1">
                              @ {sim.timeToOutcomeHours.toFixed(1)}h
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
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
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-xl z-[1000] p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause/Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className={`p-3 rounded-full transition-colors ${
                  isPlaying ? 'bg-red-100 hover:bg-red-200' : 'bg-green-100 hover:bg-green-200'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={resetPlayback}
                className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Speed control */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
              <option value="20">20x</option>
            </select>

            {/* Timeline slider */}
            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={maxHours * 60}
                value={playbackMinute}
                onChange={(e) => {
                  setPlaybackMinute(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-mono w-24 text-right bg-gray-100 px-3 py-1 rounded-lg">
                {Math.floor(playbackMinute / 60)}h {Math.round(playbackMinute % 60)}m
              </span>
            </div>

            {/* Current state display */}
            {currentPos && (
              <div className="flex items-center gap-4 text-sm border-l pl-4 ml-2">
                <div className={`px-3 py-1 rounded-full font-medium ${
                  currentPos.state === 'fleeing' ? 'bg-red-100 text-red-700' :
                  currentPos.state === 'hiding' ? 'bg-gray-100 text-gray-700' :
                  currentPos.state === 'traveling' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentPos.state.charAt(0).toUpperCase() + currentPos.state.slice(1)}
                </div>
                <div className="text-gray-600">
                  Fear: <span className="font-medium">{(currentPos.fear * 100).toFixed(0)}%</span>
                </div>
                <div className="text-gray-600">
                  Hunger: <span className="font-medium">{(currentPos.hunger * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
