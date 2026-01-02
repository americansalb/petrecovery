'use client';

/**
 * SimulationList - List of completed simulations with outcome info
 */

import {
  CheckCircle2, XCircle, Clock, Home, Building2,
  Share2, Smartphone, Search, AlertTriangle
} from 'lucide-react';

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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export default function SimulationList({
  simulations,
  selectedId,
  onSelect,
}) {
  if (!simulations || simulations.length === 0) {
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">
          Simulations ({simulations.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-100 max-h-[500px] overflow-auto">
        {simulations.map((sim) => {
          const outcomeConfig = sim.outcome ? OUTCOME_CONFIG[sim.outcome] : null;
          const OutcomeIcon = outcomeConfig?.icon || Clock;
          const isSuccess = sim.outcome && !sim.outcome.startsWith('TIMEOUT');

          return (
            <button
              key={sim.id}
              onClick={() => onSelect(sim)}
              className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                selectedId === sim.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
              }`}
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

                  {sim.petDistanceMiles && (
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
        })}
      </div>
    </div>
  );
}
