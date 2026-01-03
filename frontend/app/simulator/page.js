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
import BatchCharts from './components/BatchCharts';
import PlaybackControls from './components/PlaybackControls';
import RecoveryGuidance from './components/RecoveryGuidance';
import {
  Play, Pause, RotateCcw, BarChart3, Settings2,
  Map, List, FlaskConical, Info, LineChart, FileText, Lightbulb
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
    // NEW: Realistic search timing variables
    searchStartDelayHours: 2,      // Delay before search begins (owner realizes pet missing)
    searchHoursStart: 7,           // Volunteers search from 7 AM
    searchHoursEnd: 21,            // Volunteers search until 9 PM
    volunteerRampUpHours: 24,      // Hours to reach full volunteer count
    initialVolunteerPercent: 20,   // Start with 20% of volunteers, ramp up
  });

  // Simulation state
  const [simulations, setSimulations] = useState([]);
  const [batches, setBatches] = useState([]); // Track all batches
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
  const [analyticsSubTab, setAnalyticsSubTab] = useState('charts'); // stats, charts, guidance
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

  // Run a batch of simulations with real-time progress via SSE
  // Each simulation result streams in as it completes, populating the list live
  const runBatchSimulation = useCallback(async (batchSize = 100) => {
    setIsRunning(true);
    setBatchProgress({ completed: 0, total: batchSize, percent: 0, status: 'Starting...' });

    // Create a running batch to accumulate results
    const batchId = `batch_${Date.now()}`;
    const runningBatch = {
      id: batchId,
      status: 'RUNNING',
      totalRuns: batchSize,
      simulations: [],
      createdAt: new Date().toISOString(),
    };

    // Add the running batch immediately so user can see it populate
    setBatches(prev => [runningBatch, ...prev]);
    setSelectedBatch(runningBatch);
    setActiveTab('results');

    // Keep a local reference to accumulated simulations (for efficiency)
    let accumulatedSims = [];

    try {
      const response = await fetch('/api/simulator/batch/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, batchSize }),
      });

      if (!response.ok) throw new Error('Batch simulation failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data: ')) {
              try {
                const data = JSON.parse(dataLine.slice(6));

                if (eventType === 'simulation') {
                  // Add each simulation as it completes
                  accumulatedSims.push(data);

                  // Update state every 10 sims (or every sim for small batches)
                  // This batches React updates for better performance on large runs
                  if (batchSize <= 100 || accumulatedSims.length % 10 === 0) {
                    const currentSims = [...accumulatedSims];
                    setBatches(prev => {
                      const updated = [...prev];
                      const batchIndex = updated.findIndex(b => b.id === batchId);
                      if (batchIndex >= 0) {
                        updated[batchIndex] = {
                          ...updated[batchIndex],
                          simulations: currentSims,
                        };
                      }
                      return updated;
                    });
                  }
                } else if (eventType === 'progress') {
                  setBatchProgress({
                    completed: data.completed,
                    total: data.total,
                    percent: data.percent,
                    successRate: data.successRate,
                    status: `${data.completed}/${data.total} simulations`,
                  });
                  // Update running batch stats
                  setBatches(prev => {
                    const updated = [...prev];
                    const batchIndex = updated.findIndex(b => b.id === batchId);
                    if (batchIndex >= 0) {
                      updated[batchIndex] = {
                        ...updated[batchIndex],
                        successRate: parseFloat(data.successRate),
                        ...(data.outcomes && {
                          foundBySearcherCount: data.outcomes.FOUND_BY_SEARCHER || 0,
                          returnedHomeCount: data.outcomes.RETURNED_HOME || 0,
                          foundViaShelterCount: data.outcomes.FOUND_VIA_SHELTER || 0,
                          foundViaSocialCount: data.outcomes.FOUND_VIA_SOCIAL || 0,
                          foundViaPlatformCount: data.outcomes.FOUND_VIA_PLATFORM || 0,
                          timeoutSearchingCount: data.outcomes.TIMEOUT_SEARCHING || 0,
                          timeoutShelteredCount: data.outcomes.TIMEOUT_SHELTERED || 0,
                        }),
                      };
                      setSelectedBatch(updated[batchIndex]);
                    }
                    return updated;
                  });
                } else if (eventType === 'status') {
                  setBatchProgress(prev => ({ ...prev, status: data.message }));
                } else if (eventType === 'complete') {
                  // Replace running batch with final results, keeping accumulated simulations
                  setBatches(prev => {
                    const updated = [...prev];
                    const batchIndex = updated.findIndex(b => b.id === batchId);
                    if (batchIndex >= 0) {
                      updated[batchIndex] = {
                        ...data.batch,
                        id: batchId,
                        simulations: accumulatedSims,
                      };
                      setSelectedBatch(updated[batchIndex]);
                    }
                    return updated;
                  });
                } else if (eventType === 'error') {
                  console.error('Batch error:', data.error);
                }
              } catch (e) {
                // Ignore parse errors for partial data
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Batch simulation error:', error);
      // Mark batch as failed
      setBatches(prev => {
        const updated = [...prev];
        const batchIndex = updated.findIndex(b => b.id === batchId);
        if (batchIndex >= 0) {
          updated[batchIndex] = {
            ...updated[batchIndex],
            status: 'FAILED',
            simulations: accumulatedSims,
          };
        }
        return updated;
      });
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

      {/* Main Content - Desktop-first layout for research */}
      <div className="mx-auto p-4 xl:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-140px)]">

          {/* Left Panel - Config & Results (wider on desktop) */}
          <div className="xl:col-span-4 2xl:col-span-3 flex flex-col gap-4 overflow-hidden">
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
                  batches={batches}
                  selectedId={selectedSimulation?.id}
                  selectedBatchId={selectedBatch?.id}
                  onSelectSimulation={setSelectedSimulation}
                  onSelectBatch={setSelectedBatch}
                />
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  {/* Analytics Sub-tabs */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setAnalyticsSubTab('charts')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        analyticsSubTab === 'charts'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      Charts
                    </button>
                    <button
                      onClick={() => setAnalyticsSubTab('stats')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        analyticsSubTab === 'stats'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Stats
                    </button>
                    <button
                      onClick={() => setAnalyticsSubTab('guidance')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        analyticsSubTab === 'guidance'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      Guidance
                    </button>
                  </div>

                  {/* Sub-tab Content */}
                  {analyticsSubTab === 'charts' && (
                    <BatchCharts batch={selectedBatch} />
                  )}
                  {analyticsSubTab === 'stats' && (
                    <BatchResults batch={selectedBatch} />
                  )}
                  {analyticsSubTab === 'guidance' && (
                    <RecoveryGuidance config={config} batch={selectedBatch} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Map & Playback (larger on desktop) */}
          <div className="xl:col-span-8 2xl:col-span-9 flex flex-col gap-4">
            {/* Map */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden relative">
              <SimulatorMap
                config={config}
                simulation={selectedSimulation}
                playbackState={playbackState}
                onLocationSelect={handleLocationSelect}
                batch={selectedBatch}
              />

              {/* Map Legend */}
              <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur rounded-lg border border-gray-200 p-3 text-xs shadow-lg">
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
