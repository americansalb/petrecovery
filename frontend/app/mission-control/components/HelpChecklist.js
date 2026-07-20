'use client';

/**
 * HelpChecklist - "Ways to help", ranked, with visible progress
 *
 * The old screen scattered share / flyers / shelters / sightings
 * across tabs and cards; a newcomer had to LEARN where things were.
 * This is the scaffold instead: every way to help, in impact order,
 * one tap each, with honest done-states so the next step is always
 * the first unchecked row.
 *
 * Done-states are device-local (localStorage) — encouragement, not
 * bookkeeping. ShelterList shares its called-count via the same
 * 'mc:actions' event.
 */

import { useEffect, useState, useCallback } from 'react';
import { Share2, Eye, Printer, Phone, Rocket, Check, ChevronRight } from 'lucide-react';

const ACTIONS_EVENT = 'mc:actions';

function flagsKey(missionId) {
  return `mc_actions_${missionId}`;
}

export function readLocalActions(missionId) {
  try {
    return JSON.parse(localStorage.getItem(flagsKey(missionId)) || '{}');
  } catch (e) {
    return {};
  }
}

/** Record a local action (share count, flyer flag) and notify listeners. */
export function markLocalAction(missionId, action) {
  if (!missionId) return;
  try {
    const flags = readLocalActions(missionId);
    if (action === 'share') flags.share = (flags.share || 0) + 1;
    if (action === 'flyer') flags.flyer = true;
    localStorage.setItem(flagsKey(missionId), JSON.stringify(flags));
    window.dispatchEvent(new CustomEvent(ACTIONS_EVENT));
  } catch (e) {}
}

function readCalledCount(missionId) {
  try {
    const map = JSON.parse(localStorage.getItem(`mc_called_${missionId}`) || '{}');
    return Object.values(map).filter(Boolean).length;
  } catch (e) {
    return 0;
  }
}

function Row({ icon: Icon, label, sub, done = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[52px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition hover:bg-white/[0.05] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300"
    >
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
          done
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
            : 'bg-white/[0.06] text-slate-200 border border-white/10'
        }`}
        aria-hidden
      >
        {done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-semibold truncate ${done ? 'text-slate-300' : 'text-white'}`}>{label}</span>
        <span className="block text-xs text-slate-500 truncate">{sub}</span>
      </span>
      <ChevronRight size={15} className="text-slate-600 shrink-0" aria-hidden />
    </button>
  );
}

export default function HelpChecklist({
  missionId,
  petName = 'this pet',
  sheltersTotal = 0,
  showBoost = false,
  excludeAction = null,
  highlight = false,
  onShare,
  onReportSighting,
  onFlyer,
  onCallShelters,
  onBoost,
}) {
  // Re-read device-local progress whenever any surface records an action
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    window.addEventListener(ACTIONS_EVENT, bump);
    return () => window.removeEventListener(ACTIONS_EVENT, bump);
  }, [bump]);

  const flags = typeof window !== 'undefined' && missionId ? readLocalActions(missionId) : {};
  const called = typeof window !== 'undefined' && missionId ? readCalledCount(missionId) : 0;
  const sharedCount = flags.share || 0;

  const rows = [
    {
      id: 'share',
      icon: Share2,
      label: 'Spread the word',
      sub: sharedCount > 0 ? `Shared ${sharedCount}× — every share helps` : 'Every share is another searcher',
      done: sharedCount > 0,
      onClick: onShare,
    },
    {
      id: 'sighting',
      icon: Eye,
      label: `I've seen ${petName}`,
      sub: 'Report a sighting — even if unsure',
      done: false,
      onClick: onReportSighting,
    },
    {
      id: 'flyer',
      icon: Printer,
      label: 'Print flyers',
      sub: flags.flyer ? 'Printed — post them high and low' : 'Poles, cafés, vet offices',
      done: !!flags.flyer,
      onClick: onFlyer,
    },
    {
      id: 'shelters',
      icon: Phone,
      label: 'Call nearby shelters',
      sub: sheltersTotal > 0 ? `${called} of ${sheltersTotal} called` : 'They hear about found pets first',
      done: sheltersTotal > 0 && called >= sheltersTotal,
      onClick: onCallShelters,
    },
  ];
  if (showBoost) {
    rows.push({
      id: 'boost',
      icon: Rocket,
      label: 'Boost the alert',
      sub: 'Paid reach for the neighborhood',
      done: false,
      onClick: onBoost,
    });
  }

  const shown = rows.filter((r) => r.id !== excludeAction);

  return (
    <section
      className={`rounded-2xl border bg-white/[0.03] transition ${
        highlight ? 'border-flash-400 ring-2 ring-flash-400/40 animate-pulse' : 'border-white/10'
      }`}
    >
      <h3 className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        Ways to help
      </h3>
      <div className="p-1.5 pt-0">
        {shown.map((r) => (
          <Row key={r.id} {...r} />
        ))}
      </div>
    </section>
  );
}
