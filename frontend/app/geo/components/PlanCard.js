'use client';

/**
 * What this account is, on the profile page.
 *
 * The three layers exist server side (app/lib/geo/server/roles.js) and
 * a player should be able to see which ones apply to them without
 * guessing from behaviour. So this says the tier, what it is worth
 * today, and nothing about what a different tier might cost: pricing
 * copy is present tense and states facts, and the paid tier is not on
 * sale yet.
 *
 * A guest sees nothing here. There is no account to describe, and a
 * page that advertises tiers at somebody who has not signed in is the
 * front door's old mistake moved to a new screen.
 */

import { useEffect, useState } from 'react';
import { Check, ShieldCheck, Sparkles } from 'lucide-react';

/** The benefit lines, in the order they matter to somebody playing. */
function benefitLines(benefits) {
  if (!benefits) return [];
  return [
    benefits.googleRoundsMultiplier > 1 ? `${benefits.googleRoundsMultiplier} times the free Google Street View rounds a day` : 'The daily free Google Street View rounds',
    benefits.roomGamesMultiplier > 1 ? `${benefits.roomGamesMultiplier} times the free rooms on Google Street View` : 'One free room a day on Google Street View',
    benefits.privateRooms ? 'Private rooms' : null,
    'Apple Look Around, the daily challenge and the weekly cup without limit',
  ].filter(Boolean);
}

export default function PlanCard() {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    let live = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live && data?.signedIn) setAccount(data.account || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!account) return null;

  const supporter = account.tier === 'supporter';
  const lines = benefitLines(account.benefits);

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5" data-plan>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sand-500">
        <Sparkles className="h-4 w-4" />
        Your plan
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${supporter ? 'bg-forest-600 text-white' : 'bg-sand-200 text-sand-800'}`}>
          {account.benefits?.label || (supporter ? 'Supporter' : 'Free')}
        </span>
        {account.role !== 'player' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-ocean-100 px-3 py-1 text-sm font-bold text-ocean-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            {account.role === 'admin' ? 'Admin' : 'Host'}
          </span>
        ) : null}
      </p>
      {supporter && account.tierUntil ? (
        <p className="mt-2 text-sm text-sand-600">Runs until {account.tierUntil.slice(0, 10)}.</p>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-sand-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
            {line}
          </li>
        ))}
      </ul>
      {!supporter ? (
        <p className="mt-3 text-xs text-sand-500">
          Every mode, map and ladder is on this plan. Supporter raises the Google Street View limits and nothing else.
        </p>
      ) : null}
    </section>
  );
}
