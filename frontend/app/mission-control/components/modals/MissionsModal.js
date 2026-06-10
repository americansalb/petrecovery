'use client';

/**
 * MissionsModal - View and switch between missions
 *
 * Features preserved from original:
 * - List all available missions
 * - Show active mission indicator
 * - Mission photo, name, time missing
 * - Link to discover new cases
 */

import { X, CheckCircle2, Search } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function MissionsModal({ missions = [], activeMissionId, onSelect, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Missions</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Missions List */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {missions.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No missions yet</p>
          ) : (
            <div className="space-y-2">
              {missions.map(mission => (
                <button
                  key={mission.id}
                  onClick={() => onSelect(mission.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                    mission.id === activeMissionId
                      ? 'bg-flash-500/20 border border-flash-500/50'
                      : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {/* Pet Photo */}
                  {mission.photoUrl ? (
                    <img
                      src={normalizePhotoUrl(mission.photoUrl)}
                      alt={mission.petName}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                      {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
                    </div>
                  )}

                  {/* Mission Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate">{mission.petName}</h4>
                    <p className="text-slate-400 text-xs">{mission.timeMissing}</p>
                  </div>

                  {/* Active Indicator */}
                  {mission.id === activeMissionId && (
                    <CheckCircle2 size={20} className="text-flash-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Discover Link */}
        <div className="p-4 border-t border-slate-800">
          <a
            href="/rescue-forces"
            className="block w-full py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-center text-white font-semibold hover:border-flash-500/50 transition"
          >
            <Search size={18} className="inline mr-2" />
            Discover New Cases
          </a>
        </div>
      </div>
    </div>
  );
}
