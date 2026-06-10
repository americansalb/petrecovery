'use client';

/**
 * MapLegend - Collapsible map legend for SAR operations
 *
 * Shows:
 * - Last seen location
 * - Sightings (confirmed/unconfirmed with expanding zones)
 * - Probability zones (when enabled)
 * - You (user location)
 * - Area Searched (purple overlay)
 * - Active Searches (when team is searching)
 * - Points of Interest (shelters, vets)
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Building2, Info } from 'lucide-react';

export default function MapLegend({
  showSightings = false,
  showSearchPath = false,
  showActiveSearches = false,
  showPOIs = false,
  showProbabilityZones = false,
  activeSearchersCount = 0,
  isExpanded: initialExpanded = false, // Start collapsed by default
  style = undefined, // position override so floating panels never cover it
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-[400]" style={style}>
      {/* Collapsed state - just a small toggle button */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-medium hover:bg-slate-800 transition flex items-center gap-2 shadow-lg"
        >
          <MapPin size={14} className="text-amber-400" />
          <span>Legend</span>
          <ChevronDown size={14} />
        </button>
      ) : (
        /* Expanded legend */
        <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 shadow-lg overflow-hidden min-w-[180px]">
          {/* Header with collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:bg-slate-800/50 transition"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">Legend</span>
            <ChevronUp size={14} />
          </button>

          {/* Legend items */}
          <div className="px-3 pb-3 space-y-2.5">
            {/* Last seen location */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[10px] shadow-sm">
                📍
              </div>
              <span className="text-slate-200 text-xs font-medium">Last Seen</span>
            </div>

            {/* Sightings section */}
            {showSightings && (
              <>
                {/* Confirmed Sighting */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[10px] shadow-sm">
                      👁
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-slate-200 text-xs font-medium">Confirmed Sighting</span>
                  </div>
                </div>

                {/* Unconfirmed Sighting */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[10px] shadow-sm">
                      👁
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-slate-200 text-xs font-medium">Unconfirmed Sighting</span>
                  </div>
                </div>

                {/* Sighting zone explanation */}
                <div className="flex items-center gap-2 pl-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400 border-dashed" />
                  <span className="text-slate-400 text-[10px]">Zone expands over time</span>
                </div>
              </>
            )}

            {/* Probability zones */}
            {showProbabilityZones && (
              <>
                <div className="pt-1 border-t border-slate-700/50">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Search Zones</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500/30 border border-green-400" />
                  <span className="text-slate-200 text-xs">HIGH (67.5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500/30 border border-yellow-400" />
                  <span className="text-slate-200 text-xs">MEDIUM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500/30 border border-orange-400" />
                  <span className="text-slate-200 text-xs">LOW</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500/30 border border-red-400" />
                  <span className="text-slate-200 text-xs">EXTENDED</span>
                </div>
              </>
            )}

            {/* You (user location) */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
              <span className="text-slate-200 text-xs font-medium">You</span>
            </div>

            {/* Search path elements - shown when there's a search path */}
            {showSearchPath && (
              <>
                {/* Area Searched (purple corridor) */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-3 rounded bg-purple-500/40 border border-purple-400" />
                  <span className="text-slate-200 text-xs font-medium">Area Covered</span>
                </div>
              </>
            )}

            {/* Team Members Searching - only show if more than just you */}
            {showActiveSearches && activeSearchersCount > 1 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 border-2 border-white shadow-sm" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-slate-200 text-xs font-medium">
                  Team ({activeSearchersCount - 1})
                </span>
              </div>
            )}

            {/* Points of Interest */}
            {showPOIs && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-indigo-500 border-2 border-white flex items-center justify-center shadow-sm">
                  <Building2 size={10} className="text-white" />
                </div>
                <span className="text-slate-200 text-xs font-medium">Shelters/Vets</span>
              </div>
            )}

            {/* Details toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-1 pt-2 text-slate-500 hover:text-slate-300 text-[10px] transition"
            >
              <Info size={10} />
              {showDetails ? 'Less info' : 'More info'}
            </button>

            {/* Expanded details */}
            {showDetails && (
              <div className="text-[10px] text-slate-500 space-y-1 pt-1 border-t border-slate-700/50">
                <p>• <span className="text-green-400">Green zones</span> = confirmed sightings</p>
                <p>• <span className="text-blue-400">Blue zones</span> = unconfirmed sightings</p>
                <p>• Zones expand as time passes</p>
                <p>• Tap any zone for details</p>
                {showProbabilityZones && (
                  <p>• Probability zones show likely pet location based on species, size, and time</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
