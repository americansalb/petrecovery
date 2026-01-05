'use client';

/**
 * Monte Carlo Simulation Page with Map Visualization
 * Based on BEHAVIORAL_PROFILES.md research
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DOG_TEMPERAMENTS, CAT_TEMPERAMENTS } from '@/app/lib/behavioral-simulation';
import { Map, Play, Pause, RotateCcw, BarChart3, Loader2 } from 'lucide-react';

// Dynamically import map to avoid SSR issues with Leaflet
const SimulationMap = dynamic(
  () => import('./components/SimulationMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center min-h-[400px]">
        <Map className="w-8 h-8 text-gray-400" />
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

export default function SimulatePage() {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [temperament, setTemperament] = useState('C');
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [maxHours, setMaxHours] = useState(72);
  const [numSearchers, setNumSearchers] = useState(3);
  const [batchSize, setBatchSize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMinute, setPlaybackMinute] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const temperaments = species === 'dog' ? DOG_TEMPERAMENTS : CAT_TEMPERAMENTS;

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPlaybackMinute(0);
    setIsPlaying(false);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          temperament,
          latitude,
          longitude,
          maxHours,
          numSearchers,
          batchSize: batchSize > 1 ? batchSize : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  // Playback controls
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

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
    }, 50); // 50ms = 20fps

    return () => clearInterval(interval);
  }, [isPlaying, result?.path, maxHours, playbackSpeed]);

  // Get current pet position for playback
  const getCurrentPosition = () => {
    if (!result?.path || result.path.length === 0) return null;
    const hourToFind = playbackMinute / 60;
    const point = result.path.find((p: PathPoint) => p.hour >= hourToFind) || result.path[result.path.length - 1];
    return point;
  };

  // Get current searcher positions for playback
  const getSearcherPositions = () => {
    if (!result?.searcherPaths || result.searcherPaths.length === 0) return [];
    const hourToFind = playbackMinute / 60;
    return result.searcherPaths.map((path: PathPoint[]) => {
      if (path.length === 0) return null;
      const point = path.find((p: PathPoint) => p.hour >= hourToFind) || path[path.length - 1];
      return point;
    }).filter(Boolean) as PathPoint[];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Lost Pet Monte Carlo Simulation
        </h1>
        <p className="text-sm text-gray-600">
          Research-backed behavioral profiles (Huang 2018, Kremer 2021, Albrecht)
        </p>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Left Panel - Config */}
        <div className="lg:w-80 bg-white border-r p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Configuration</h2>

          {/* Species */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Species
            </label>
            <select
              value={species}
              onChange={(e) => {
                setSpecies(e.target.value as 'dog' | 'cat');
                setTemperament(e.target.value === 'dog' ? 'C' : 'CAU');
              }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="dog">🐕 Dog</option>
              <option value="cat">🐈 Cat</option>
            </select>
          </div>

          {/* Temperament */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperament
            </label>
            <select
              value={temperament}
              onChange={(e) => setTemperament(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {Object.entries(temperaments).map(([code, params]) => (
                <option key={code} value={code}>
                  {code} - {params.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {temperaments[temperament as keyof typeof temperaments]?.description}
            </p>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>

          {/* Simulation params */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max Hours
              </label>
              <input
                type="number"
                value={maxHours}
                onChange={(e) => setMaxHours(parseInt(e.target.value))}
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Searchers
              </label>
              <input
                type="number"
                value={numSearchers}
                onChange={(e) => setNumSearchers(parseInt(e.target.value))}
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>

          {/* Batch size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Size
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              min={1}
              max={1000}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              1 = single simulation, 100+ = Monte Carlo
            </p>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Simulation
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Main Area - Map */}
        <div className="flex-1 flex flex-col">
          {/* Map */}
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <SimulationMap
              center={{ lat: latitude, lng: longitude }}
              path={result?.path || []}
              currentPosition={getCurrentPosition()}
              searcherPositions={getSearcherPositions()}
              playbackMinute={playbackMinute}
              onLocationSelect={handleLocationSelect}
              species={species}
            />
          </div>

          {/* Playback Controls */}
          {result?.path && result.path.length > 0 && (
            <div className="bg-white border-t p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlayback}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={resetPlayback}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                {/* Speed control */}
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                </select>

                <input
                  type="range"
                  min={0}
                  max={maxHours * 60}
                  value={playbackMinute}
                  onChange={(e) => setPlaybackMinute(parseInt(e.target.value))}
                  className="flex-1"
                />

                <span className="text-sm font-mono w-20 text-right">
                  {Math.floor(playbackMinute / 60)}h {playbackMinute % 60}m
                </span>
              </div>

              {/* Current state info */}
              {getCurrentPosition() && (
                <div className="mt-2 text-sm text-gray-600 flex gap-4">
                  <span>State: <b>{getCurrentPosition()?.state}</b></span>
                  <span>Fear: <b>{(getCurrentPosition()?.fear * 100).toFixed(0)}%</b></span>
                  <span>Hunger: <b>{(getCurrentPosition()?.hunger * 100).toFixed(0)}%</b></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="lg:w-80 bg-white border-l p-4">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Results
          </h2>

          {!result && !loading && (
            <p className="text-gray-500 text-sm">
              Run a simulation to see results
            </p>
          )}

          {result && (
            <div className="space-y-4">
              {/* Profile info */}
              <div className="text-sm">
                <span className="font-medium">{result.profile.temperamentName}</span>
                {' '}
                <span className="text-gray-500">{result.profile.species}</span>
              </div>

              {result.type === 'batch' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {result.result.successRate}%
                      </div>
                      <div className="text-xs text-green-600">Recovery</div>
                    </div>
                    <div className="bg-blue-50 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {result.result.medianTimeToFindHours || 'N/A'}h
                      </div>
                      <div className="text-xs text-blue-600">Median Time</div>
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Captured:</span>
                      <span className="font-medium">{result.result.outcomes.captured}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Self Return:</span>
                      <span className="font-medium">{result.result.outcomes.selfReturn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Timeout:</span>
                      <span className="font-medium">{result.result.outcomes.timeout}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deceased:</span>
                      <span className="font-medium">{result.result.outcomes.deceased}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`rounded p-3 ${
                    result.result.outcome === 'captured' || result.result.outcome === 'self_return'
                      ? 'bg-green-50'
                      : 'bg-red-50'
                  }`}>
                    <div className="font-bold">
                      {result.result.outcomeDescription}
                    </div>
                    {result.result.timeToOutcomeHours && (
                      <div className="text-sm text-gray-600">
                        at {result.result.timeToOutcomeHours.toFixed(1)} hours
                      </div>
                    )}
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Distance:</span>
                      <span className="font-medium">{result.result.maxDistanceFromHomeM}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Distance:</span>
                      <span className="font-medium">{result.result.petDistanceM}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Fear:</span>
                      <span className="font-medium">{(result.result.stats.avgFear * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
