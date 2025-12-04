'use client';

/**
 * MissionsModeV2 - Combined missions view with map and list toggle
 *
 * Features:
 * - Default map view showing all missions geographically
 * - Switch to list view for detailed mission cards
 * - Smooth toggle between views
 * - Consistent filtering across both views
 */

import { useState } from 'react';
import { Map as MapIcon, List } from 'lucide-react';
import MapModeV2 from './MapModeV2';
import CasesModeV2 from './CasesModeV2';

export default function MissionsModeV2({
  cases,
  divisions,
  squad,
  selectedStatus,
  onStatusChange,
  cityName,
  squadId,
  onCaseUpdate,
}) {
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <button
            onClick={() => setViewMode('map')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200
              ${viewMode === 'map'
                ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            <MapIcon size={16} strokeWidth={2.5} />
            <span>Map View</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200
              ${viewMode === 'list'
                ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            <List size={16} strokeWidth={2.5} />
            <span>List View</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="transition-all duration-300">
        {viewMode === 'map' ? (
          <MapModeV2
            cases={cases}
            divisions={divisions}
            squad={squad}
          />
        ) : (
          <CasesModeV2
            cases={cases}
            selectedStatus={selectedStatus}
            onStatusChange={onStatusChange}
            cityName={cityName}
            squadId={squadId}
            onCaseUpdate={onCaseUpdate}
          />
        )}
      </div>
    </div>
  );
}
