'use client';

/**
 * The guest games are used up for today (server/guestPass.js). Said
 * once, plainly, with the two ways on: make an account and keep playing
 * now, or come back as a guest when the day turns over.
 *
 * `network` is the address backstop running out rather than this
 * browser's own three games, and it says so: a person on a shared
 * network is not told they played games they never played.
 */

import Link from 'next/link';
import SignInCard from '../SignInCard';
import { untilReset } from '../../lib/guestPass';

export default function GuestLimit({ resetAt, network = false, limit = 3, returnTo = '/geo', onAuthenticated, compact = false }) {
  return (
    <section className={`pe-guest-limit ${compact ? 'pe-guest-limit--compact' : ''}`} aria-labelledby="guest-limit-title" data-guest-limit>
      <div className="pe-guest-limit-copy">
        <h1 id="guest-limit-title" className="pe-display">
          {network ? 'Guest games on this network are used up for today' : `You've played your ${limit} guest games today`}
        </h1>
        <p>
          Make an account to keep playing now. Your points and today&apos;s daily score come with you.
        </p>
        {resetAt ? (
          <p className="pe-guest-limit-later">
            Or come back as a guest in <span className="pe-num">{untilReset(resetAt)}</span>.
          </p>
        ) : null}
        {compact ? null : (
          <Link href="/geo" className="pe-guest-limit-back">
            Back to the menu
          </Link>
        )}
      </div>
      <div className="pe-guest-limit-form">
        <SignInCard requireName returnTo={returnTo} submitLabel="Keep playing" onAuthenticated={onAuthenticated} />
      </div>
    </section>
  );
}
