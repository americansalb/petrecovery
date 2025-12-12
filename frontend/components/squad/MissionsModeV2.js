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
import { Map as MapIcon, List, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import MapModeV2 from './MapModeV2';

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
          <MissionsListView
            cases={cases}
            cityName={cityName}
          />
        )}
      </div>
    </div>
  );
}

/**
 * MissionsListView - Grid of mission cards for list mode
 */
function MissionsListView({ cases, cityName }) {
  if (!cases || cases.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Active Missions</h3>
        <p className="text-slate-500 text-sm">
          {cityName ? `No pets currently missing in ${cityName}` : 'No active missions to display'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cases.map((caseItem) => (
        <MissionListCard key={caseItem.id} caseItem={caseItem} />
      ))}
    </div>
  );
}

/**
 * MissionListCard - Individual mission card for list view
 */
function MissionListCard({ caseItem }) {
  const timeAgo = getTimeAgo(caseItem.lastSeenAt);
  const isUrgent = caseItem.urgency === 'HIGH';

  // Species emoji mapping
  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  };
  const emoji = speciesEmoji[caseItem.species || caseItem.petSpecies] || '🐾';

  return (
    <Link
      href={`/cases/${caseItem.missionNumber}`}
      className={`
        block rounded-xl overflow-hidden bg-slate-800/60 border transition-all duration-200
        hover:border-flash-500/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-flash-500/10
        ${isUrgent ? 'border-red-500/50' : 'border-slate-700/50'}
      `}
    >
      {/* Photo area */}
      <div
        className={`h-32 flex items-center justify-center relative bg-cover bg-center ${
          isUrgent ? 'bg-gradient-to-br from-red-900/50 to-slate-900' : 'bg-gradient-to-br from-slate-700 to-slate-800'
        }`}
        style={caseItem.photoUrl || caseItem.petPhotoUrl ? {
          backgroundImage: `url(${caseItem.photoUrl || caseItem.petPhotoUrl})`
        } : undefined}
      >
        {!(caseItem.photoUrl || caseItem.petPhotoUrl) && (
          <span className="text-5xl">{emoji}</span>
        )}

        {/* Urgency badge */}
        {isUrgent && (
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-500 text-white">
            URGENT
          </div>
        )}

        {/* Time badge */}
        <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md text-[10px] font-medium bg-slate-900/80 text-slate-300 flex items-center gap-1">
          <Clock size={10} />
          {timeAgo}
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="font-bold text-white truncate mb-1 text-lg">
          {caseItem.petName}
        </div>

        <div className="text-sm text-slate-400 mb-3">
          {caseItem.petColor && <span className="capitalize">{caseItem.petColor} </span>}
          <span className="capitalize">{(caseItem.species || caseItem.petSpecies)?.toLowerCase()}</span>
          {(caseItem.breed || caseItem.petBreed) && (
            <span className="text-slate-500"> • {caseItem.breed || caseItem.petBreed}</span>
          )}
        </div>

        {(caseItem.lastSeenAddress) && (
          <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-3">
            <MapPin size={12} className="flex-shrink-0 mt-0.5 text-flash-400" />
            <span className="truncate">{caseItem.lastSeenAddress.split(',')[0]}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Users size={12} />
            <span>{caseItem.helperCount || 0} helping</span>
          </div>

          <div className="flex items-center gap-1 text-flash-400 text-sm font-semibold">
            <span>Help</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Helper: Calculate time ago string
 */
function getTimeAgo(isoString) {
  if (!isoString) return 'Unknown';

  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
