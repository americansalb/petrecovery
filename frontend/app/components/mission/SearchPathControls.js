'use client';

/**
 * SearchPathControls - Mobile Controls for Search Path Tracking
 *
 * A simple, intuitive interface for marking search locations on mobile:
 * - Big "Mark Here" button to drop a pin at current GPS location
 * - Stats showing progress (points marked, distance, points earned)
 * - End session button to save the search path
 *
 * Designed for one-handed use while walking and searching.
 */

import { useState } from 'react';
import { MapPin, Play, Square, Undo2, Loader2, Navigation, Award, Route } from 'lucide-react';

export default function SearchPathControls({
  // From useSearchSession hook
  isActive,
  path,
  stats,
  error,
  isMarking,
  gpsLoading,
  canMarkLocation,
  canUndo,
  // Actions
  markCurrentLocation,
  endSession,
  undoLastPoint,
  startSession,
  // Optional
  onSessionEnd,
  className = '',
}) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  // Handle mark button click
  const handleMark = async () => {
    const result = await markCurrentLocation();
    if (result.success) {
      // Haptic feedback on mobile if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  };

  // Handle end session
  const handleEndSession = async () => {
    setEndingSession(true);
    const result = await endSession();
    setEndingSession(false);
    setShowEndConfirm(false);

    if (result.success && onSessionEnd) {
      onSessionEnd(result);
    }
  };

  // Format distance
  const formatDistance = (miles) => {
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  };

  // Not started yet - show start button
  if (!isActive && path.length === 0) {
    return (
      <div className={`bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 ${className}`}>
        <div className="text-center mb-4">
          <div className="text-slate-400 text-sm mb-2">Ready to search?</div>
          <div className="text-white text-lg font-medium">
            Tap the button below to start tracking your search path
          </div>
        </div>

        <button
          onClick={startSession}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-lg shadow-purple-500/30"
        >
          <Play size={24} fill="currentColor" />
          Start Search
        </button>

        <div className="mt-4 text-center text-slate-500 text-sm">
          As you search, tap "Mark Here" to record your path
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/95 backdrop-blur-md rounded-2xl overflow-hidden ${className}`}>
      {/* Stats Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          {/* Points marked */}
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-purple-400" />
            <span className="text-white font-medium">{stats.pointsMarked}</span>
            <span className="text-slate-400 text-sm">points</span>
          </div>

          {/* Distance */}
          <div className="flex items-center gap-1.5">
            <Route size={16} className="text-blue-400" />
            <span className="text-white font-medium">{formatDistance(stats.distanceMiles)}</span>
          </div>
        </div>

        {/* Points earned */}
        <div className="flex items-center gap-1.5 bg-amber-500/20 px-3 py-1 rounded-full">
          <Award size={16} className="text-amber-400" />
          <span className="text-amber-400 font-semibold">+{stats.estimatedPoints}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="p-4">
        {/* Error Message */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Mark Here Button - The main action */}
        <button
          onClick={handleMark}
          disabled={!canMarkLocation}
          className={`
            w-full py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3
            transition-all active:scale-[0.98] shadow-lg
            ${canMarkLocation
              ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-purple-500/30'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {isMarking || gpsLoading ? (
            <>
              <Loader2 size={28} className="animate-spin" />
              <span>Getting Location...</span>
            </>
          ) : (
            <>
              <Navigation size={28} />
              <span>Mark Here</span>
            </>
          )}
        </button>

        {/* Secondary Actions */}
        <div className="flex gap-3 mt-3">
          {/* Undo */}
          <button
            onClick={undoLastPoint}
            disabled={!canUndo}
            className={`
              flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2
              transition-all
              ${canUndo
                ? 'bg-slate-700 text-slate-200 active:bg-slate-600'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Undo2 size={18} />
            Undo
          </button>

          {/* End Session */}
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={path.length === 0}
            className={`
              flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2
              transition-all
              ${path.length > 0
                ? 'bg-slate-700 text-slate-200 active:bg-slate-600'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Square size={18} fill="currentColor" />
            End Search
          </button>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-5 max-w-sm w-full">
            <h3 className="text-white text-lg font-semibold mb-2">End Search Session?</h3>
            <p className="text-slate-400 text-sm mb-4">
              Your search path will be saved. You marked {stats.pointsMarked} points
              covering {formatDistance(stats.distanceMiles)}.
            </p>

            <div className="bg-slate-700/50 rounded-xl p-3 mb-4 flex items-center justify-center gap-2">
              <Award size={20} className="text-amber-400" />
              <span className="text-white font-semibold">
                You earned {stats.estimatedPoints} points!
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-medium"
              >
                Keep Searching
              </button>
              <button
                onClick={handleEndSession}
                disabled={endingSession}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {endingSession ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Save & End'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
