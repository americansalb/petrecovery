'use client';

/**
 * MissionHeader - 56px of identity and truth
 *
 * Back, the pet's face, a purposeful title ("Finding Max"), the case
 * number for the record, and one state chip that always tells the
 * truth about the mission right now. The map starts exactly at its
 * bottom edge - no dead band.
 */

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function MissionHeader({ mission, state, chipLabel }) {
  const router = useRouter();
  const terminal = state?.id === 'REUNITED' || state?.id === 'CLOSED';
  const title = mission?.petName
    ? terminal
      ? mission.petName
      : `Finding ${mission.petName}`
    : 'Mission Control';

  return (
    <header className="h-14 shrink-0 z-[650] relative flex items-center justify-between gap-3 px-2.5 sm:px-4 bg-slate-950/95 backdrop-blur border-b border-white/10">
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1 px-2 py-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300"
      >
        <ChevronLeft size={20} aria-hidden />
        <span className="text-sm font-medium hidden sm:inline">Exit</span>
      </button>

      <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center">
        {mission?.petPhotoUrl ? (
          <img
            src={mission.petPhotoUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover ring-1 ring-white/25 shrink-0"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0" aria-hidden>
            🐾
          </span>
        )}
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-bold text-white leading-tight truncate">{title}</p>
          <p className="text-[10px] text-slate-500 leading-tight truncate font-mono">
            {mission?.caseNumber || mission?.missionNumber || ''}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        {state && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${state.chipClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${state.dotClass} ${state.pulse ? 'animate-pulse' : ''}`} aria-hidden />
            {chipLabel}
          </span>
        )}
      </div>
    </header>
  );
}
