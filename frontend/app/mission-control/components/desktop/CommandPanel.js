'use client';

/**
 * CommandPanel - the mission panel (command instrument)
 *
 * The left hand answers the three questions top-to-bottom: the face
 * (who), the vitals band (how it's going), the ActionDock (what to do
 * right now), then the ranked ways to help and the freshest activity.
 * The owner's "mark as reunited" is a pinned footer — always one
 * glance away, never buried mid-scroll.
 */

import { HeartHandshake } from 'lucide-react';
import PetBriefCard from '../PetBriefCard';
import MissionVitals from '../regions/MissionVitals';
import ActionDock from '../ActionDock';
import HelpChecklist from '../HelpChecklist';
import ActivityLog from '../regions/ActivityLog';

export default function CommandPanel({
  mission,
  now,
  vitals,
  dock,
  checklist,
  activityItems,
  isOwner,
  onMarkReunited,
  readOnly = false,
}) {
  return (
    <div className="absolute left-6 top-4 bottom-6 w-[400px] z-[600] flex flex-col rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Who */}
      <div className="shrink-0 p-4 pb-3">
        <PetBriefCard mission={mission} now={now} frameless />
      </div>

      {/* How it's going */}
      <div className="shrink-0 px-4 py-2.5 border-y border-white/10 bg-white/[0.02]">
        <MissionVitals {...vitals} />
      </div>

      {/* What to do right now */}
      <div className="shrink-0 p-4 pb-3">
        <ActionDock {...dock} />
      </div>

      {/* Everything else, ranked */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]">
        {!readOnly && <HelpChecklist {...checklist} />}
        <section>
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Latest activity
          </h3>
          <ActivityLog items={activityItems} now={now} limit={6} />
        </section>
      </div>

      {/* The owner closes the loop right here */}
      {isOwner && !readOnly && (
        <div className="shrink-0 p-3 border-t border-white/10">
          <button
            type="button"
            onClick={onMarkReunited}
            className="w-full py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <HeartHandshake size={17} aria-hidden />
            Found {mission?.petName}? Mark as reunited
          </button>
        </div>
      )}
    </div>
  );
}
