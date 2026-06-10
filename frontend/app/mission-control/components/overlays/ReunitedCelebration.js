'use client';

/**
 * ReunitedCelebration - the moment the whole platform exists for
 *
 * Full-screen, flash glow on midnight, confetti, the numbers that
 * tell the story, and a share button so the good news recruits the
 * next search party.
 */

import { Share2, ArrowRight } from 'lucide-react';
import ConfettiBurst from './ConfettiBurst';

function StatTile({ value, label }) {
  if (value == null) return null;
  return (
    <div className="rounded-2xl border-2 border-slate-700 bg-slate-900/80 px-3 py-3 text-center">
      <p className="text-2xl font-bold text-flash-300">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function ReunitedCelebration({ mission, stats = {}, isHelper = false, onShare, onClose }) {
  if (!mission) return null;

  return (
    <div className="fixed inset-0 z-[800] bg-midnight-950 overflow-y-auto">
      {/* Flash glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-flash-400/15 blur-3xl" />
      <ConfettiBurst />

      <div className="relative min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center py-10">
          {mission.petPhotoUrl ? (
            <img
              src={mission.petPhotoUrl}
              alt={mission.petName}
              className="w-40 h-40 rounded-full object-cover mx-auto ring-4 ring-flash-400 shadow-2xl shadow-flash-400/30"
            />
          ) : (
            <div className="w-40 h-40 rounded-full bg-slate-800 ring-4 ring-flash-400 mx-auto flex items-center justify-center text-6xl">
              🐾
            </div>
          )}

          <h1 className="text-4xl font-bold text-white mt-7">
            {mission.petName} is home.
          </h1>
          <p className="text-slate-300 mt-2">
            {isHelper
              ? `You helped bring ${mission.petName} home. This is what rescue forces are for.`
              : 'The search is over. Welcome back where you belong.'}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-7">
            <StatTile value={stats.days} label={stats.days === 1 ? 'day searching' : 'days searching'} />
            <StatTile value={stats.searchers} label={stats.searchers === 1 ? 'searcher' : 'searchers'} />
            <StatTile value={stats.miles} label="miles walked" />
            <StatTile value={stats.sightings} label={stats.sightings === 1 ? 'sighting' : 'sightings'} />
          </div>

          <button
            type="button"
            onClick={onShare}
            className="mt-7 w-full py-4 rounded-2xl bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-flash-400/25"
          >
            <Share2 size={20} />
            {isHelper ? 'Share the good news' : 'Thank the team, share the news'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full py-3 rounded-2xl text-slate-400 hover:text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition"
          >
            Back to the mission
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
