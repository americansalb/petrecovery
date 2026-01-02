'use client';

/**
 * Lost Pet Simulator - Monte Carlo Simulation Tool
 *
 * This standalone page allows users to:
 * 1. Configure simulation parameters (pet type, terrain, searchers)
 * 2. Run single or batch simulations
 * 3. View animated playback on a map
 * 4. Analyze aggregate statistics
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SimulatorConfig from './components/SimulatorConfig';
import SimulationList from './components/SimulationList';
import BatchResults from './components/BatchResults';
import PlaybackControls from './components/PlaybackControls';
import {
  Play, Pause, RotateCcw, BarChart3, Settings2,
  Map, List, FlaskConical, Info
} from 'lucide-react';

// Dynamically import map to avoid SSR issues with Leaflet
const SimulatorMap = dynamic(
  () => import('./components/SimulatorMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
        <Map className="w-8 h-8 text-gray-400" />
      </div>
    )
  }
);

export default function SimulatorPage() {
  // Configuration state
  const [config, setConfig] = useState({
    petSpecies: 'DOG',
    petSize: 'MEDIUM',
    petPersonality: 'NEUTRAL',
    isIndoorPet: false,
    hasMicrochip: false,
    hasCollar: true,
    initialState: 'FLEEING',
    centerLatitude: 41.8781,  // Default: Chicago
    centerLongitude: -87.6298,
    terrainType: 'SUBURBAN',
    searchRadiusMiles: 2.0,
    searcherCount: 5,
    searchStrategy: 'GRID',
    searcherSpeedMph: 3.0,
    maxSimulationHours: 72,
    timeStepMinutes: 5,
    startHourOfDay: 8,
  });

  // Simulation state
  const [simulations, setSimulations] = useState([]);
  const [selectedSimulation, setSelectedSimulation] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);

  // Playback state
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentMinute: 0,
    speed: 1,
    petPosition: null,
    searcherPositions: [],
    events: [],
  });

  // UI state
  const [activeTab, setActiveTab] = useState('config'); // config, results, analytics
  const [showInfo, setShowInfo] = useState(false);

  // Run a single simulation
  const runSingleSimulation = useCallback(async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, mode: 'single' }),
      });

      if (!response.ok) throw new Error('Simulation failed');

      const result = await response.json();
      setSimulations(prev => [result.simulation, ...prev]);
      setSelectedSimulation(result.simulation);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsRunning(false);
    }
  }, [config]);

  // Run a batch of simulations
  const runBatchSimulation = useCallback(async (batchSize = 100) => {
    setIsRunning(true);
    setBatchProgress({ completed: 0, total: batchSize });

    try {
      const response = await fetch('/api/simulator/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, batchSize }),
      });

      if (!response.ok) throw new Error('Batch simulation failed');

      const result = await response.json();
      setSelectedBatch(result.batch);
      setActiveTab('analytics');
    } catch (error) {
      console.error('Batch simulation error:', error);
    } finally {
      setIsRunning(false);
      setBatchProgress(null);
    }
  }, [config]);

  // Handle location selection from map
  const handleLocationSelect = useCallback((lat, lng) => {
    setConfig(prev => ({
      ...prev,
      centerLatitude: lat,
      centerLongitude: lng,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lost Pet Simulator</h1>
              <p className="text-sm text-gray-500">Monte Carlo prediction engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      {showInfo && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-indigo-800">
              This simulator uses Monte Carlo methods to predict where a lost pet is likely to be found.
              Configure pet characteristics, terrain, and search parameters, then run simulations to see
              probability distributions and optimal search strategies.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-140px)]">

          {/* Left Panel - Config & Results */}
          <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1">
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'config'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Configure
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'results'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4" />
                Results
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
              {activeTab === 'config' && (
                <SimulatorConfig
                  config={config}
                  onChange={setConfig}
                  onRunSingle={runSingleSimulation}
                  onRunBatch={runBatchSimulation}
                  isRunning={isRunning}
                  batchProgress={batchProgress}
                />
              )}

              {activeTab === 'results' && (
                <SimulationList
                  simulations={simulations}
                  selectedId={selectedSimulation?.id}
                  onSelect={setSelectedSimulation}
                />
              )}

              {activeTab === 'analytics' && (
                <BatchResults
                  batch={selectedBatch}
                />
              )}
            </div>
          </div>

          {/* Right Panel - Map & Playback */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Map */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden relative">
              <SimulatorMap
                config={config}
                simulation={selectedSimulation}
                playbackState={playbackState}
                onLocationSelect={handleLocationSelect}
              />

              {/* Map Legend */}
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg border border-gray-200 p-3 text-xs">
                <div className="font-medium text-gray-700 mb-2">Probability Zones</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500"></div>
                    <span>HIGH (65-75%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500"></div>
                    <span>MEDIUM (15-25%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500"></div>
                    <span>LOW (5-10%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-500/30 border border-gray-500"></div>
                    <span>EXTENDED (&lt;5%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            {selectedSimulation && (
              <PlaybackControls
                simulation={selectedSimulation}
                playbackState={playbackState}
                onPlaybackChange={setPlaybackState}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
