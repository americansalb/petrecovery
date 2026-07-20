'use client';

/**
 * HotSightingBanner - the search just re-anchored; the whole screen says so
 *
 * Full-width strip directly under the header, only while a sighting is
 * under an hour old (SIGHTING_HOT). One line of where and when, one
 * button that flies the map there. In flow, not floating: the map and
 * sheet simply start below it.
 */

import { MapPin, ArrowRight } from 'lucide-react';
import { timeAgoShort } from '../hooks/useMissionState';

export default function HotSightingBanner({ sighting, now, onFocus }) {
  if (!sighting) return null;
  const when = timeAgoShort(sighting.sightedAt || sighting.createdAt, now);
  const where =
    sighting.address ||
    (sighting.latitude ? `${Number(sighting.latitude).toFixed(3)}, ${Number(sighting.longitude).toFixed(3)}` : 'nearby');

  return (
    <div className="relative z-[640] shrink-0 bg-amber-400/[0.12] border-b border-amber-400/30 backdrop-blur">
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2">
        <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
        </span>
        <p className="flex-1 min-w-0 text-sm text-amber-100 truncate">
          <span className="font-bold text-amber-300">Sighted {when}</span>
          <span className="text-amber-200/70"> · {where}</span>
          {sighting.description && <span className="hidden sm:inline text-amber-200/60"> · “{sighting.description}”</span>}
        </p>
        <button
          type="button"
          onClick={onFocus}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-midnight-950 text-xs font-bold hover:bg-amber-300 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <MapPin size={13} aria-hidden />
          Show me
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
