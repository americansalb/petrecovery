'use client';

/**
 * The end of a guest's game: save it.
 *
 * Founder, 2026-10-09: saving and competing need an account, and that
 * has to be obvious without anybody having to think about it. So this
 * comes straight after the game's own results, framed in the colour of
 * the one thing to press, with one field in it. It replaced KeepThis,
 * a quiet row that said "Sign in" and opened a form when pressed.
 *
 * What saving does is real and said plainly: making the account binds
 * this browser's play profile to it (server/profiles.js, resolveProfile),
 * so the points, the badges and a held daily score come with it, and the
 * finished game is synced to the account (lib/savedGame.js). A held
 * daily score goes on the board at that moment, at the place shown.
 *
 * Renders for guests only. A signed-in player sees nothing here.
 */

import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { ordinal } from '@/app/lib/geo/distance';
import { useGuestPass } from '../../lib/guestPass';
import SignInCard from '../SignInCard';
import { leftText } from './GuestChip';

export default function SaveScore({ returnTo = '/geo/me', held = null, className = '' }) {
  const pass = useGuestPass();
  const [saved, setSaved] = useState(false);
  if (saved) {
    return (
      <section className={`pe-save-score pe-save-score--done ${className}`} data-save-score="saved" aria-live="polite">
        <p className="pe-save-score-done">
          <Check size={18} aria-hidden="true" />
          {held?.rank ? `Saved, and your score is on the board in ${ordinal(held.rank)} place.` : 'Saved to your account.'}
        </p>
      </section>
    );
  }
  if (!pass?.guest) return null;
  const daily = Boolean(held?.finished);
  return (
    <section className={`pe-save-score ${className}`} aria-labelledby="save-score-title" data-save-score>
      <p className="pe-save-score-status">
        <Clock size={15} aria-hidden="true" />
        {daily ? 'Not posted yet. Only players with an account are on the board.' : 'Not saved to an account yet.'}
      </p>
      <h2 id="save-score-title" className="pe-display">{daily ? 'Post your score' : 'Save this score'}</h2>
      {daily && held.rank ? (
        <p className="pe-save-score-place">
          <span>Today&apos;s board</span>
          <span>
            You would be <strong className="pe-num">{ordinal(held.rank)}</strong>
          </span>
        </p>
      ) : null}
      <SignInCard requireName returnTo={returnTo} submitLabel={daily ? 'Post my score' : 'Save my score'} onAuthenticated={() => setSaved(true)} />
      <p className="pe-save-score-note">
        With an account you can play more than {pass.limit} games a day, and play Ranked and the weekly cup. As a
        guest: {leftText(pass).toLowerCase()}.
      </p>
    </section>
  );
}
