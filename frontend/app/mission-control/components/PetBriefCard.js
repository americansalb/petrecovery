'use client';

/**
 * PetBriefCard - the face of the mission
 *
 * Photo, name, reward, what to look for, where and when. This is the
 * emotional anchor and the searcher's reference card; identity chips
 * instead of a dot-joined string so each fact scans on its own.
 */

import { MapPin, Clock, Award } from 'lucide-react';
import { timeAgoShort } from '../hooks/useMissionState';

function speciesEmoji(species) {
  switch ((species || '').toUpperCase()) {
    case 'DOG': return '🐕';
    case 'CAT': return '🐈';
    case 'BIRD': return '🦜';
    case 'RABBIT': return '🐇';
    default: return '🐾';
  }
}

export default function PetBriefCard({ mission, now, frameless = false }) {
  if (!mission) return null;

  const chips = [
    mission.petBreed,
    mission.petColor,
    mission.petSize && mission.petSize.charAt(0) + mission.petSize.slice(1).toLowerCase(),
  ].filter(Boolean);

  return (
    <div className={frameless ? '' : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'}>
      <div className="flex items-start gap-3.5">
        {mission.petPhotoUrl ? (
          <img
            src={mission.petPhotoUrl}
            alt={mission.petName}
            className="w-[76px] h-[76px] rounded-2xl object-cover ring-1 ring-white/20 shrink-0"
          />
        ) : (
          <div className="w-[76px] h-[76px] rounded-2xl bg-slate-800 flex items-center justify-center text-3xl shrink-0" aria-hidden>
            {speciesEmoji(mission.petSpecies)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-white leading-tight">{mission.petName}</h2>
            {mission.hasReward && mission.rewardAmount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-flash-400/15 border border-flash-400/40 text-flash-300 text-[11px] font-bold">
                <Award size={11} aria-hidden /> ${mission.rewardAmount} reward
              </span>
            )}
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {chips.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] text-slate-300">
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-1">
            {mission.lastSeenAddress && (
              <p className="flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin size={12} className="text-slate-500 shrink-0" aria-hidden />
                <span className="truncate">{mission.lastSeenAddress}</span>
              </p>
            )}
            {mission.lastSeenAt && (
              <p className="flex items-center gap-1.5 text-xs text-slate-300">
                <Clock size={12} className="text-slate-500 shrink-0" aria-hidden />
                Last seen {timeAgoShort(mission.lastSeenAt, now)}
              </p>
            )}
          </div>
        </div>
      </div>
      {mission.petDescription && (
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-white/10 leading-relaxed line-clamp-3">
          {mission.petDescription}
        </p>
      )}
    </div>
  );
}
