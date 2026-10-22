'use client';

/**
 * Ranked or the weekly cup, opened by a guest. Both need an account
 * (founder, 2026-10-09): a rating has to belong to one person, and the
 * cup has one entry a person and pays prizes. The server refuses a
 * guest outright (api/geo/round); this is the screen that asks first.
 *
 * It offers the account and, beside it, the same rules played as a
 * practice game, so the answer to "not yet" is still a game.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DEFAULT_CONFIG, MODES, configToParams, formatSettings } from '@/app/lib/geo/modes';
import { randomSeedString } from '@/app/lib/geo/random';
import SignInCard from '../SignInCard';

const WHY = {
  ranked: {
    title: 'Ranked needs an account',
    body: 'Ranked moves a rating, and a rating has to belong to one person. Add your email and you can play right away.',
    practice: 'Practice with Ranked rules',
  },
  cup: {
    title: 'The weekly cup needs an account',
    body: 'The cup takes one entry per person and pays prizes, so it is tied to an account. Add your email and you can play right away.',
    practice: 'Practice with cup rules',
  },
};

/** The same rules as the mode, as an ordinary World game: no board, no rating. */
export function practiceHref(mode) {
  const fixed = MODES[mode]?.fixed || MODES.ranked.fixed;
  const config = { ...DEFAULT_CONFIG, mode: 'balanced', rounds: fixed.rounds, time: fixed.time, ...formatSettings('nm'), seed: randomSeedString() };
  return `/geo/play?${configToParams(config).toString()}`;
}

export default function AccountGate({ mode = 'ranked', returnTo, onAuthenticated }) {
  const why = WHY[mode] || WHY.ranked;
  return (
    <section className="pe-account-gate" aria-labelledby="account-gate-title" data-account-gate={mode}>
      <h1 id="account-gate-title" className="ui-h1">{why.title}</h1>
      <p className="mt-2 text-pe-muted">{why.body}</p>
      <div className="mt-6">
        <SignInCard requireName returnTo={returnTo} submitLabel="Send my code" onAuthenticated={onAuthenticated} />
      </div>
      <div className="pe-account-gate-or" aria-hidden="true">
        <span />
        or
        <span />
      </div>
      <Link href={practiceHref(mode)} className="pe-account-gate-practice">
        <span>
          <strong>{why.practice}</strong>
          <small>No rating and no board. It uses one of your guest games.</small>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <Link href="/geo" className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-pe-accent-fg hover:underline">
        Back to the menu
      </Link>
    </section>
  );
}
