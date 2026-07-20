'use client';

/**
 * SheetBrief - the half detent: how to help, then who is lost
 *
 * The checklist leads (that's what a helper opened the sheet for),
 * the pet brief card follows as the reference, the owner's reunite
 * entry stays one glance away, and the freshest activity closes it.
 * The hot-sighting banner is global (under the header), not here.
 */

import { HeartHandshake } from 'lucide-react';
import HelpChecklist from '../HelpChecklist';
import PetBriefCard from '../PetBriefCard';
import ActivityLog from '../regions/ActivityLog';

export default function SheetBrief({
  mission,
  now,
  checklist,
  activityItems,
  isOwner,
  onMarkReunited,
  readOnly = false,
}) {
  if (!mission) return null;

  return (
    <div className="space-y-4 pt-2">
      {!readOnly && <HelpChecklist {...checklist} />}

      <PetBriefCard mission={mission} now={now} />

      {isOwner && !readOnly && (
        <button
          type="button"
          onClick={onMarkReunited}
          className="w-full py-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <HeartHandshake size={18} aria-hidden />
          Found {mission.petName}? Mark as reunited
        </button>
      )}

      <section>
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Latest activity</h3>
        <ActivityLog items={activityItems} now={now} limit={5} />
      </section>
    </div>
  );
}
