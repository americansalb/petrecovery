'use client';

/**
 * MapTab - Full Map View with GPS Search Integration
 *
 * Features:
 * - Full-screen Apple Map with last seen location
 * - Sighting markers
 * - GPS search path display (validated vs invalid)
 * - Start/Stop search buttons
 * - Real-time stats during search
 * - Report sighting button
 *
 * Now powered by Apple MapKit JS
 */

import dynamic from 'next/dynamic';
import { Eye, Navigation, Clock, Route, Star, Loader2, Square, AlertTriangle, Map } from 'lucide-react';

// Lazy load Apple Map for performance
const AppleMap = dynamic(() => import('@/components/maps/AppleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Map size={32} className="text-slate-600 mx-auto mb-2 animate-pulse" />
        <p className="text-slate-500 text-sm">Loading Apple Maps...</p>
      </div>
    </div>
  )
});

export default function MapTab({
  mission,
  sightings = [],
  searchPath = [],
  searchStats = null,
  isSearchActive = false,
  isStartingSearch = false,
  searchValidation = null,
  onReportSighting,
  onStartSearch,
  onEndSearch,
  onViewActiveSearch,
}) {
  if (!mission) return null;

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Full Map View - Powered by Apple Maps */}
      <div className="bg-slate-900 border border-flash-500/30 rounded-xl overflow-hidden relative" style={{ height: '50vh', minHeight: '300px' }}>
        <AppleMap
          center={mission.lastSeenLatitude && mission.lastSeenLongitude
            ? { lat: mission.lastSeenLatitude, lng: mission.lastSeenLongitude }
            : { lat: 41.8781, lng: -87.6298 }}
          zoom={15}
          mapType="mutedStandard"
          colorScheme="dark"
          showUserLocation={isSearchActive}
          lastSeenLocation={mission.lastSeenLatitude ? {
            lat: mission.lastSeenLatitude,
            lng: mission.lastSeenLongitude,
            address: mission.lastSeenAddress,
          } : null}
          sightings={sightings}
          searchPath={searchPath}
        />

        {/* Validation Warning Overlay */}
        {isSearchActive && searchValidation?.lastWarning && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className={`px-3 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2 text-sm ${
              searchValidation.lastWarning === 'OUTSIDE_ZONE'
                ? 'bg-amber-500/90 text-slate-900'
                : 'bg-red-500/90 text-white'
            }`}>
              <AlertTriangle size={16} />
              <span className="font-medium">
                {searchValidation.lastWarning === 'OUTSIDE_ZONE'
                  ? 'Outside search zone - distance not counted'
                  : 'Too fast - walking only'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search Stats (when active) */}
      {isSearchActive && searchStats && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-400 font-bold">Search Active</span>
            </div>
            <button
              onClick={onViewActiveSearch}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Full Screen
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Clock size={14} />
              </div>
              <p className="text-xl font-bold text-white font-mono">
                {formatDuration(searchStats.durationSeconds)}
              </p>
              <p className="text-xs text-slate-500">Time</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Route size={14} />
              </div>
              <p className="text-xl font-bold text-white">
                {searchStats.validatedDistanceMiles?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-slate-500">Miles</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Star size={14} />
              </div>
              <p className="text-xl font-bold text-flash-400">
                {searchStats.estimatedPoints || 0}
              </p>
              <p className="text-xs text-slate-500">Points</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onReportSighting}
          className="py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
        >
          <Eye size={20} />
          Report Sighting
        </button>

        {!isSearchActive ? (
          <button
            onClick={onStartSearch}
            disabled={isStartingSearch}
            className="py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-wait transition flex items-center justify-center gap-2"
          >
            {isStartingSearch ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Navigation size={20} />
                Start Search
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onEndSearch}
            className="py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
          >
            <Square size={20} />
            End Search
          </button>
        )}
      </div>

      {/* Sightings Summary */}
      {sightings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Eye size={18} />
              <span className="font-bold">{sightings.length} Sighting{sightings.length !== 1 ? 's' : ''} Reported</span>
            </div>
            <span className="text-amber-300/70 text-sm">Shown on map</span>
          </div>

          {/* Recent sightings list */}
          <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
            {sightings.slice(0, 3).map((sighting, idx) => (
              <div key={sighting.id || idx} className="flex items-center justify-between text-sm p-2 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 truncate flex-1">
                  {sighting.description || sighting.address || 'Sighting reported'}
                </span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                  sighting.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                  sighting.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {sighting.confidence || 'Reported'}
                </span>
              </div>
            ))}
            {sightings.length > 3 && (
              <p className="text-slate-500 text-xs text-center">+ {sightings.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Search Path Info (when not actively searching but have a path) */}
      {searchPath.length > 0 && !isSearchActive && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-400">
            <Navigation size={18} />
            <span className="font-bold">Previous Search Path</span>
          </div>
          <p className="text-purple-300/70 text-sm mt-1">
            Your last search path is shown on the map. Start a new search to continue exploring!
          </p>
        </div>
      )}
    </div>
  );
}
