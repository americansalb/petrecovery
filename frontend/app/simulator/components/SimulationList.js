'use client';

/**
 * SimulationList - List of completed simulations and batch groups
 */

import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Clock, Home, Building2,
  Share2, Smartphone, Search, AlertTriangle,
  ChevronDown, ChevronRight, Layers, BarChart3, MapPin, Info, Loader2
} from 'lucide-react';
import { estimateUncertaintyBounds } from '@/app/lib/simulator/sensitivity';

const OUTCOME_CONFIG = {
  FOUND_BY_SEARCHER: {
    icon: Search,
    label: 'Found by Searcher',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  RETURNED_HOME: {
    icon: Home,
    label: 'Returned Home',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  FOUND_VIA_SHELTER: {
    icon: Building2,
    label: 'Found via Shelter',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  FOUND_VIA_SOCIAL: {
    icon: Share2,
    label: 'Found via Social',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  FOUND_VIA_PLATFORM: {
    icon: Smartphone,
    label: 'Found via Platform',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  TIMEOUT_SEARCHING: {
    icon: Clock,
    label: 'Timeout (Still Searching)',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  TIMEOUT_SHELTERED: {
    icon: AlertTriangle,
    label: 'Timeout (Sheltered)',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
  },
};

function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Individual simulation row
 */
function SimulationRow({ sim, isSelected, onSelect, isNested = false }) {
  const outcomeConfig = sim.outcome ? OUTCOME_CONFIG[sim.outcome] : null;
  const OutcomeIcon = outcomeConfig?.icon || Clock;
  const isSuccess = sim.outcome && !sim.outcome.startsWith('TIMEOUT');

  return (
    <button
      onClick={() => onSelect(sim)}
      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
      } ${isNested ? 'pl-8' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={`p-2 rounded-lg ${outcomeConfig?.bg || 'bg-gray-100'}`}>
          <OutcomeIcon className={`w-4 h-4 ${outcomeConfig?.color || 'text-gray-500'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Sim #{sim.id.slice(-6)}
            </span>
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : sim.outcome?.startsWith('TIMEOUT') ? (
              <XCircle className="w-4 h-4 text-orange-500" />
            ) : null}
          </div>

          <div className="text-xs text-gray-500 mt-1">
            {outcomeConfig?.label || 'Running...'}
          </div>

          {sim.foundAtMinute && (
            <div className="text-xs text-gray-400 mt-1">
              Found at {formatDuration(sim.foundAtMinute)}
            </div>
          )}

          {sim.petDistanceMiles != null && (
            <div className="text-xs text-gray-400">
              Pet traveled {sim.petDistanceMiles.toFixed(2)} mi
            </div>
          )}

          {sim.wasTransported && (
            <div className="text-xs text-orange-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Picked up by stranger
            </div>
          )}
        </div>

        {/* Seed for reproducibility */}
        <div className="text-[10px] text-gray-300">
          #{sim.randomSeed}
        </div>
      </div>
    </button>
  );
}

/**
 * Expandable batch group
 */
function BatchGroup({ batch, isSelected, isExpanded, onToggle, onSelect, onSelectSimulation, selectedSimId }) {
  const totalRuns = batch.totalRuns || 0;
  const successCount = totalRuns - (batch.timeoutSearchingCount || 0) - (batch.timeoutShelteredCount || 0);
  // Calculate success rate from counts as fallback if batch.successRate is missing
  const calculatedRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0;
  const successRate = (batch.successRate ?? calculatedRate).toFixed(1);

  // Calculate uncertainty bounds based on unverified parameters
  const uncertainty = useMemo(() => {
    if (!batch.successRate) return null;
    try {
      return estimateUncertaintyBounds(batch.successRate);
    } catch (e) {
      return null;
    }
  }, [batch.successRate]);

  return (
    <div className={`border-l-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'}`}>
      {/* Batch Header */}
      <button
        onClick={() => {
          onToggle();
          onSelect(); // Also select the batch for heatmap display
        }}
        className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-indigo-50' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Expand/Collapse Icon */}
          <div className="p-2 rounded-lg bg-indigo-100">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-indigo-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-900">
                Batch of {totalRuns}
              </span>
              {isSelected && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium">
                  <MapPin className="w-2.5 h-2.5" />
                  Heatmap
                </span>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1">
              {successRate}% success rate ({successCount}/{totalRuns} found)
            </div>

            {/* Confidence interval based on parameter uncertainty */}
            {uncertainty && (
              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1" title={uncertainty.warning}>
                <Info className="w-3 h-3" />
                <span>95% CI: {uncertainty.ci95Lower.toFixed(0)}% - {uncertainty.ci95Upper.toFixed(0)}%</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
              {batch.foundBySearcherCount > 0 && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  {batch.foundBySearcherCount} by searcher
                </span>
              )}
              {batch.returnedHomeCount > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {batch.returnedHomeCount} home
                </span>
              )}
              {batch.foundViaShelterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                  {batch.foundViaShelterCount} shelter
                </span>
              )}
              {batch.foundViaSocialCount > 0 && (
                <span className="px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">
                  {batch.foundViaSocialCount} social
                </span>
              )}
              {batch.foundViaPlatformCount > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                  {batch.foundViaPlatformCount} platform
                </span>
              )}
              {batch.timeoutSearchingCount > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                  {batch.timeoutSearchingCount} timeout
                </span>
              )}
              {batch.timeoutShelteredCount > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {batch.timeoutShelteredCount} sheltered
                </span>
              )}
            </div>

            {batch.avgTimeToFindMins && (
              <div className="text-xs text-gray-400 mt-1">
                Avg time: {formatDuration(batch.avgTimeToFindMins)}
              </div>
            )}
          </div>

          {/* Time */}
          <div className="text-[10px] text-gray-300">
            {formatTime(batch.createdAt)}
          </div>
        </div>
      </button>

      {/* Expanded Simulations */}
      {isExpanded && batch.simulations && (
        <div className="bg-gray-50/50 border-t border-gray-100">
          {/* Quick stats bar */}
          <div className="px-3 py-2 bg-gray-100/50 text-xs text-gray-500 flex items-center gap-2">
            <BarChart3 className="w-3 h-3" />
            <span>Individual simulations ({batch.simulations.length})</span>
          </div>

          {/* List simulations */}
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-auto">
            {batch.simulations.map((sim) => (
              <SimulationRow
                key={sim.id}
                sim={sim}
                isSelected={selectedSimId === sim.id}
                onSelect={onSelectSimulation}
                isNested={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SimulationList({
  simulations = [],
  batches = [],
  selectedId,
  selectedBatchId,
  onSelectSimulation,
  onSelectBatch,
  isRegenerating = false,
}) {
  // Track which batches are expanded
  const [expandedBatches, setExpandedBatches] = useState(new Set());

  const toggleBatch = (batchId) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  // Combine and sort items by time (most recent first)
  const items = [
    ...batches.map(b => ({ type: 'batch', data: b, time: new Date(b.createdAt).getTime() })),
    ...simulations.map(s => ({ type: 'simulation', data: s, time: new Date(s.createdAt || Date.now()).getTime() })),
  ].sort((a, b) => b.time - a.time);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-400 mb-2">
          <Search className="w-8 h-8 mx-auto" />
        </div>
        <p className="text-sm text-gray-600">No simulations yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Configure parameters and run a simulation to see results
        </p>
      </div>
    );
  }

  // Count totals
  const totalSims = simulations.length + batches.reduce((sum, b) => sum + (b.totalRuns || 0), 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Results
        </h3>
        {isRegenerating ? (
          <span className="text-xs text-indigo-600 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading animation...
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            {totalSims} total simulation{totalSims !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100 max-h-[500px] overflow-auto">
        {items.map((item) => {
          if (item.type === 'batch') {
            return (
              <BatchGroup
                key={item.data.id}
                batch={item.data}
                isSelected={selectedBatchId === item.data.id}
                isExpanded={expandedBatches.has(item.data.id)}
                onToggle={() => toggleBatch(item.data.id)}
                onSelect={() => onSelectBatch?.(item.data)}
                onSelectSimulation={onSelectSimulation}
                selectedSimId={selectedId}
              />
            );
          } else {
            return (
              <SimulationRow
                key={item.data.id}
                sim={item.data}
                isSelected={selectedId === item.data.id}
                onSelect={onSelectSimulation}
              />
            );
          }
        })}
      </div>
    </div>
  );
}
