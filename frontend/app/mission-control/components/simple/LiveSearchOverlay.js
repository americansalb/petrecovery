'use client';

/**
 * LiveSearchOverlay - Active search display
 *
 * Simple, reliable stats and end button
 */

import { Clock, Navigation, Star, Square, Loader2, MapPin } from 'lucide-react';

const MIN_MINUTES = 5;
const MIN_MILES = 0.1;

export default function LiveSearchOverlay({
  formattedDuration = '0:00',
  durationSeconds = 0,
  distanceMiles = 0,
  estimatedPoints = 0,
  isEnding = false,
  isMarking = false,
  onMark,
  onEndSearch,
}) {
  const meetsMinimum = (durationSeconds / 60) >= MIN_MINUTES && distanceMiles >= MIN_MILES;
  const handleEnd = () => {
    if (!isEnding && onEndSearch) {
      onEndSearch();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[500] pointer-events-none">
      {/* Gradient fade */}
      <div className="h-16 bg-gradient-to-t from-slate-950 to-transparent" />

      {/* Content */}
      <div className="bg-slate-950 px-4 pb-4 pointer-events-auto">
        {/* Stats row */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-around text-center">
            {/* Duration */}
            <div>
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
                <Clock size={12} />
                <span>Time</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {formattedDuration}
              </div>
            </div>

            <div className="w-px h-10 bg-slate-700" />

            {/* Distance */}
            <div>
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
                <Navigation size={12} />
                <span>Distance</span>
              </div>
              <div className="text-xl font-bold text-white">
                {distanceMiles.toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">mi</span>
              </div>
            </div>

            <div className="w-px h-10 bg-slate-700" />

            {/* Points */}
            <div>
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
                <Star size={12} />
                <span>Points</span>
              </div>
              <div className="text-xl font-bold text-amber-400">
                {estimatedPoints}
              </div>
            </div>
          </div>
        </div>

        {/* Mark spot - this is what actually draws the search path */}
        {onMark && (
          <button
            type="button"
            onClick={onMark}
            disabled={isMarking || isEnding}
            className="w-full mb-3 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 transition-transform"
          >
            {isMarking ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span>Marking...</span>
              </>
            ) : (
              <>
                <MapPin size={20} />
                <span>Mark My Spot</span>
              </>
            )}
          </button>
        )}

        {/* End button - simple click handler */}
        <button
          type="button"
          onClick={handleEnd}
          disabled={isEnding}
          className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 transition-transform"
        >
          {isEnding ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Square size={18} fill="currentColor" />
              <span>End Search</span>
            </>
          )}
        </button>

        {/* Status and requirements */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">GPS tracking active</span>
          </div>
          {!meetsMinimum && (
            <div className="text-center text-xs text-amber-400">
              Minimum: {MIN_MINUTES} min + {MIN_MILES} mi to earn points
            </div>
          )}
          <div className="text-center text-xs text-slate-500">
            Keep screen on while searching
          </div>
        </div>
      </div>
    </div>
  );
}
