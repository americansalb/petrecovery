'use client';

/**
 * SimulatorConfig - Configuration panel for simulation parameters
 */

import { useState } from 'react';
import {
  Dog, Cat, Bird, Rabbit,
  Home, Building2, Trees,
  Users, Target, Shuffle, TrendingUp,
  Play, Loader2, Zap
} from 'lucide-react';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: Dog },
  { value: 'CAT', label: 'Cat', icon: Cat },
  { value: 'BIRD', label: 'Bird', icon: Bird },
  { value: 'OTHER', label: 'Other', icon: Rabbit },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', desc: '< 10 lbs' },
  { value: 'SMALL', label: 'Small', desc: '10-25 lbs' },
  { value: 'MEDIUM', label: 'Medium', desc: '25-60 lbs' },
  { value: 'LARGE', label: 'Large', desc: '60-90 lbs' },
  { value: 'GIANT', label: 'Giant', desc: '> 90 lbs' },
];

const PERSONALITY_OPTIONS = [
  { value: 'FRIENDLY', label: 'Friendly', desc: 'Approaches strangers' },
  { value: 'NEUTRAL', label: 'Neutral', desc: 'Normal behavior' },
  { value: 'SHY', label: 'Shy/Scared', desc: 'Avoids people' },
];

const TERRAIN_OPTIONS = [
  { value: 'URBAN', label: 'Urban', icon: Building2, desc: 'Dense city' },
  { value: 'SUBURBAN', label: 'Suburban', icon: Home, desc: 'Residential' },
  { value: 'RURAL', label: 'Rural', icon: Trees, desc: 'Countryside' },
];

const STRATEGY_OPTIONS = [
  { value: 'GRID', label: 'Grid', icon: Target, desc: 'Systematic coverage' },
  { value: 'SPIRAL', label: 'Spiral', icon: Target, desc: 'Expanding from center' },
  { value: 'RANDOM', label: 'Random', icon: Shuffle, desc: 'Uncoordinated' },
  { value: 'PROBABILITY', label: 'Probability', icon: TrendingUp, desc: 'Weighted zones' },
];

const INITIAL_STATE_OPTIONS = [
  { value: 'FLEEING', label: 'Panicked/Fleeing', desc: 'Running scared' },
  { value: 'HIDING', label: 'Hiding', desc: 'Found a hiding spot' },
  { value: 'WANDERING', label: 'Wandering', desc: 'Exploring calmly' },
  { value: 'TERRITORIAL', label: 'Territorial', desc: 'Staying in area' },
];

export default function SimulatorConfig({
  config,
  onChange,
  onRunSingle,
  onRunBatch,
  isRunning,
  batchProgress,
}) {
  const [batchSize, setBatchSize] = useState(100);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateConfig = (key, value) => {
    onChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 space-y-6">
        {/* Pet Configuration */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pet Profile</h3>

          {/* Species */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Species</label>
            <div className="grid grid-cols-4 gap-2">
              {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => updateConfig('petSpecies', value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                    config.petSpecies === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Size</label>
            <select
              value={config.petSize}
              onChange={(e) => updateConfig('petSize', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {SIZE_OPTIONS.map(({ value, label, desc }) => (
                <option key={value} value={value}>{label} ({desc})</option>
              ))}
            </select>
          </div>

          {/* Personality */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Personality</label>
            <div className="grid grid-cols-3 gap-2">
              {PERSONALITY_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => updateConfig('petPersonality', value)}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    config.petPersonality === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[10px] text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-2">
            <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
              config.isIndoorPet ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={config.isIndoorPet}
                onChange={(e) => updateConfig('isIndoorPet', e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span className="text-xs">Indoor</span>
            </label>
            <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
              config.hasMicrochip ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={config.hasMicrochip}
                onChange={(e) => updateConfig('hasMicrochip', e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span className="text-xs">Chipped</span>
            </label>
            <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
              config.hasCollar ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={config.hasCollar}
                onChange={(e) => updateConfig('hasCollar', e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span className="text-xs">Collar</span>
            </label>
          </div>

          {/* Initial State */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Initial Behavior</label>
            <select
              value={config.initialState}
              onChange={(e) => updateConfig('initialState', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {INITIAL_STATE_OPTIONS.map(({ value, label, desc }) => (
                <option key={value} value={value}>{label} - {desc}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Environment */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Environment</h3>

          {/* Terrain */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Terrain Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TERRAIN_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => updateConfig('terrainType', value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                    config.terrainType === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-gray-500">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Radius */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Search Radius: {config.searchRadiusMiles} miles
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={config.searchRadiusMiles}
              onChange={(e) => updateConfig('searchRadiusMiles', parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.5 mi</span>
              <span>5 mi</span>
            </div>
          </div>

          {/* Location Note */}
          <p className="text-xs text-gray-500 italic">
            Click on the map to set the last seen location
          </p>
        </section>

        {/* Search Team */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Search Team</h3>

          {/* Searcher Count */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              <Users className="w-3 h-3 inline mr-1" />
              Searchers: {config.searcherCount}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={config.searcherCount}
              onChange={(e) => updateConfig('searcherCount', parseInt(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Strategy */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Search Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGY_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => updateConfig('searchStrategy', value)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    config.searchStrategy === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[10px] text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Advanced Settings */}
        <section>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Max Simulation Hours: {config.maxSimulationHours}h
                </label>
                <input
                  type="range"
                  min="12"
                  max="168"
                  step="12"
                  value={config.maxSimulationHours}
                  onChange={(e) => updateConfig('maxSimulationHours', parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Time Step: {config.timeStepMinutes} min
                </label>
                <select
                  value={config.timeStepMinutes}
                  onChange={(e) => updateConfig('timeStepMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value={1}>1 minute (detailed)</option>
                  <option value={5}>5 minutes (standard)</option>
                  <option value={15}>15 minutes (fast)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Start Hour of Day: {config.startHourOfDay}:00
                </label>
                <input
                  type="range"
                  min="0"
                  max="23"
                  step="1"
                  value={config.startHourOfDay}
                  onChange={(e) => updateConfig('startHourOfDay', parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Searcher Speed: {config.searcherSpeedMph} mph
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={config.searcherSpeedMph}
                  onChange={(e) => updateConfig('searcherSpeedMph', parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={onRunSingle}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Single Simulation
            </>
          )}
        </button>

        <div className="flex gap-2">
          <input
            type="number"
            min="10"
            max="10000"
            step="10"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={() => onRunBatch(batchSize)}
            disabled={isRunning}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {batchProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {batchProgress.completed}/{batchProgress.total}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Batch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
