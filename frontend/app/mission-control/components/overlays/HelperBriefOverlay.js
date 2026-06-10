'use client';

/**
 * HelperBriefOverlay - the 10-second brief
 *
 * A first-time helper knows nothing. One screen: the face, the place,
 * the rule, one button. Shown once per mission per device.
 */

import { MapPin, Clock } from 'lucide-react';
import { timeAgoShort } from '../../hooks/useMissionState';

export default function HelperBriefOverlay({ mission, now, onStart }) {
  if (!mission) return null;

  return (
    <div className="fixed inset-0 z-[800] bg-midnight-950/97 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {mission.petPhotoUrl ? (
          <img
            src={mission.petPhotoUrl}
            alt={mission.petName}
            className="w-36 h-36 rounded-3xl object-cover mx-auto ring-4 ring-flash-400 shadow-2xl shadow-flash-400/20"
          />
        ) : (
          <div className="w-36 h-36 rounded-3xl bg-slate-800 ring-4 ring-flash-400 mx-auto flex items-center justify-center text-6xl">
            🐾
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mt-6">
          Help find {mission.petName}
        </h1>

        <div className="mt-4 space-y-2">
          {mission.lastSeenAddress && (
            <p className="flex items-center justify-center gap-2 text-slate-300 text-sm">
              <MapPin size={15} className="text-flash-400" />
              {mission.lastSeenAddress}
            </p>
          )}
          {mission.lastSeenAt && (
            <p className="flex items-center justify-center gap-2 text-slate-300 text-sm">
              <Clock size={15} className="text-flash-400" />
              Last seen {timeAgoShort(mission.lastSeenAt, now)}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border-2 border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-200 font-semibold">
            Do not chase. A scared pet runs from strangers.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Stay calm, keep your distance, and report exactly what you see.
            That is how pets come home.
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-6 w-full py-4 rounded-2xl bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold text-lg transition active:scale-[0.98] shadow-lg shadow-flash-400/25"
        >
          Start helping
        </button>
      </div>
    </div>
  );
}
