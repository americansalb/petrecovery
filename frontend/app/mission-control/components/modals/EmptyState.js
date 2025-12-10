'use client';

/**
 * EmptyState - No mission selected view
 *
 * Features preserved from original:
 * - Mission Control branding
 * - List of available missions (if any)
 * - Link to join a rescue squad
 * - Refresh button
 */

import { Radio, RefreshCw, ChevronRight } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function EmptyState({ missions = [], onSelectMission, onRefresh }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-flash-500/20 border-2 border-flash-500/30 mb-6">
          <Radio size={48} className="text-flash-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">My Missions</h1>
        <p className="text-slate-400">Your active rescue missions in one place</p>
      </div>

      {/* Missions List or Empty CTA */}
      {missions && missions.length > 0 ? (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Your Missions ({missions.length})</h3>
            <button
              onClick={onRefresh}
              className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {missions.slice(0, 5).map(mission => (
              <button
                key={mission.id}
                onClick={() => onSelectMission(mission.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-flash-500/50 transition text-left group"
              >
                {/* Pet Photo */}
                {mission.photoUrl ? (
                  <img
                    src={normalizePhotoUrl(mission.photoUrl)}
                    alt={mission.petName}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-2xl">
                    {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
                  </div>
                )}

                {/* Mission Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold truncate">{mission.petName}</h4>
                  <p className="text-slate-400 text-sm">
                    {mission.timeMissing} • {mission.helperCount || 0} helpers
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={20}
                  className="text-slate-500 flex-shrink-0 group-hover:text-flash-400 transition"
                />
              </button>
            ))}

            {missions.length > 5 && (
              <p className="text-slate-500 text-sm text-center">
                + {missions.length - 5} more missions
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-slate-400 mb-6">No active missions yet</p>
          <a
            href="/rescue-squads"
            className="inline-block px-6 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl text-lg hover:bg-flash-400 transition hover:scale-105"
          >
            Join a Rescue Squad
          </a>
        </div>
      )}
    </div>
  );
}
