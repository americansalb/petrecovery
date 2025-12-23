'use client';

/**
 * LiveSearchOverlay - Stats and controls during active GPS search
 *
 * Shows:
 * - Duration timer
 * - Distance traveled
 * - Points earned
 * - Transport mode indicator
 * - End search button
 */

import { useState } from 'react';
import { Clock, Navigation, Star, AlertTriangle, Loader2 } from 'lucide-react';

// Transport method info
const TRANSPORT_INFO = {
  stationary: { icon: '⏸️', label: 'Stationary', color: 'slate' },
  walking: { icon: '🚶', label: 'Walking', color: 'green' },
  jogging: { icon: '🏃', label: 'Jogging', color: 'amber' },
  cycling: { icon: '🚴', label: 'Cycling', color: 'orange' },
  driving: { icon: '🚗', label: 'Driving', color: 'red' },
};

export default function LiveSearchOverlay({
  // Stats
  formattedDuration = '0:00',
  distanceMiles = 0,
  estimatedPoints = 0,
  transportMethod = 'stationary',

  // Validation
  validation = {},

  // State
  isEnding = false,

  // Callbacks
  onEndSearch,
}) {
  const transport = TRANSPORT_INFO[transportMethod] || TRANSPORT_INFO.stationary;
  const hasWarning = validation.lastWarning && validation.lastWarning !== 'STATIONARY';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[600]">
      {/* Warning banner */}
      {hasWarning && (
        <div className={`
          mx-4 mb-2 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium
          ${validation.lastWarning === 'DRIVING'
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : validation.lastWarning === 'OUTSIDE_ZONE'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-slate-800 text-slate-400'
          }
        `}>
          <AlertTriangle size={16} />
          <span>
            {validation.lastWarning === 'DRIVING' && 'Slow down - GPS not counting driving speed'}
            {validation.lastWarning === 'OUTSIDE_ZONE' && 'You\'re outside the search zone'}
            {validation.lastWarning === 'GPS_ERROR' && 'GPS signal issues - keep moving'}
            {validation.lastWarning === 'OFFLINE' && 'You\'re offline - pings will sync later'}
          </span>
        </div>
      )}

      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none z-0" />

      {/* Content - positioned above gradient */}
      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Stats bar */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-3 mb-3">
          <div className="flex items-center justify-around">
            {/* Duration */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-xs mb-0.5">
                <Clock size={12} />
                <span>Time</span>
              </div>
              <span className="text-xl font-bold text-white font-mono">
                {formattedDuration}
              </span>
            </div>

            <div className="w-px h-10 bg-slate-700" />

            {/* Distance */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-xs mb-0.5">
                <Navigation size={12} />
                <span>Distance</span>
              </div>
              <span className="text-xl font-bold text-white">
                {distanceMiles.toFixed(2)}
                <span className="text-sm text-slate-400 ml-0.5">mi</span>
              </span>
            </div>

            <div className="w-px h-10 bg-slate-700" />

            {/* Points */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-xs mb-0.5">
                <Star size={12} />
                <span>Points</span>
              </div>
              <span className="text-xl font-bold text-amber-400">
                {estimatedPoints}
              </span>
            </div>

            <div className="w-px h-10 bg-slate-700" />

            {/* Transport */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-0.5">Mode</span>
              <span className="text-2xl">{transport.icon}</span>
            </div>
          </div>
        </div>

        {/* End Search Button - Large touch target for mobile */}
        <button
          onClick={onEndSearch}
          disabled={isEnding}
          className={`
            w-full py-5 rounded-2xl font-bold text-lg
            flex items-center justify-center gap-3
            transition-all transform
            bg-gradient-to-r from-red-500 to-orange-500 text-white
            shadow-lg shadow-red-500/30
            touch-manipulation
            ${isEnding ? 'opacity-70 cursor-wait' : 'active:scale-[0.98] hover:shadow-xl hover:shadow-red-500/40'}
          `}
        >
          {isEnding ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Navigation size={22} />
              <span>END SEARCH & EARN {estimatedPoints} PTS</span>
            </>
          )}
        </button>

        {/* Keep searching hint */}
        {!isEnding && (
          <p className="text-center text-xs text-slate-500 mt-2">
            Keep searching to earn more points!
          </p>
        )}
      </div>
    </div>
  );
}
