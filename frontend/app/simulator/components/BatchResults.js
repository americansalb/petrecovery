'use client';

/**
 * BatchResults - Analytics dashboard for batch simulation results
 *
 * OUTCOME HIERARCHY (Clearer Categories):
 * 1. FOUND or NOT FOUND (binary)
 * 2. If FOUND:
 *    - Self-returned home
 *    - Found by owner/searcher
 *    - Found by stranger (taken to shelter or kept)
 * 3. If NOT FOUND:
 *    - Still searching (location unknown)
 *    - Deceased
 */

import React, { useState } from 'react';
import {
  Search, Home, Building2, Users, Skull,
  Clock, AlertTriangle, TrendingUp, BarChart3, PieChart, Info,
  Download, FileSpreadsheet, Eye
} from 'lucide-react';

// =============================================================================
// WILSON SCORE CONFIDENCE INTERVAL
// =============================================================================

/**
 * Calculate Wilson score confidence interval for a proportion
 *
 * The Wilson score interval is the recommended method for binomial proportions,
 * especially for small samples or proportions near 0 or 1.
 *
 * Formula: (p + z²/2n ± z√(p(1-p)/n + z²/4n²)) / (1 + z²/n)
 *
 * @param {number} successes - Number of successes
 * @param {number} total - Total number of trials
 * @param {number} confidence - Confidence level (default 0.95 for 95% CI)
 * @returns {object} { lower, upper, center } as proportions (0-1)
 */
function wilsonScoreInterval(successes, total, confidence = 0.95) {
  if (total === 0) return { lower: 0, upper: 0, center: 0 };

  // Z-score for confidence level (1.96 for 95%, 2.576 for 99%)
  const z = confidence === 0.99 ? 2.576 : confidence === 0.90 ? 1.645 : 1.96;

  const p = successes / total;
  const n = total;
  const z2 = z * z;

  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) / n) + (z2 / (4 * n * n)));

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center: center,
  };
}

/**
 * Get confidence label based on interval width
 */
function getConfidenceLabel(intervalWidth) {
  if (intervalWidth > 0.30) return 'LOW';
  if (intervalWidth > 0.15) return 'MEDIUM';
  if (intervalWidth > 0.08) return 'HIGH';
  return 'VERY HIGH';
}

// =============================================================================
// LIMITATIONS BANNER - RESEARCH TRANSPARENCY
// =============================================================================

/**
 * Collapsible banner showing simulation limitations and unverified parameters
 *
 * Critical for research transparency - ensures users understand this is
 * illustrative, not predictive.
 */
function SimulationLimitationsBanner() {
  const [expanded, setExpanded] = useState(false);

  const limitations = [
    { category: 'Unverified Parameters', count: 11, desc: 'Movement speeds, behavioral thresholds derived from observational estimates' },
    { category: 'Dog Timeline Gap', count: 1, desc: 'No published dog recovery timeline study - extrapolated from cat data (Huang 2018)' },
    { category: 'Detection Rates', count: 1, desc: 'Sweep widths adapted from human SAR literature, not pet-specific empirical data' },
    { category: 'Terrain Barriers', count: 1, desc: 'OSM data may be incomplete - pets could cross barriers not in dataset' },
  ];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Illustrative Only - Not Predictive
          </span>
        </div>
        <Info className="w-4 h-4 text-amber-600" />
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700 mt-2 mb-3">
            This simulation uses Monte Carlo methods calibrated against peer-reviewed research,
            but contains unverified parameters and should not be used for predictive decisions.
          </p>

          <div className="space-y-2">
            {limitations.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 font-medium shrink-0">
                  {item.count}
                </span>
                <div>
                  <span className="font-medium text-amber-800">{item.category}:</span>
                  <span className="text-amber-700 ml-1">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-amber-200">
            <p className="text-xs text-amber-600 italic">
              See Weiss 2012, Huang 2018, Lord 2009 for calibration sources.
              Albrecht 2020 explicitly calls for a Missing Dog Study.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CONVERGENCE STATUS PANEL
// =============================================================================

/**
 * Displays Monte Carlo convergence diagnostics prominently
 *
 * Shows coefficient of variation (CoV) and whether results have stabilized.
 * Critical for research credibility - users need to know if they've run
 * enough simulations for reliable estimates.
 */
function ConvergenceStatusPanel({ convergence, totalRuns }) {
  if (!convergence) return null;

  const { coefficientOfVariation, hasConverged, threshold, standardError } = convergence;
  const cov = parseFloat(coefficientOfVariation) || 0;
  const covPercent = (cov * 100).toFixed(1);
  const sePercent = standardError ? (parseFloat(standardError) * 100).toFixed(2) : null;

  // Calculate progress toward convergence
  const thresholdNum = parseFloat(threshold) || 0.05;
  const progressPercent = Math.min(100, ((thresholdNum - Math.min(cov, thresholdNum)) / thresholdNum) * 100);

  return (
    <div className={`rounded-lg border p-4 ${
      hasConverged
        ? 'bg-green-50 border-green-200'
        : 'bg-orange-50 border-orange-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${hasConverged ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
        <h3 className={`text-sm font-semibold ${hasConverged ? 'text-green-800' : 'text-orange-800'}`}>
          {hasConverged ? 'Converged' : 'Not Yet Converged'}
        </h3>
      </div>

      <div className="space-y-2">
        {/* CoV display */}
        <div className="flex items-center justify-between text-xs">
          <span className={hasConverged ? 'text-green-700' : 'text-orange-700'}>
            Coefficient of Variation
          </span>
          <span className={`font-mono font-medium ${hasConverged ? 'text-green-800' : 'text-orange-800'}`}>
            {covPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              hasConverged ? 'bg-green-500' : 'bg-orange-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">
            Target: CoV &lt; {(thresholdNum * 100).toFixed(0)}%
          </span>
          {sePercent && (
            <span className="text-gray-500">
              SE: ±{sePercent}%
            </span>
          )}
        </div>

        {!hasConverged && (
          <p className="text-[10px] text-orange-600 mt-1">
            Run more simulations for stable estimates. Current sample: {totalRuns}
          </p>
        )}

        {hasConverged && (
          <p className="text-[10px] text-green-600 mt-1">
            Results have stabilized. Additional runs will have diminishing impact.
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CLEARER OUTCOME CATEGORIES
// =============================================================================

/**
 * Outcome hierarchy:
 * FOUND (reunited with owner)
 *   - Self-returned home (pet walked back)
 *   - Owner/searcher found pet
 *   - Stranger found pet → returned via shelter/contact
 *
 * NOT FOUND
 *   - Still missing (location unknown)
 *   - Deceased (traffic, exposure, etc.)
 */
const OUTCOME_LABELS = {
  // FOUND OUTCOMES - Pet reunited with owner
  returnedHomeCount: {
    label: 'Self-Returned Home',
    desc: 'Pet navigated back home on its own',
    color: '#10b981',
    icon: Home,
    category: 'FOUND'
  },
  foundBySearcherCount: {
    label: 'Found by Owner/Searcher',
    desc: 'Owner or search team physically located pet',
    color: '#3b82f6',
    icon: Search,
    category: 'FOUND'
  },
  foundViaShelterCount: {
    label: 'Found via Shelter',
    desc: 'Pet taken to shelter, matched via microchip/report',
    color: '#8b5cf6',
    icon: Building2,
    category: 'FOUND'
  },
  foundViaSocialCount: {
    label: 'Stranger Found & Returned',
    desc: 'Stranger found pet and contacted owner directly',
    color: '#f59e0b',
    icon: Users,
    category: 'FOUND'
  },

  // NOT FOUND OUTCOMES
  timeoutSearchingCount: {
    label: 'Still Missing',
    desc: 'Pet not located within simulation timeframe',
    color: '#6b7280',
    icon: Clock,
    category: 'NOT_FOUND'
  },
  timeoutShelteredCount: {
    label: 'At Shelter (Not Matched)',
    desc: 'Pet at shelter but owner hasn\'t checked',
    color: '#9ca3af',
    icon: Building2,
    category: 'NOT_FOUND'
  },
  foundViaPlatformCount: {
    label: 'Deceased',
    desc: 'Pet died from traffic, exposure, dehydration, etc.',
    color: '#ef4444',
    icon: Skull,
    category: 'NOT_FOUND'
  },
};

// =============================================================================
// EXPORT FUNCTIONALITY
// =============================================================================

/**
 * Export batch results to CSV format
 */
function exportToCSV(batch, simulations) {
  // Build CSV content
  let csv = '';

  // Summary section
  csv += 'SIMULATION SUMMARY\n';
  csv += `Total Simulations,${batch.totalRuns}\n`;
  csv += `Success Rate,${batch.successRate?.toFixed(1)}%\n`;
  csv += `Average Time to Find (mins),${batch.avgTimeToFindMins?.toFixed(1) || 'N/A'}\n`;
  csv += `Median Time to Find (mins),${batch.medianTimeToFindMins?.toFixed(1) || 'N/A'}\n`;
  csv += `Average Pet Displacement (miles),${batch.avgPetDistanceMiles?.toFixed(3) || 'N/A'}\n`;
  csv += '\n';

  // Outcome breakdown
  csv += 'OUTCOME BREAKDOWN\n';
  csv += 'Outcome,Count,Percentage\n';
  Object.entries(OUTCOME_LABELS).forEach(([key, { label }]) => {
    const count = batch[key] || 0;
    const percent = batch.totalRuns > 0 ? ((count / batch.totalRuns) * 100).toFixed(1) : 0;
    csv += `${label},${count},${percent}%\n`;
  });
  csv += '\n';

  // Individual simulations if available
  if (simulations && simulations.length > 0) {
    csv += 'INDIVIDUAL SIMULATIONS\n';
    csv += 'ID,Outcome,Found At (min),Pet Distance (mi),Final State\n';
    simulations.forEach(sim => {
      csv += `${sim.id || sim.randomSeed},${sim.outcome},${sim.foundAtMinute || 'N/A'},${sim.petDistanceMiles?.toFixed(3) || 'N/A'},${sim.finalPetState || 'N/A'}\n`;
    });
  }

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `simulation_results_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

/**
 * Export to JSON format (more detailed)
 */
function exportToJSON(batch, simulations) {
  const data = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalRuns: batch.totalRuns,
      successRate: batch.successRate,
      avgTimeToFindMins: batch.avgTimeToFindMins,
      medianTimeToFindMins: batch.medianTimeToFindMins,
      avgPetDistanceMiles: batch.avgPetDistanceMiles,
      convergence: batch.convergence,
    },
    outcomes: Object.entries(OUTCOME_LABELS).reduce((acc, [key, { label, category }]) => {
      acc[key] = {
        label,
        category,
        count: batch[key] || 0,
        percentage: batch.totalRuns > 0 ? ((batch[key] || 0) / batch.totalRuns) * 100 : 0,
      };
      return acc;
    }, {}),
    simulations: simulations || [],
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `simulation_results_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function formatDuration(minutes) {
  if (!minutes) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export default function BatchResults({ batch, simulations = [] }) {
  const [showMathLog, setShowMathLog] = useState(false);

  if (!batch) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-400 mb-2">
          <BarChart3 className="w-8 h-8 mx-auto" />
        </div>
        <p className="text-sm text-gray-600">No batch results yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Run a batch simulation to see aggregate statistics
        </p>
      </div>
    );
  }

  const total = batch.totalRuns;

  // Calculate FOUND vs NOT FOUND (clearer binary outcome)
  const foundCount = (batch.foundBySearcherCount || 0) +
    (batch.returnedHomeCount || 0) +
    (batch.foundViaShelterCount || 0) +
    (batch.foundViaSocialCount || 0);

  const notFoundCount = (batch.timeoutSearchingCount || 0) +
    (batch.timeoutShelteredCount || 0) +
    (batch.foundViaPlatformCount || 0);  // Deceased mapped here

  const successCount = foundCount;  // For legacy compatibility
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : 0;

  // Calculate Wilson score confidence interval (proper method for proportions)
  const ci = wilsonScoreInterval(successCount, total, 0.95);
  const lowerBound = ci.lower * 100;
  const upperBound = ci.upper * 100;
  const intervalWidth = ci.upper - ci.lower;
  const confidenceLabel = getConfidenceLabel(intervalWidth);

  return (
    <div className="space-y-4">
      {/* Limitations Banner - Research Transparency */}
      <SimulationLimitationsBanner />

      {/* Success Rate Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Success Rate</h3>
        </div>

        <div className="text-center py-4">
          <div className="text-4xl font-bold text-gray-900">
            {lowerBound.toFixed(0)}-{upperBound.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Based on {total} simulations
          </div>
          <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
            confidenceLabel === 'LOW' ? 'bg-red-100 text-red-700' :
            confidenceLabel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {confidenceLabel} confidence
          </div>
        </div>

        {/* Success bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Found</span>
            <span>Not Found</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* Wilson Score CI explanation */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            95% Wilson score confidence interval based on {total} trials
          </p>
        </div>
      </div>

      {/* Convergence Status - Monte Carlo Quality */}
      {batch.convergence && (
        <ConvergenceStatusPanel convergence={batch.convergence} totalRuns={total} />
      )}

      {/* Time Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Time to Find</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(batch.avgTimeToFindMins)}
            </div>
            <div className="text-xs text-gray-500">Average</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(batch.medianTimeToFindMins)}
            </div>
            <div className="text-xs text-gray-500">Median</div>
          </div>
        </div>

        {batch.avgPetDistanceMiles && (
          <div className="mt-3 text-center p-3 bg-indigo-50 rounded-lg">
            <div className="text-lg font-semibold text-indigo-900">
              {batch.avgPetDistanceMiles.toFixed(2)} mi
            </div>
            <div className="text-xs text-indigo-600">Avg pet displacement</div>
          </div>
        )}
      </div>

      {/* Outcome Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Outcome Breakdown</h3>
        </div>

        <div className="space-y-2">
          {Object.entries(OUTCOME_LABELS).map(([key, { label, color, icon: Icon }]) => {
            const count = batch[key] || 0;
            const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

            if (count === 0) return null;

            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className="w-4 h-4" style={{ color }} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export & Math Log */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Export & Debug</h3>
          <div className="flex gap-2">
            <button
              onClick={() => exportToCSV(batch, simulations)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => exportToJSON(batch, simulations)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Math Log Toggle */}
        <button
          onClick={() => setShowMathLog(!showMathLog)}
          className="w-full flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            Show Simulation Math Log
          </span>
          <span>{showMathLog ? '▲' : '▼'}</span>
        </button>

        {showMathLog && (
          <div className="mt-3 p-3 bg-gray-900 rounded-lg text-xs font-mono text-green-400 max-h-64 overflow-y-auto">
            <div className="text-gray-500 mb-2"># Emergent Simulation Engine Log</div>
            <div className="text-gray-400 mb-2">---</div>

            <div className="mb-2">
              <span className="text-yellow-400">CONFIGURATION:</span>
              <div className="ml-2 text-gray-300">
                Total simulations: {batch.totalRuns}<br/>
                Time step: 5 minutes per tick<br/>
                Max duration: 72 hours (864 ticks)
              </div>
            </div>

            <div className="mb-2">
              <span className="text-yellow-400">DISPLACEMENT MODEL (Huang 2018):</span>
              <div className="ml-2 text-gray-300">
                Indoor-only cats: median ~39m<br/>
                Indoor-outdoor cats: median ~300m<br/>
                Simulated avg: {(batch.avgPetDistanceMiles * 1609.34).toFixed(1)}m
              </div>
            </div>

            <div className="mb-2">
              <span className="text-yellow-400">FEAR DYNAMICS:</span>
              <div className="ml-2 text-gray-300">
                Initial fear: 0.8 (based on escape type)<br/>
                Decay rate: 0.0003/min (half-life ~40hr)<br/>
                Fear formula: F(t) = F₀ × e^(-λt)
              </div>
            </div>

            <div className="mb-2">
              <span className="text-yellow-400">STATE MACHINE:</span>
              <div className="ml-2 text-gray-300">
                FLEEING → HIDING → FORAGING → TRAVELING → SHELTERING<br/>
                Transitions driven by fear threshold + physiological needs
              </div>
            </div>

            <div className="mb-2">
              <span className="text-yellow-400">OUTCOME FORMULA:</span>
              <div className="ml-2 text-gray-300">
                Self-return: Pet at home + fear &lt; threshold + energy &gt; 0.3<br/>
                Stranger encounter: P = density × visibility × time_step<br/>
                Detection: Koopman POD = 1 - e^(-W/D) where W=sweep, D=distance
              </div>
            </div>

            {batch.emergentStats && (
              <div className="mb-2">
                <span className="text-yellow-400">EMERGENT STATS:</span>
                <div className="ml-2 text-gray-300">
                  Displacement median: {batch.emergentStats.displacementMedian?.toFixed(3)}mi<br/>
                  Recovery rate: {batch.emergentStats.recoveryRate?.toFixed(1)}%<br/>
                  Self-return rate: {batch.emergentStats.selfReturnRate?.toFixed(1)}%<br/>
                  Execution time: {batch.emergentStats.executionTimeSeconds?.toFixed(1)}s
                </div>
              </div>
            )}

            <div className="text-gray-500 mt-2">
              # All outcomes emerge from behavioral mechanics,<br/>
              # NOT pre-determined probabilities.
            </div>
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-4">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">Key Insights</h3>
        <ul className="text-xs text-indigo-800 space-y-1">
          {batch.foundBySearcherCount > batch.returnedHomeCount && (
            <li>• Active searching was more effective than waiting for pet to return</li>
          )}
          {batch.returnedHomeCount > batch.foundBySearcherCount && (
            <li>• Many pets returned home on their own - consider posting signs near home</li>
          )}
          {(batch.foundViaShelterCount || 0) > total * 0.1 && (
            <li>• Significant shelter finds - check local shelters daily</li>
          )}
          {(batch.timeoutShelteredCount || 0) > total * 0.05 && (
            <li>• Some pets were picked up but not matched - improve platform visibility</li>
          )}
          {batch.avgTimeToFindMins && batch.avgTimeToFindMins < 360 && (
            <li>• Average find time is under 6 hours - early searching is critical</li>
          )}
          {batch.avgPetDistanceMiles && batch.avgPetDistanceMiles < 0.5 && (
            <li>• Pets stayed close - focus intensive search near last seen location</li>
          )}
        </ul>
      </div>
    </div>
  );
}
