'use client';

/**
 * ActiveSearchScreen - Full-screen GPS Search Experience
 *
 * Features:
 * - Full-screen map with real-time path
 * - Live stats (time, distance, points)
 * - Validation warnings (outside zone, driving)
 * - Suramaa contextual tips
 * - Report sighting button always visible
 * - End search with summary
 */

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  X,
  Navigation,
  Clock,
  Route,
  Star,
  AlertTriangle,
  Eye,
  Square,
  MapPin,
  Loader2,
  ChevronUp,
  Grid3X3,
  Zap,
  ArrowLeft,
} from 'lucide-react';

// Lazy load map
const SARMapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-flash-400 animate-spin" />
    </div>
  ),
});

// Suramaa tips for during search
const SEARCH_TIPS = [
  { trigger: 'start', text: "Great! Walk slowly and call {petName}'s name every few steps." },
  { trigger: 'new_area', text: "New area! Check under porches, behind bushes, and in tight spaces." },
  { trigger: 'idle', text: "Still there? Shake a treat bag or squeaky toy - familiar sounds help!" },
  { trigger: 'outside_zone', text: "You're outside the search area. Head back toward the last seen location." },
  { trigger: 'driving', text: "Looks like you're in a vehicle. Walking searches work best!" },
  { trigger: 'good_progress', text: "Amazing progress! You've covered a lot of ground." },
  { trigger: 'dawn', text: "Dawn is prime search time - pets are often active now!" },
  { trigger: 'dusk', text: "Dusk search! Pets come out when it's cooler. Keep your eyes peeled!" },
];

// Get contextual tip
function getContextualTip(validation, stats, petName) {
  if (!validation.inZone) {
    return SEARCH_TIPS.find(t => t.trigger === 'outside_zone')?.text.replace('{petName}', petName);
  }
  if (!validation.validSpeed) {
    return SEARCH_TIPS.find(t => t.trigger === 'driving')?.text;
  }
  if (stats.gridCellsCovered > 10) {
    return SEARCH_TIPS.find(t => t.trigger === 'good_progress')?.text;
  }
  if (stats.durationSeconds < 60) {
    return SEARCH_TIPS.find(t => t.trigger === 'start')?.text.replace('{petName}', petName);
  }
  return null;
}

export default function ActiveSearchScreen({
  mission,
  searchSession,
  onEnd,
  onCancel,
  onReportSighting,
}) {
  const {
    isActive,
    isEnding,
    stats,
    formattedDuration,
    path,
    validation,
    meetsMinimumRequirements,
    endSearch,
    cancelSearch,
  } = searchSession;

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [endResult, setEndResult] = useState(null);

  // Get contextual tip
  const currentTip = useMemo(() =>
    getContextualTip(validation, stats, mission?.petName || 'your pet'),
    [validation, stats, mission?.petName]
  );

  // Map center - follow user's current position or last seen
  const mapCenter = useMemo(() => {
    if (path.length > 0) {
      const lastPoint = path[path.length - 1];
      return [lastPoint.lat, lastPoint.lng];
    }
    if (mission?.lastSeenLatitude && mission?.lastSeenLongitude) {
      return [mission.lastSeenLatitude, mission.lastSeenLongitude];
    }
    return [41.8781, -87.6298];
  }, [path, mission]);

  // Handle end search
  const handleEndSearch = async () => {
    const result = await endSearch();
    if (result.success) {
      setEndResult(result);
      setShowEndConfirm(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    await cancelSearch();
    if (onCancel) onCancel();
  };

  // If we have an end result, show summary screen
  if (endResult) {
    return (
      <SearchSummaryScreen
        result={endResult}
        mission={mission}
        onClose={onEnd}
        onSearchAgain={() => {
          setEndResult(null);
          // Parent should handle starting new search
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-900/95 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Exit</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-bold text-sm">LIVE SEARCH</span>
          </div>

          <button
            onClick={onReportSighting}
            className="px-3 py-1.5 bg-amber-500 text-slate-900 font-bold text-sm rounded-lg hover:bg-amber-400 transition flex items-center gap-1"
          >
            <Eye size={16} />
            Sighting
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <SARMapView
          center={mapCenter}
          zoom={17}
          lastSeen={mission?.lastSeenLatitude ? {
            lat: mission.lastSeenLatitude,
            lng: mission.lastSeenLongitude,
            address: mission.lastSeenAddress,
          } : null}
          gpsPath={path}
          showUserLocation={true}
          petSpecies={mission?.petSpecies}
          showControls={false}
          interactive={true}
        />

        {/* Validation Warning Overlay */}
        {validation.lastWarning && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className={`px-4 py-3 rounded-xl backdrop-blur-sm flex items-center gap-3 ${
              validation.lastWarning === 'OUTSIDE_ZONE'
                ? 'bg-amber-500/90 text-slate-900'
                : 'bg-red-500/90 text-white'
            }`}>
              <AlertTriangle size={20} />
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {validation.lastWarning === 'OUTSIDE_ZONE'
                    ? 'Outside Search Zone'
                    : 'Movement Paused'}
                </p>
                <p className="text-xs opacity-90">
                  {validation.lastWarning === 'OUTSIDE_ZONE'
                    ? `${validation.distanceFromZone.toFixed(1)} mi from zone - distance won't count`
                    : 'Speed too high - walking searches only'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700">
        {/* Stats Row */}
        <div
          className="px-4 py-3 cursor-pointer"
          onClick={() => setShowStats(!showStats)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Time */}
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                <div>
                  <p className="text-xl font-bold text-white font-mono">{formattedDuration}</p>
                  <p className="text-xs text-slate-500">Time</p>
                </div>
              </div>

              {/* Distance */}
              <div className="flex items-center gap-2">
                <Route size={18} className="text-purple-400" />
                <div>
                  <p className="text-xl font-bold text-white">
                    {stats.validatedDistanceMiles.toFixed(2)}
                    <span className="text-sm text-slate-500 ml-1">mi</span>
                  </p>
                  <p className="text-xs text-slate-500">Distance</p>
                </div>
              </div>

              {/* Points */}
              <div className="flex items-center gap-2">
                <Star size={18} className="text-flash-400" />
                <div>
                  <p className="text-xl font-bold text-flash-400">{stats.estimatedPoints}</p>
                  <p className="text-xs text-slate-500">Points</p>
                </div>
              </div>
            </div>

            <ChevronUp
              size={20}
              className={`text-slate-500 transition-transform ${showStats ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Expanded Stats */}
        {showStats && (
          <div className="px-4 pb-3 border-t border-slate-800">
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <Grid3X3 size={14} className="mx-auto text-green-400 mb-1" />
                <p className="text-lg font-bold text-white">{stats.gridCellsCovered}</p>
                <p className="text-xs text-slate-500">Areas</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <Route size={14} className="mx-auto text-slate-400 mb-1" />
                <p className="text-lg font-bold text-slate-400">{stats.totalDistanceMiles.toFixed(2)}</p>
                <p className="text-xs text-slate-500">Total mi</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <Zap size={14} className="mx-auto text-amber-400 mb-1" />
                <p className="text-lg font-bold text-white">
                  {stats.avgSpeed30s ? stats.avgSpeed30s.toFixed(1) : '0'}
                </p>
                <p className="text-xs text-slate-500">mph (30s)</p>
              </div>
            </div>

            {/* Transportation Method Detection */}
            <TransportMethodBadge method={stats.transportMethod} />

            {/* Minimum requirements indicator */}
            {!meetsMinimumRequirements && (
              <p className="text-xs text-amber-400 text-center mt-2">
                Search 5+ min and 0.1+ mi to earn points
              </p>
            )}
          </div>
        )}

        {/* Suramaa Tip */}
        {currentTip && (
          <div className="px-4 py-2 bg-flash-500/10 border-t border-flash-500/30">
            <div className="flex items-start gap-2">
              <span className="text-lg">🦮</span>
              <p className="text-sm text-flash-300 flex-1">{currentTip}</p>
            </div>
          </div>
        )}

        {/* End Search Button */}
        <div className="px-4 py-4">
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={isEnding}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            {isEnding ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Square size={20} />
            )}
            {isEnding ? 'Ending...' : 'End Search'}
          </button>
        </div>
      </div>

      {/* End Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-700 shadow-xl">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">End your search?</h3>

              <div className="bg-slate-800/50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Time</span>
                  <span className="text-white font-medium">{formattedDuration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Distance</span>
                  <span className="text-white font-medium">{stats.validatedDistanceMiles.toFixed(2)} mi</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Areas covered</span>
                  <span className="text-white font-medium">{stats.gridCellsCovered}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-2">
                  <span className="text-flash-400 font-semibold">Points to earn</span>
                  <span className="text-flash-400 font-bold">{stats.estimatedPoints}</span>
                </div>
              </div>

              {!meetsMinimumRequirements && (
                <p className="text-amber-400 text-sm mb-4 text-center">
                  Search a bit longer to earn points!
                </p>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleEndSearch}
                  disabled={isEnding}
                  className="w-full py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isEnding ? <Loader2 size={18} className="animate-spin" /> : null}
                  End & Earn {stats.estimatedPoints} Points
                </button>

                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="w-full py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
                >
                  Keep Searching
                </button>

                <button
                  onClick={handleCancel}
                  className="w-full py-2 text-slate-500 text-sm hover:text-slate-400 transition"
                >
                  Cancel (no points)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Transportation Method Badge - Shows detected movement type
 */
function TransportMethodBadge({ method }) {
  const info = {
    stationary: { label: 'Stationary', icon: '⏸️', color: 'bg-slate-700 text-slate-300', thorough: null },
    walking: { label: 'Walking', icon: '🚶', color: 'bg-green-500/20 text-green-400 border border-green-500/30', thorough: 'Excellent thoroughness' },
    jogging: { label: 'Jogging', icon: '🏃', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30', thorough: 'Good thoroughness' },
    cycling: { label: 'Cycling', icon: '🚴', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', thorough: 'Fair thoroughness' },
    driving: { label: 'Driving', icon: '🚗', color: 'bg-red-500/20 text-red-400 border border-red-500/30', thorough: 'Low thoroughness - consider walking' },
  };

  const { label, icon, color, thorough } = info[method] || info.stationary;

  return (
    <div className="mt-3 flex flex-col items-center">
      <div className={`px-4 py-2 rounded-xl ${color} flex items-center gap-2`}>
        <span className="text-lg">{icon}</span>
        <span className="font-semibold">{label}</span>
      </div>
      {thorough && (
        <p className={`text-xs mt-1 ${method === 'walking' ? 'text-green-400' : method === 'driving' ? 'text-red-400' : 'text-slate-400'}`}>
          {thorough}
        </p>
      )}
    </div>
  );
}

/**
 * Search Summary Screen - Shown after ending search
 */
function SearchSummaryScreen({ result, mission, onClose, onSearchAgain }) {
  const { stats, points, meetsMinimum } = result;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-flash-500/20 rounded-full flex items-center justify-center mb-6">
          <Star size={40} className="text-flash-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          {meetsMinimum ? 'Great Search!' : 'Search Complete'}
        </h1>

        {/* Points */}
        <div className="text-5xl font-bold text-flash-400 mb-6">
          +{points.total} pts
        </div>

        {/* Stats Breakdown */}
        <div className="w-full max-w-sm bg-slate-800/50 rounded-xl p-4 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Distance ({stats.validatedDistanceMiles} mi)</span>
              <span className="text-white font-medium">+{points.distance} pts</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Areas covered ({stats.gridCellsCovered})</span>
              <span className="text-white font-medium">+{points.gridBonus} pts</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Time ({stats.durationMinutes} min)</span>
              <span className="text-white font-medium">+{points.timeBonus} pts</span>
            </div>
            {points.multiplier > 1 && (
              <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                <span className="text-amber-400">Bonus multiplier</span>
                <span className="text-amber-400 font-medium">{points.multiplier}x</span>
              </div>
            )}
          </div>
        </div>

        {/* Suramaa Message */}
        <div className="bg-flash-500/10 border border-flash-500/30 rounded-xl p-4 mb-8 max-w-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🦮</span>
            <p className="text-flash-300 text-sm text-left">
              Amazing effort! Every step helps bring {mission?.petName || 'them'} home.
              Come back at dawn or dusk for the best chance of spotting them!
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex-shrink-0 p-4 space-y-3">
        <button
          onClick={onSearchAgain}
          className="w-full py-4 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition flex items-center justify-center gap-2"
        >
          <Navigation size={20} />
          Search Again
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
        >
          Back to Mission
        </button>
      </div>
    </div>
  );
}
