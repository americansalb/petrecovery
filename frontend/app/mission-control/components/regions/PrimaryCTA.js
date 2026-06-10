'use client';

/**
 * PrimaryCTA - the ONE action this screen wants from this person now
 *
 * Resolved from (mission state x role x instrument) by a config map,
 * never by scattered if-chains. Every other button on the screen is
 * secondary; this component is the only place a primary lives.
 *
 * Doctrine: GPS legs are field-only. Command documents. Bridge reports
 * and rallies.
 */

import { Navigation, Eye, Share2, UserPlus, PartyPopper, Loader2, MapPin } from 'lucide-react';
import { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { ROLES } from '../../hooks/useMissionState';

const base = 'w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100';
const styles = {
  flash: `${base} bg-flash-400 hover:bg-flash-300 text-midnight-950 shadow-lg shadow-flash-400/25`,
  emerald: `${base} bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25`,
  quiet: `${base} bg-slate-800 border-2 border-slate-700 text-white hover:bg-slate-700`,
};

function Btn({ style, icon: Icon, label, onClick, busy, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={styles[style]}>
      {busy ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      <span>{label}</span>
    </button>
  );
}

export default function PrimaryCTA({
  stateId,
  role,
  instrument,
  resolving = false,
  petName = 'this pet',
  isStarting = false,
  isJoining = false,
  onStartLeg,
  onReportSighting,
  onShare,
  onHeadingThere,
  onJoin,
  onSeeCelebration,
}) {
  // Instrument still resolving (native check): hold the CTA for a beat
  // rather than flashing the wrong one
  if (resolving) {
    return (
      <button type="button" disabled className={styles.quiet}>
        <Loader2 size={20} className="animate-spin" />
      </button>
    );
  }

  // Terminal states
  if (stateId === 'REUNITED') {
    return <Btn style="emerald" icon={PartyPopper} label="See the celebration" onClick={onSeeCelebration} />;
  }
  if (stateId === 'CLOSED') {
    return (
      <p className="text-center text-sm text-slate-500 py-3">
        This case is closed. Thank you to everyone who helped.
      </p>
    );
  }

  // A logged-in stranger's first move is joining, on every instrument
  if (role === ROLES.VISITOR) {
    return (
      <div className="space-y-2">
        <Btn style="flash" icon={UserPlus} label="Join the search party" onClick={onJoin} busy={isJoining} />
        <Btn style="quiet" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />
      </div>
    );
  }

  // A hot sighting re-anchors everyone
  if (stateId === 'SIGHTING_HOT') {
    if (instrument === INSTRUMENTS.FIELD) {
      return <Btn style="flash" icon={MapPin} label="I'm heading there" onClick={onHeadingThere} busy={isStarting} />;
    }
    return <Btn style="flash" icon={Eye} label="Log a follow-up sighting" onClick={onReportSighting} />;
  }

  // JUST_REPORTED and SEARCH_LIVE
  if (instrument === INSTRUMENTS.FIELD) {
    if (stateId === 'JUST_REPORTED') {
      return (
        <div className="space-y-2">
          <Btn style="flash" icon={Share2} label="Share the alert" onClick={onShare} />
          <Btn style="emerald" icon={Navigation} label="Start GPS search" onClick={onStartLeg} busy={isStarting} />
        </div>
      );
    }
    return <Btn style="emerald" icon={Navigation} label="Start GPS search" onClick={onStartLeg} busy={isStarting} />;
  }

  // Command documents; bridge reports and rallies. Same pair, share
  // leads while nobody is searching yet.
  if (stateId === 'JUST_REPORTED') {
    return (
      <div className="space-y-2">
        <Btn style="flash" icon={Share2} label="Share the alert" onClick={onShare} />
        <Btn style="quiet" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />
      </div>
    );
  }
  return <Btn style="flash" icon={Eye} label={`I've seen ${petName}`} onClick={onReportSighting} />;
}
