'use client';

/**
 * BottomPanel - Simple search controls
 *
 * Clean, reliable start search button with clear states
 */

import { Loader2, Navigation, MapPin, Eye } from 'lucide-react';

export default function BottomPanel({
  isStarting = false,
  onStartSearch,
  onReportSighting,
  disabled = false,
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[500] pointer-events-none">
      {/* Gradient fade */}
      <div className="h-20 bg-gradient-to-t from-slate-950 to-transparent" />

      {/* Controls */}
      <div className="bg-slate-950 px-4 pb-4 pointer-events-auto">
        {/* Quick actions row */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={onReportSighting}
            disabled={disabled}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium flex items-center justify-center gap-2 active:bg-slate-700 transition disabled:opacity-50"
          >
            <Eye size={18} className="text-amber-400" />
            <span>Report Sighting</span>
          </button>
        </div>

        {/* Main start button */}
        <button
          onClick={onStartSearch}
          disabled={disabled || isStarting}
          className={`
            w-full py-4 rounded-2xl font-bold text-lg
            flex items-center justify-center gap-3
            transition-all
            bg-gradient-to-r from-emerald-500 to-teal-500 text-white
            shadow-lg shadow-emerald-500/25
            active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100
          `}
        >
          {isStarting ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              <span>Getting GPS...</span>
            </>
          ) : (
            <>
              <Navigation size={22} />
              <span>Start GPS Search</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 mt-2">
          Track your search path and earn points
        </p>
      </div>
    </div>
  );
}
