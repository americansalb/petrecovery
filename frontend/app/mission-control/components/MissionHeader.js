'use client';

/**
 * MissionHeader - 56px of identity and truth
 *
 * Back, the pet's face and case number, and one state chip that always
 * tells the truth about the mission right now. Nothing else; the
 * screen below does the work.
 */

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function MissionHeader({ mission, state, chipLabel }) {
  const router = useRouter();

  return (
    <header className="h-14 shrink-0 z-[650] relative flex items-center justify-between gap-3 px-3 bg-slate-950/90 backdrop-blur border-b border-slate-800">
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1 px-2 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
      >
        <ChevronLeft size={20} />
        <span className="text-sm font-medium hidden sm:inline">Exit</span>
      </button>

      <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center">
        {mission?.petPhotoUrl ? (
          <img
            src={mission.petPhotoUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-700 shrink-0"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0">🐾</span>
        )}
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-bold text-white leading-tight truncate">{mission?.petName || 'Mission'}</p>
          <p className="text-[10px] text-slate-500 leading-tight truncate font-mono">
            {mission?.caseNumber || mission?.missionNumber || ''}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        {state && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${state.chipClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${state.dotClass} ${state.pulse ? 'animate-pulse' : ''}`} />
            {chipLabel}
          </span>
        )}
      </div>
    </header>
  );
}
