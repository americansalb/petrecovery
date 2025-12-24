'use client';

/**
 * MapLegend - Collapsible map legend for SAR operations
 *
 * Shows:
 * - Last seen location
 * - Sightings (with recency)
 * - You (user location)
 * - Area Searched (purple overlay)
 * - Active Searches (when team is searching)
 * - Points of Interest (shelters, vets)
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Eye, User, Radio, Building2 } from 'lucide-react';

export default function MapLegend({
  showSightings = false,
  showSearchPath = false,
  showActiveSearches = false,
  showPOIs = false,
  activeSearchersCount = 0,
  isExpanded: initialExpanded = true,
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="absolute top-4 left-4 z-[400]">
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
        <div className="bg-slate-900/95 backdrop-blur rounded-xl border border-slate-700 shadow-lg overflow-hidden min-w-[160px]">
          {/* Header with collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:bg-slate-800/50 transition"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">Legend</span>
            <ChevronUp size={14} />
          </button>

          {/* Legend items */}
          <div className="px-3 pb-3 space-y-2">
            {/* Last seen location */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[10px] shadow-sm">
                📍
              </div>
              <span className="text-slate-200 text-xs font-medium">Last Seen</span>
            </div>

            {/* Sightings */}
            {showSightings && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[10px] shadow-sm">
                  👁
                </div>
                <span className="text-slate-200 text-xs font-medium">Sightings</span>
              </div>
            )}

            {/* You (user location) */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
              <span className="text-slate-200 text-xs font-medium">You</span>
            </div>

            {/* Search path elements - shown when there's a search path */}
            {showSearchPath && (
              <>
                {/* Search Start marker */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                  <span className="text-slate-200 text-xs font-medium">Search Start</span>
                </div>

                {/* Your Search Path */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded bg-blue-500" />
                  <span className="text-slate-200 text-xs font-medium">Your Path</span>
                </div>

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
                  Team Searching ({activeSearchersCount - 1})
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
          </div>
        </div>
      )}
    </div>
  );
}
