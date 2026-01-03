'use client';

/**
 * SensitivityPanel - Compare simulation with single variable changes
 *
 * Implements One-at-a-Time (OAT) sensitivity analysis:
 * - Uses the same random seed as the selected simulation
 * - Changes only one variable at a time
 * - Shows how that change affects the outcome
 */

import { useState, useCallback } from 'react';
import {
  FlaskConical, Play, ArrowRight, ArrowUp, ArrowDown,
  Minus, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';

// Variables that can be tested for sensitivity
const TESTABLE_VARIABLES = [
  {
    path: 'searcherCount',
    label: 'Number of Searchers',
    type: 'number',
    options: [1, 3, 5, 10, 15, 20],
  },
  {
    path: 'petPersonality',
    label: 'Pet Personality',
    type: 'select',
    options: ['FRIENDLY', 'NEUTRAL', 'SHY'],
  },
  {
    path: 'terrainType',
    label: 'Terrain Type',
    type: 'select',
    options: ['SUBURBAN', 'URBAN', 'RURAL'],
  },
  {
    path: 'hasMicrochip',
    label: 'Has Microchip',
    type: 'boolean',
    options: [true, false],
  },
  {
    path: 'hasCollar',
    label: 'Has Collar/Tag',
    type: 'boolean',
    options: [true, false],
  },
  {
    path: 'maxSimulationHours',
    label: 'Max Simulation Hours',
    type: 'number',
    options: [24, 48, 72, 168],
  },
  {
    path: 'searchStartDelayHours',
    label: 'Search Start Delay (hours)',
    type: 'number',
    options: [0, 1, 2, 4, 8, 12],
  },
  {
    path: 'volunteerRampUpHours',
    label: 'Volunteer Ramp-Up (hours)',
    type: 'number',
    options: [6, 12, 24, 48],
  },
];

function formatValue(value) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

function formatDelta(delta) {
  if (delta == null) return '-';
  if (delta === 0) return '0';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)} min`;
}

function OutcomeChange({ baseline, variation }) {
  const changed = baseline !== variation;

  if (!changed) {
    return (
      <span className="text-gray-500 flex items-center gap-1">
        <Minus className="w-3 h-3" />
        Same outcome
      </span>
    );
  }

  const isImprovement = variation && !variation.startsWith('TIMEOUT');
  const wasSuccess = baseline && !baseline.startsWith('TIMEOUT');

  if (isImprovement && !wasSuccess) {
    return (
      <span className="text-green-600 flex items-center gap-1">
        <ArrowUp className="w-3 h-3" />
        Now found!
      </span>
    );
  }

  if (!isImprovement && wasSuccess) {
    return (
      <span className="text-red-600 flex items-center gap-1">
        <ArrowDown className="w-3 h-3" />
        Now timeout
      </span>
    );
  }

  return (
    <span className="text-orange-600 flex items-center gap-1">
      <ArrowRight className="w-3 h-3" />
      Different mode
    </span>
  );
}

export default function SensitivityPanel({ simulation, config, onClose }) {
  const [selectedVariable, setSelectedVariable] = useState(null);
  const [selectedValue, setSelectedValue] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const runSensitivityTest = useCallback(async () => {
    if (!selectedVariable || selectedValue == null || !simulation) {
      return;
    }

    setIsRunning(true);
    setResults(null);

    try {
      const response = await fetch('/api/simulator/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          seed: simulation.randomSeed,
          variableChanges: [{
            path: selectedVariable.path,
            value: selectedValue,
          }],
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data);
    } catch (error) {
      console.error('Sensitivity test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [selectedVariable, selectedValue, simulation, config]);

  const currentValue = selectedVariable
    ? config[selectedVariable.path]
    : null;

  return (
    <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 bg-indigo-50 flex items-center justify-between hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">
            Sensitivity Analysis
          </span>
          <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
            Seed #{simulation.randomSeed}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-indigo-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-indigo-600" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Explanation */}
          <p className="text-xs text-gray-500">
            Test how changing a single variable affects this simulation's outcome.
            The same random seed ensures all other factors remain identical.
          </p>

          {/* Variable Selection */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Select Variable to Change
            </label>
            <select
              value={selectedVariable?.path || ''}
              onChange={(e) => {
                const variable = TESTABLE_VARIABLES.find(v => v.path === e.target.value);
                setSelectedVariable(variable);
                setSelectedValue(null);
                setResults(null);
              }}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Choose a variable...</option>
              {TESTABLE_VARIABLES.map((v) => (
                <option key={v.path} value={v.path}>
                  {v.label} (current: {formatValue(config[v.path])})
                </option>
              ))}
            </select>
          </div>

          {/* Value Selection */}
          {selectedVariable && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Change to
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedVariable.options.map((option) => (
                  <button
                    key={String(option)}
                    onClick={() => {
                      setSelectedValue(option);
                      setResults(null);
                    }}
                    disabled={option === currentValue}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      option === selectedValue
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : option === currentValue
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                    }`}
                  >
                    {formatValue(option)}
                    {option === currentValue && ' (current)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Run Button */}
          {selectedVariable && selectedValue != null && (
            <button
              onClick={runSensitivityTest}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running comparison...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Compare Outcomes
                </>
              )}
            </button>
          )}

          {/* Results */}
          {results && results.variations?.[0] && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Comparison Results
              </h4>

              {/* Change Description */}
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-medium">{selectedVariable.label}:</span>
                  <span className="text-gray-500">
                    {formatValue(results.variations[0].change.oldValue)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="text-indigo-600 font-medium">
                    {formatValue(results.variations[0].change.newValue)}
                  </span>
                </div>
              </div>

              {/* Outcome Comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Baseline */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Baseline</div>
                  <div className="flex items-center gap-2">
                    {results.baseline.outcome?.startsWith('TIMEOUT') ? (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium">
                      {results.baseline.outcome?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {results.baseline.foundAtMinute && (
                    <div className="text-xs text-gray-500 mt-1">
                      Found at {Math.round(results.baseline.foundAtMinute)}min
                    </div>
                  )}
                </div>

                {/* Variation */}
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <div className="text-xs text-indigo-600 mb-1">With Change</div>
                  <div className="flex items-center gap-2">
                    {results.variations[0].result.outcome?.startsWith('TIMEOUT') ? (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium">
                      {results.variations[0].result.outcome?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {results.variations[0].result.foundAtMinute && (
                    <div className="text-xs text-indigo-600 mt-1">
                      Found at {Math.round(results.variations[0].result.foundAtMinute)}min
                    </div>
                  )}
                </div>
              </div>

              {/* Impact Summary */}
              <div className="p-3 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Impact</div>
                <div className="flex items-center gap-4 text-sm">
                  <OutcomeChange
                    baseline={results.baseline.outcome}
                    variation={results.variations[0].result.outcome}
                  />
                  {results.variations[0].delta.foundTimeChange != null && (
                    <span className={`${
                      results.variations[0].delta.foundTimeChange < 0
                        ? 'text-green-600'
                        : results.variations[0].delta.foundTimeChange > 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {formatDelta(results.variations[0].delta.foundTimeChange)}
                    </span>
                  )}
                </div>
              </div>

              {/* Note */}
              <p className="text-[10px] text-gray-400 italic">
                {results.note}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
