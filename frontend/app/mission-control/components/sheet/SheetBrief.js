'use client';

/**
 * SheetBrief - the half-detent: who is lost, where, and how to rally
 *
 * Pet brief card, the hot-sighting banner when one exists, the rally
 * row, the owner's reunite entry, and a short activity feed.
 */

import { MapPin, Clock, Award, HeartHandshake } from 'lucide-react';
import SightingBanner from '../regions/SightingBanner';
import RallyRow from '../regions/RallyRow';
import ActivityLog from '../regions/ActivityLog';
import { timeAgoShort } from '../../hooks/useMissionState';

function speciesEmoji(species) {
  switch ((species || '').toUpperCase()) {
    case 'DOG': return '🐕';
    case 'CAT': return '🐈';
    case 'BIRD': return '🦜';
    default: return '🐾';
  }
}

export default function SheetBrief({
  mission,
  now,
  hotSighting,
  onFocusSighting,
  isOwner,
  onMarkReunited,
  rally,
  activityItems,
  readOnly = false,
}) {
  if (!mission) return null;

  const descriptor = [mission.petBreed, mission.petColor, mission.petSize && mission.petSize.toLowerCase()]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4 pt-2">
      {hotSighting && (
        <SightingBanner sighting={hotSighting} now={now} onFocus={onFocusSighting} />
      )}

      {/* Pet brief card */}
      <div className="rounded-2xl border-2 border-slate-800 bg-slate-900 p-4">
        <div className="flex items-start gap-3.5">
          {mission.petPhotoUrl ? (
            <img
              src={mission.petPhotoUrl}
              alt={mission.petName}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-700 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl shrink-0">
              {speciesEmoji(mission.petSpecies)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">{mission.petName}</h2>
              {mission.hasReward && mission.rewardAmount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-flash-400/15 border border-flash-400/40 text-flash-300 text-[11px] font-bold">
                  <Award size={11} /> ${mission.rewardAmount} reward
                </span>
              )}
            </div>
            {descriptor && <p className="text-sm text-slate-400 truncate">{descriptor}</p>}
            <div className="mt-2 space-y-1">
              {mission.lastSeenAddress && (
                <p className="flex items-center gap-1.5 text-xs text-slate-300">
                  <MapPin size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate">{mission.lastSeenAddress}</span>
                </p>
              )}
              {mission.lastSeenAt && (
                <p className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Clock size={12} className="text-slate-500 shrink-0" />
                  Last seen {timeAgoShort(mission.lastSeenAt, now)}
                </p>
              )}
            </div>
          </div>
        </div>
        {mission.petDescription && (
          <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800 leading-relaxed line-clamp-3">
            {mission.petDescription}
          </p>
        )}
      </div>

      {!readOnly && <RallyRow {...rally} />}

      {/* The owner closes the loop right here, not on some other page */}
      {isOwner && !readOnly && (
        <button
          type="button"
          onClick={onMarkReunited}
          className="w-full py-3.5 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition active:scale-[0.98]"
        >
          <HeartHandshake size={18} />
          Found {mission.petName}? Mark as reunited
        </button>
      )}

      {/* Recent activity */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Latest activity</h3>
        <ActivityLog items={activityItems} now={now} limit={5} />
      </div>
    </div>
  );
}
