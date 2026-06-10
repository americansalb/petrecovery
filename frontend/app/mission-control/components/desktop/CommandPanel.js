'use client';

/**
 * CommandPanel - the coordinator's left hand (command instrument)
 *
 * Floating glass panel over the map: vitals and the primary action
 * pinned on top, the brief scrolling beneath. Desktop coordinates and
 * documents; it never starts GPS legs.
 */

import MissionVitals from '../regions/MissionVitals';
import PrimaryCTA from '../regions/PrimaryCTA';
import SheetBrief from '../sheet/SheetBrief';

export default function CommandPanel({ vitals, cta, brief }) {
  return (
    <div className="absolute left-6 top-20 bottom-6 w-[380px] z-[600] flex flex-col rounded-2xl border-2 border-slate-700/70 bg-slate-900/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="shrink-0 p-4 pb-3 border-b border-slate-800 space-y-3">
        <MissionVitals {...vitals} />
        <PrimaryCTA {...cta} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <SheetBrief {...brief} />
      </div>
    </div>
  );
}
