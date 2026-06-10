'use client';

/**
 * LiveSearchHUD - the field unit while a leg is live
 *
 * Replaces the sheet peek the moment a GPS leg starts: a ticking
 * clock, miles, points, one big Mark, one End. Outdoors, gloves,
 * adrenaline: every target is huge.
 */

import { Clock, Navigation, Star, Square, MapPin, Loader2, Undo2 } from 'lucide-react';

export default function LiveSearchHUD({
  formattedDuration = '0:00',
  stats = {},
  isMarking = false,
  isEnding = false,
  canUndo = false,
  error = null,
  onMark,
  onUndo,
  onEnd,
}) {
  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="rounded-2xl bg-slate-800/80 border border-slate-700 px-3 py-2.5 flex items-center justify-around text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">
            <Clock size={11} /> Time
          </div>
          <div className="text-lg font-bold text-white font-mono leading-none">{formattedDuration}</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">
            <Navigation size={11} /> Miles
          </div>
          <div className="text-lg font-bold text-white leading-none">{(stats.distanceMiles || 0).toFixed(2)}</div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div>
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">
            <Star size={11} /> Points
          </div>
          <div className="text-lg font-bold text-flash-300 leading-none">{stats.estimatedPoints || 0}</div>
        </div>
      </div>

      {error && <p className="text-xs text-amber-400 text-center">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onMark}
          disabled={isMarking || isEnding}
          className="flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-60 transition-transform"
        >
          {isMarking ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
          Mark my spot
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={isEnding}
          className="flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 bg-red-500/90 hover:bg-red-500 text-white active:scale-[0.98] disabled:opacity-60 transition"
        >
          {isEnding ? <Loader2 size={20} className="animate-spin" /> : <Square size={16} fill="currentColor" />}
          End
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Recording your path
        </span>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition"
          >
            <Undo2 size={12} /> Undo last mark
          </button>
        )}
      </div>
    </div>
  );
}
