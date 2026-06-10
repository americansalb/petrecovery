'use client';

/**
 * SightingBanner - the search just re-anchored, say so loudly
 *
 * Shown only in SIGHTING_HOT. One sentence of where and when, one
 * button to act on it.
 */

import { MapPin, ArrowRight } from 'lucide-react';
import { timeAgoShort } from '../../hooks/useMissionState';

export default function SightingBanner({ sighting, now, onFocus, actionLabel = 'Show me' }) {
  if (!sighting) return null;
  const when = timeAgoShort(sighting.sightedAt || sighting.createdAt, now);
  const where = sighting.address || (sighting.latitude ? `${Number(sighting.latitude).toFixed(3)}, ${Number(sighting.longitude).toFixed(3)}` : 'nearby');

  return (
    <div className="rounded-2xl border-2 border-flash-400/50 bg-flash-400/10 p-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-flash-400 flex items-center justify-center shrink-0">
        <MapPin size={20} className="text-midnight-950" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-flash-300">Sighted {when}</p>
        <p className="text-xs text-slate-300 truncate">{where}</p>
        {sighting.description && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{sighting.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onFocus}
        className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-flash-400 text-midnight-950 text-xs font-bold hover:bg-flash-300 transition active:scale-95"
      >
        {actionLabel}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
