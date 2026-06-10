'use client';

/**
 * MissionVitals - one glance, four truths
 *
 * Elapsed time, sightings, searchers, and data freshness. Lives in the
 * sheet peek and the command panel; everything else on screen is action.
 */

import { Clock, Eye, Users } from 'lucide-react';

export default function MissionVitals({ missingFor, sightingsCount = 0, searchersActive = 0, updatedAgo }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3.5 text-sm">
        <span className="flex items-center gap-1.5">
          <Clock size={14} className="text-slate-500" />
          <span className="font-bold text-white">{missingFor || '--'}</span>
          <span className="text-slate-400 text-xs">missing</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Eye size={14} className="text-slate-500" />
          <span className="font-bold text-white">{sightingsCount}</span>
          <span className="text-slate-400 text-xs">{sightingsCount === 1 ? 'sighting' : 'sightings'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={14} className="text-slate-500" />
          <span className="font-bold text-white">{searchersActive}</span>
          <span className="text-slate-400 text-xs">searching</span>
        </span>
      </div>
      {updatedAgo && (
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {updatedAgo === 'just now' ? 'live' : `updated ${updatedAgo}`}
        </span>
      )}
    </div>
  );
}
