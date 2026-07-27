'use client';

/**
 * MissionVitals - one glance, three truths and a heartbeat
 *
 * Elapsed time, sightings, searchers, and the live dot. Two shapes:
 * stacked stats for the command panel, a compact inline row for the
 * sheet peek. Data only - meaning lives in the ActionDock's
 * situation line.
 */

import { Clock, Eye, Users } from 'lucide-react';

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-white leading-none tabular-nums">{value}</span>
      </div>
      <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
        <Icon size={11} aria-hidden />
        {label}
      </div>
    </div>
  );
}

export default function MissionVitals({
  missingFor,
  sightingsCount = 0,
  searchersActive = 0,
  live = true,
  compact = false,
  // Archived missions tell a finished story: "3d searched", no pulse
  archived = false,
  searchedFor = null,
}) {
  const timeValue = archived && searchedFor ? searchedFor : missingFor;
  const timeLabel = archived && searchedFor ? 'searched' : 'missing';
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <Clock size={13} className="text-slate-500" aria-hidden />
            <span className="font-bold text-white tabular-nums">{timeValue || '--'}</span>
            <span className="text-slate-500 text-xs">{timeLabel}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Eye size={13} className="text-slate-500" aria-hidden />
            <span className="font-bold text-white tabular-nums">{sightingsCount}</span>
            <span className="text-slate-500 text-xs">{sightingsCount === 1 ? 'sighting' : 'sightings'}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Users size={13} className="text-slate-500" aria-hidden />
            <span className="font-bold text-white tabular-nums">{searchersActive}</span>
            <span className="text-slate-500 text-xs">searching</span>
          </span>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            live
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Stat icon={Clock} value={timeValue || '--'} label={timeLabel} />
      <div className="w-px h-8 bg-white/10" aria-hidden />
      <Stat icon={Eye} value={sightingsCount} label={sightingsCount === 1 ? 'sighting' : 'sightings'} />
      <div className="w-px h-8 bg-white/10" aria-hidden />
      <Stat icon={Users} value={searchersActive} label="searching" />
      {live && (
        <span className="self-start flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          live
        </span>
      )}
    </div>
  );
}
