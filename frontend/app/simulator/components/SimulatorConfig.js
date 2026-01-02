'use client';

/**
 * SimulatorConfig - Configuration panel for simulation parameters
 *
 * Species-specific configurations for realistic simulations
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dog, Cat, Bird, Rabbit,
  Home, Building2, Trees,
  Users, Target, Shuffle, TrendingUp,
  Play, Loader2, Zap, ChevronDown, Info
} from 'lucide-react';

// Species-specific configurations
const SPECIES_CONFIG = {
  DOG: {
    label: 'Dog',
    icon: Dog,
    sizes: [
      { value: 'TINY', label: 'Toy', desc: 'Chihuahua, Yorkie (< 10 lbs)', weight: '< 10 lbs' },
      { value: 'SMALL', label: 'Small', desc: 'Beagle, Corgi (10-25 lbs)', weight: '10-25 lbs' },
      { value: 'MEDIUM', label: 'Medium', desc: 'Border Collie, Bulldog (25-60 lbs)', weight: '25-60 lbs' },
      { value: 'LARGE', label: 'Large', desc: 'Lab, Golden, German Shepherd (60-90 lbs)', weight: '60-90 lbs' },
      { value: 'GIANT', label: 'Giant', desc: 'Great Dane, Mastiff (> 90 lbs)', weight: '> 90 lbs' },
    ],
    defaultSize: 'MEDIUM',
    personalities: [
      { value: 'FRIENDLY', label: 'Friendly', desc: 'Approaches strangers, social' },
      { value: 'NEUTRAL', label: 'Neutral', desc: 'Normal behavior' },
      { value: 'SHY', label: 'Shy/Fearful', desc: 'Runs from people' },
    ],
    initialStates: [
      { value: 'FLEEING', label: 'Panicked', desc: 'Running scared, bolted from something' },
      { value: 'WANDERING', label: 'Wandering', desc: 'Got loose, exploring' },
      { value: 'HIDING', label: 'Hiding', desc: 'Scared, found a hiding spot' },
    ],
    defaultState: 'WANDERING',
    showIndoor: false,
    showCollar: true,
    typicalBehavior: 'Dogs often try to return home. Friendly dogs may approach strangers and get "rescued."',
  },
  CAT: {
    label: 'Cat',
    icon: Cat,
    sizes: [
      { value: 'TINY', label: 'Kitten', desc: 'Under 6 months (< 5 lbs)', weight: '< 5 lbs' },
      { value: 'SMALL', label: 'Small', desc: 'Siamese, small breeds (5-8 lbs)', weight: '5-8 lbs' },
      { value: 'MEDIUM', label: 'Medium', desc: 'Average cat (8-12 lbs)', weight: '8-12 lbs' },
      { value: 'LARGE', label: 'Large', desc: 'Maine Coon, large breeds (12-20 lbs)', weight: '12-20 lbs' },
    ],
    defaultSize: 'MEDIUM',
    personalities: [
      { value: 'FRIENDLY', label: 'Confident', desc: 'Outdoor cat, comfortable outside' },
      { value: 'NEUTRAL', label: 'Cautious', desc: 'Indoor/outdoor, careful' },
      { value: 'SHY', label: 'Fearful', desc: 'Indoor only, very scared' },
    ],
    initialStates: [
      { value: 'HIDING', label: 'Hiding', desc: 'Most common - cats hide close to home' },
      { value: 'TERRITORIAL', label: 'Territorial', desc: 'Outdoor cat in expanded territory' },
      { value: 'FLEEING', label: 'Panicked', desc: 'Chased or startled, ran far' },
    ],
    defaultState: 'HIDING',
    showIndoor: true,
    showCollar: true,
    typicalBehavior: 'Indoor cats typically hide within 3-5 houses. Outdoor cats expand their territory. Most cats are found very close to home.',
  },
  BIRD: {
    label: 'Bird',
    icon: Bird,
    sizes: [
      { value: 'TINY', label: 'Small', desc: 'Budgie, Finch, Canary', weight: '< 1 oz' },
      { value: 'SMALL', label: 'Medium', desc: 'Cockatiel, Lovebird, Conure', weight: '2-5 oz' },
      { value: 'MEDIUM', label: 'Large', desc: 'African Grey, Amazon', weight: '0.5-1.5 lbs' },
      { value: 'LARGE', label: 'Extra Large', desc: 'Macaw, Cockatoo', weight: '1.5-3.5 lbs' },
    ],
    defaultSize: 'SMALL',
    personalities: [
      { value: 'FRIENDLY', label: 'Tame', desc: 'Hand-raised, comes to people' },
      { value: 'NEUTRAL', label: 'Semi-tame', desc: 'May approach familiar voices' },
      { value: 'SHY', label: 'Wild/Scared', desc: 'Avoids all contact' },
    ],
    initialStates: [
      { value: 'FLEEING', label: 'In Flight', desc: 'Flying, looking for place to land' },
      { value: 'TERRITORIAL', label: 'Perched', desc: 'Found a spot, staying in area' },
      { value: 'WANDERING', label: 'Exploring', desc: 'Moving between locations' },
    ],
    defaultState: 'FLEEING',
    showIndoor: false,
    showCollar: false,
    typicalBehavior: 'Birds can travel far quickly. They often land in trees and may respond to familiar voices or other birds.',
  },
  OTHER: {
    label: 'Other Pet',
    icon: Rabbit,
    sizes: [
      { value: 'TINY', label: 'Tiny', desc: 'Hamster, gerbil, small reptile', weight: '< 1 lb' },
      { value: 'SMALL', label: 'Small', desc: 'Guinea pig, rabbit, ferret', weight: '1-5 lbs' },
      { value: 'MEDIUM', label: 'Medium', desc: 'Large rabbit, small pig', weight: '5-20 lbs' },
    ],
    defaultSize: 'SMALL',
    personalities: [
      { value: 'FRIENDLY', label: 'Tame', desc: 'Comfortable with handling' },
      { value: 'NEUTRAL', label: 'Neutral', desc: 'Normal behavior' },
      { value: 'SHY', label: 'Skittish', desc: 'Easily frightened' },
    ],
    initialStates: [
      { value: 'HIDING', label: 'Hiding', desc: 'Finding cover immediately' },
      { value: 'WANDERING', label: 'Foraging', desc: 'Looking for food' },
      { value: 'FLEEING', label: 'Fleeing', desc: 'Running from threat' },
    ],
    defaultState: 'HIDING',
    showIndoor: false,
    showCollar: false,
    typicalBehavior: 'Small pets typically hide in dense vegetation or under structures. They stay close to where they escaped.',
  },
};

const TERRAIN_OPTIONS = [
  { value: 'URBAN', label: 'Urban', icon: Building2, desc: 'Dense city, apartments' },
  { value: 'SUBURBAN', label: 'Suburban', icon: Home, desc: 'Houses, yards, neighborhoods' },
  { value: 'RURAL', label: 'Rural', icon: Trees, desc: 'Farms, open land, woods' },
];

const STRATEGY_OPTIONS = [
  { value: 'GRID', label: 'Grid Search', desc: 'Systematic area coverage' },
  { value: 'SPIRAL', label: 'Spiral Out', desc: 'Expanding circles from center' },
  { value: 'PROBABILITY', label: 'Smart Search', desc: 'Focus on likely zones first' },
  { value: 'RANDOM', label: 'Uncoordinated', desc: 'Random volunteer search' },
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

  // Get current species config
  const speciesConfig = SPECIES_CONFIG[config.petSpecies] || SPECIES_CONFIG.DOG;

  // Update config helper
  const updateConfig = (key, value) => {
    onChange(prev => ({ ...prev, [key]: value }));
  };

  // When species changes, reset to appropriate defaults
  const handleSpeciesChange = (newSpecies) => {
    const newConfig = SPECIES_CONFIG[newSpecies];
    onChange(prev => ({
      ...prev,
      petSpecies: newSpecies,
      petSize: newConfig.defaultSize,
      initialState: newConfig.defaultState,
      isIndoorPet: newSpecies === 'CAT' ? prev.isIndoorPet : false,
      hasCollar: newConfig.showCollar ? prev.hasCollar : false,
    }));
  };

  // Calculate recommended search radius based on species/size
  const recommendedRadius = useMemo(() => {
    const baseRadii = {
      DOG: { TINY: 0.5, SMALL: 1, MEDIUM: 1.5, LARGE: 2, GIANT: 3 },
      CAT: { TINY: 0.1, SMALL: 0.15, MEDIUM: 0.2, LARGE: 0.3 },
      BIRD: { TINY: 1, SMALL: 1.5, MEDIUM: 2, LARGE: 3 },
      OTHER: { TINY: 0.05, SMALL: 0.1, MEDIUM: 0.2 },
    };
    return baseRadii[config.petSpecies]?.[config.petSize] || 1;
  }, [config.petSpecies, config.petSize]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 space-y-5">
        {/* Species Selection */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Pet Type
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(SPECIES_CONFIG).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                onClick={() => handleSpeciesChange(key)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                  config.petSpecies === key
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Species behavior hint */}
          <div className="mt-3 p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {speciesConfig.typicalBehavior}
            </p>
          </div>
        </section>

        {/* Size - Species Specific */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Size</h3>
          <div className="grid grid-cols-2 gap-2">
            {speciesConfig.sizes.map(({ value, label, desc, weight }) => (
              <button
                key={value}
                onClick={() => updateConfig('petSize', value)}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  config.petSize === value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] text-gray-500">{desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Personality - Species Specific */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Temperament</h3>
          <div className="grid grid-cols-3 gap-2">
            {speciesConfig.personalities.map(({ value, label, desc }) => (
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
                <div className="text-[10px] text-gray-500 line-clamp-1">{desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Initial State - Species Specific */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">How They Got Lost</h3>
          <select
            value={config.initialState}
            onChange={(e) => updateConfig('initialState', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {speciesConfig.initialStates.map(({ value, label, desc }) => (
              <option key={value} value={value}>{label} - {desc}</option>
            ))}
          </select>
        </section>

        {/* Toggles - Show only relevant ones */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Additional Info</h3>
          <div className="flex flex-wrap gap-2">
            {speciesConfig.showIndoor && (
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                config.isIndoorPet ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={config.isIndoorPet}
                  onChange={(e) => updateConfig('isIndoorPet', e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="text-xs font-medium">Indoor Only</span>
              </label>
            )}
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              config.hasMicrochip ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={config.hasMicrochip}
                onChange={(e) => updateConfig('hasMicrochip', e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span className="text-xs font-medium">Microchipped</span>
            </label>
            {speciesConfig.showCollar && (
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                config.hasCollar ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
              }`}>
                <input
                  type="checkbox"
                  checked={config.hasCollar}
                  onChange={(e) => updateConfig('hasCollar', e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="text-xs font-medium">Has Collar/Tags</span>
              </label>
            )}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Environment */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Environment</h3>
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
              </button>
            ))}
          </div>
        </section>

        {/* Search Radius */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Search Radius: {config.searchRadiusMiles} mi
            </h3>
            <span className="text-[10px] text-gray-400">
              Recommended: {recommendedRadius} mi
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={config.searchRadiusMiles}
            onChange={(e) => updateConfig('searchRadiusMiles', parseFloat(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <p className="text-[10px] text-gray-500 mt-1 italic">
            Click on map to set last seen location
          </p>
        </section>

        {/* Search Team */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            <Users className="w-4 h-4 inline mr-1" />
            Search Team: {config.searcherCount} volunteers
          </h3>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={config.searcherCount}
            onChange={(e) => updateConfig('searcherCount', parseInt(e.target.value))}
            className="w-full accent-indigo-600 mb-3"
          />

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
        </section>

        {/* Advanced Settings */}
        <section>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Simulation Duration: {config.maxSimulationHours}h ({Math.round(config.maxSimulationHours / 24)}d)
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
                  Time of Day Lost: {config.startHourOfDay}:00
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
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>Midnight</span>
                  <span>Noon</span>
                  <span>11 PM</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Simulation Detail
                </label>
                <select
                  value={config.timeStepMinutes}
                  onChange={(e) => updateConfig('timeStepMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                >
                  <option value={1}>High detail (1 min steps, slower)</option>
                  <option value={5}>Standard (5 min steps)</option>
                  <option value={15}>Fast (15 min steps)</option>
                </select>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2 bg-gray-50">
        <button
          onClick={onRunSingle}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isRunning && !batchProgress ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Simulation...
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
            max="1000"
            step="10"
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(1000, Math.max(10, parseInt(e.target.value) || 100)))}
            className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center"
          />
          <button
            onClick={() => onRunBatch(batchSize)}
            disabled={isRunning}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {batchProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {batchProgress.completed}/{batchProgress.total}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run {batchSize}x Batch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
