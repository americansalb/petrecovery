'use client';

/**
 * MapKey - one home for everything about how the map is drawn
 *
 * The old screen floated a Legend pill, a "Hide Zones" pill, and an
 * "Adjust Zone" slider in three different corners. This is all of it:
 * a single collapsed chip that expands into the key, the "Likely area"
 * toggle + size slider, and the shelters & vets pin toggle. Map
 * furniture answers "what am I looking at" — actions live elsewhere.
 */

import { useState } from 'react';
import { Map as MapIcon, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="w-full flex items-center gap-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300 rounded-lg"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-slate-200">{label}</span>
        {sub && <span className="block text-[10px] text-slate-500">{sub}</span>}
      </span>
      <span
        className={`relative w-8 h-[18px] rounded-full transition shrink-0 ${on ? 'bg-flash-400' : 'bg-slate-700'}`}
        aria-hidden
      >
        <span
          className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${
            on ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </span>
    </button>
  );
}

function KeyDot({ className, children }) {
  return (
    <span className={`w-4 h-4 rounded-full shrink-0 ${className}`} aria-hidden>
      {children}
    </span>
  );
}

export default function MapKey({
  showZones,
  onToggleZones,
  zoneMultiplier = 1,
  onZoneMultiplierChange,
  showPOIs,
  onTogglePOIs,
  hasSightings = false,
  hasTrails = false,
  hasPOIs = false,
  style = undefined,
}) {
  const [open, setOpen] = useState(false);
  const percentChange = Math.round((zoneMultiplier - 1) * 100);
  const modified = Math.abs(zoneMultiplier - 1) > 0.01;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={style}
        className="absolute z-[500] flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/85 backdrop-blur border border-white/10 text-slate-200 text-xs font-semibold shadow-xl hover:bg-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300"
      >
        <MapIcon size={14} className="text-flash-300" aria-hidden />
        Map key
        <ChevronUp size={13} aria-hidden />
      </button>
    );
  }

  return (
    <div
      style={style}
      className="absolute z-[500] w-[248px] rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:bg-white/[0.04] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300"
      >
        <span className="flex items-center gap-2 text-xs font-semibold">
          <MapIcon size={14} className="text-flash-300" aria-hidden />
          Map key
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>

      <div className="px-3 pb-3 space-y-2">
        {/* What the marks mean */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2.5">
            <KeyDot className="bg-red-500 ring-2 ring-red-500/30 border-2 border-white" />
            <span className="text-xs text-slate-300">Last seen here</span>
          </div>
          {hasSightings && (
            <div className="flex items-center gap-2.5">
              <KeyDot className="bg-amber-400 border-2 border-white" />
              <span className="text-xs text-slate-300">
                Sighting <span className="text-slate-500">(circles grow with time)</span>
              </span>
            </div>
          )}
          {hasTrails && (
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-1 rounded-full bg-flash-400/80 shrink-0" aria-hidden />
              <span className="text-xs text-slate-300">Ground a searcher covered</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 pt-2 space-y-1">
          {/* Likely area */}
          <ToggleRow
            label="Likely area"
            sub="Where they probably are, from research"
            on={showZones}
            onToggle={onToggleZones}
          />
          {showZones && (
            <div className="pl-1 pr-0.5 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 shrink-0">Smaller</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={zoneMultiplier}
                  onChange={(e) => onZoneMultiplierChange?.(parseFloat(e.target.value))}
                  aria-label="Likely area size"
                  className="flex-1 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-flash-400
                    [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-grab
                    [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-flash-400
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
                />
                <span className="text-[10px] text-slate-500 shrink-0">Larger</span>
              </div>
              <div className="flex items-center justify-between mt-1 min-h-[16px]">
                <span className="text-[10px] text-slate-500">
                  {modified ? `${percentChange > 0 ? '+' : ''}${percentChange}% vs research size` : 'Research size'}
                </span>
                {modified && (
                  <button
                    type="button"
                    onClick={() => onZoneMultiplierChange?.(1)}
                    className="flex items-center gap-1 text-[10px] text-flash-300 hover:text-flash-200 transition"
                  >
                    <RotateCcw size={9} aria-hidden /> Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Shelters & vets pins */}
          {hasPOIs && (
            <ToggleRow label="Shelters & vets" sub="Pins for places to call" on={showPOIs} onToggle={onTogglePOIs} />
          )}
        </div>
      </div>
    </div>
  );
}
