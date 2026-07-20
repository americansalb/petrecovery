'use client';

/**
 * ActionDock - question 1 and question 2, answered in one block
 *
 * One plain sentence of what is happening (the situation line), then
 * exactly ONE yellow button: the single best thing this person can do
 * right now, resolved from (state x role x instrument) by a config
 * map. Everything else on screen is quiet; the ranked rest lives in
 * HelpChecklist, which excludes whatever is primary here so nothing
 * is ever offered twice.
 */

import { Navigation, Eye, Share2, UserPlus, PartyPopper, Loader2, MapPin } from 'lucide-react';
import { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { ROLES } from '../hooks/useMissionState';

/** Which checklist row the primary button replaces (null = none). */
export function getPrimaryActionId(stateId, role, instrument) {
  if (stateId === 'REUNITED' || stateId === 'CLOSED') return null;
  if (role === ROLES.VISITOR) return 'join';
  if (stateId === 'SIGHTING_HOT') return instrument === INSTRUMENTS.FIELD ? 'heading' : 'sighting';
  if (instrument === INSTRUMENTS.FIELD) return 'track';
  if (stateId === 'JUST_REPORTED') return 'share';
  return 'sighting';
}

export function buildSituationLine({ stateId, role, petName = 'this pet', searchersActive = 0, hotWhen = null }) {
  switch (stateId) {
    case 'REUNITED':
      return `${petName} is home safe.`;
    case 'CLOSED':
      return 'This search has ended. Thank you for caring.';
    case 'SIGHTING_HOT':
      return hotWhen ? `Fresh sighting ${hotWhen} — the trail is warm.` : 'Fresh sighting — the trail is warm.';
    case 'SEARCH_LIVE':
      return searchersActive > 0
        ? `${searchersActive} ${searchersActive === 1 ? 'neighbor is' : 'neighbors are'} out searching right now.`
        : 'The search is live.';
    default:
      return role === ROLES.OWNER
        ? 'The first hours matter most — rally your neighbors.'
        : `Nobody is out searching yet. ${petName} needs eyes.`;
  }
}

const base =
  'w-full min-h-[52px] py-3.5 px-4 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300';
const styles = {
  flash: `${base} bg-flash-400 hover:bg-flash-300 text-midnight-950 shadow-lg shadow-flash-400/20`,
  emerald: `${base} bg-emerald-500 hover:bg-emerald-400 text-midnight-950 shadow-lg shadow-emerald-500/20`,
  quiet: `${base} bg-white/[0.06] border border-white/10 text-white hover:bg-white/10`,
};

function Btn({ style, icon: Icon, label, onClick, busy, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={styles[style]}>
      {busy ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      <span>{label}</span>
    </button>
  );
}

export default function ActionDock({
  stateId,
  role,
  instrument,
  resolving = false,
  petName = 'this pet',
  searchersActive = 0,
  hotWhen = null,
  isStarting = false,
  isJoining = false,
  onStartLeg,
  onReportSighting,
  onShare,
  onHeadingThere,
  onJoin,
  onSeeCelebration,
  showSituation = true,
}) {
  const situation = buildSituationLine({ stateId, role, petName, searchersActive, hotWhen });

  let button = null;
  if (resolving) {
    button = (
      <button type="button" disabled className={styles.quiet} aria-label="Loading">
        <Loader2 size={20} className="animate-spin" />
      </button>
    );
  } else if (stateId === 'REUNITED') {
    button = <Btn style="emerald" icon={PartyPopper} label="See the celebration" onClick={onSeeCelebration} />;
  } else if (stateId === 'CLOSED') {
    button = null;
  } else if (role === ROLES.VISITOR) {
    // A visitor may have arrived BECAUSE they saw the pet — that path
    // can never hide behind joining, so this is the one two-button dock.
    button = (
      <div className="space-y-2">
        <Btn style="flash" icon={UserPlus} label="Join the search party" onClick={onJoin} busy={isJoining} />
        <Btn style="quiet" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />
      </div>
    );
  } else if (stateId === 'SIGHTING_HOT') {
    button =
      instrument === INSTRUMENTS.FIELD ? (
        <Btn style="flash" icon={MapPin} label="I'm heading there" onClick={onHeadingThere} busy={isStarting} />
      ) : (
        <Btn style="flash" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />
      );
  } else if (instrument === INSTRUMENTS.FIELD) {
    button = <Btn style="flash" icon={Navigation} label="Start tracked search" onClick={onStartLeg} busy={isStarting} />;
  } else if (stateId === 'JUST_REPORTED') {
    button = <Btn style="flash" icon={Share2} label="Share the alert" onClick={onShare} />;
  } else {
    button = <Btn style="flash" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />;
  }

  return (
    <div className="space-y-2.5">
      {showSituation && (
        <p className="text-[13px] leading-snug text-slate-300">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-flash-400 mr-2 align-middle" aria-hidden />
          {situation}
        </p>
      )}
      {button}
    </div>
  );
}
