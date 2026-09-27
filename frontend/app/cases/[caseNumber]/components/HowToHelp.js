'use client';

/**
 * "How you can help" on a pet's page: everything someone can do for this
 * pet, in one place. Search on the map (Mission Control: this button is the
 * one way in from the pet's page), the next search party, the needs the
 * Rescue Force looking for the pet has for it, what anyone can do (share,
 * check shelters, print a flyer), and what is already done, so nobody does
 * it twice.
 *
 * The force's part comes from /api/public/missions/[caseNumber]/help
 * (app/lib/petRoom.js). Taking a need posts to the force's needs route.
 * Someone who is not a member is asked to join first (`onJoin`), and the
 * need they tapped (or "I am going") goes through once they are in.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Map as MapIcon } from 'lucide-react';
import NeedCard from '@/app/components/help/NeedCard';
import SearchPartyCard from '@/app/components/help/SearchPartyCard';
import { timeAgo } from '@/app/lib/caseLabels';
import WaysToHelp from './WaysToHelp';

const DONE_SHOWN = 5;

export default function HowToHelp({ name, lost, room, searchHref, ways, onJoin, onChanged }) {
  const [active, setActive] = useState(null); // `${needId}:${action}` while it goes through
  const [errors, setErrors] = useState({});
  const force = room?.force || null;
  const member = Boolean(room?.member);
  const needs = room?.needs || [];
  const done = room?.done || [];
  const party = force ? room?.party || null : null;
  const searching = room?.searchingNow || 0;

  async function doAct(need, action) {
    setActive(`${need.id}:${action}`);
    setErrors((e) => ({ ...e, [need.id]: '' }));
    try {
      const res = await fetch(`/api/rescue-forces/${force.id}/needs/${need.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'That did not go through. Try again in a moment.');
      await onChanged();
    } catch (e) {
      setErrors((x) => ({ ...x, [need.id]: e.message }));
    }
    setActive(null);
  }

  const act = (need, action) => (member ? doAct(need, action) : onJoin(() => doAct(need, action)));

  // "I am going" from someone who just joined: say yes for them.
  async function goAfterJoining() {
    await fetch(`/api/rescue-forces/${force.id}/posts/${party.id}/going`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ going: true }),
    }).catch(() => {});
    await onChanged();
  }

  if (!lost && !party && !needs.length && !ways.length) return null;

  return (
    <section aria-labelledby="help-heading" className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6">
      <h2 id="help-heading" className="text-lg font-semibold text-midnight-900">
        How you can help
      </h2>
      {force && (
        <p className="mt-1 text-midnight-600">
          <Link
            href={`/rescue-forces/${force.id}`}
            className="inline min-h-0 min-w-0 font-semibold text-midnight-800 underline underline-offset-2 hover:text-midnight-950"
          >
            {force.name}
          </Link>{' '}
          is looking for {name}.
        </p>
      )}

      {(lost || party || needs.length > 0) && (
        <div className="mt-4 space-y-3">
          {lost && (
            <Link
              href={searchHref}
              className="flex items-center gap-3 rounded-2xl bg-midnight-900 p-4 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-flash-400">
                <MapIcon size={22} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Search on the map</span>
                <span className="block text-sm text-midnight-200">
                  {searching > 0
                    ? `${searching} ${searching === 1 ? 'person is' : 'people are'} searching right now`
                    : 'See which blocks still need searching'}
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-midnight-300" aria-hidden="true" />
            </Link>
          )}

          {party && (
            <SearchPartyCard
              party={party}
              forceId={force.id}
              heading={`Search for ${name}`}
              canGo={member}
              onJoin={() => onJoin(goAfterJoining)}
              placeNote={`Join ${force.name} to see where to meet.`}
              onChanged={onChanged}
            />
          )}

          {needs.length > 0 && (
            <ul className="space-y-3" aria-label={`What ${force.name} needs for ${name}`}>
              {needs.map((n) => (
                <NeedCard
                  key={n.id}
                  need={n}
                  working={active !== null}
                  spinning={active?.startsWith(`${n.id}:`) ? active.slice(n.id.length + 1) : null}
                  error={errors[n.id]}
                  onAct={(action) => act(n, action)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {ways.length > 0 && (
        <div className="-mx-5 mt-4 border-t border-midnight-100 sm:-mx-6">
          <WaysToHelp items={ways} />
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-2 border-t border-midnight-100 pt-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-midnight-500">Already done</h3>
          <ul className="mt-2 space-y-2.5">
            {done.slice(0, DONE_SHOWN).map((d) => (
              <li key={d.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-700" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 text-[15px] text-midnight-800">{d.text}</span>
                <span className="shrink-0 text-sm text-midnight-500">{timeAgo(d.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
