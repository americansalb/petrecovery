'use client';

/**
 * The account ask, at the end of a game and nowhere earlier.
 *
 * The old front door had a Sign in link at the top of a settings form,
 * which asks a stranger to commit before they know whether they like
 * the thing. This asks at the only moment a player has something worth
 * keeping: they have just finished a game and can see the score.
 *
 * It is an offer, not a gate. Everything on the screen behind it
 * already happened, the result is already recorded in this browser, and
 * closing this changes nothing. So it says what an account is FOR
 * rather than what it unlocks, because it unlocks nothing: a guest and
 * a signed-in player play exactly the same game.
 *
 * It renders for guests only, and only once the game is over.
 */

import { useEffect, useState } from 'react';
import { Check, Mail } from 'lucide-react';

export default function KeepThis({ compact = false }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    // Asked of the server, because the readable cookie says only that a
    // session cookie exists and this decides what to render rather than
    // what to allow.
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live) setShow(!data?.signedIn);
      })
      .catch(() => {
        // Unknown is not a reason to nag somebody who is already signed
        // in, so silence wins.
      });
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;

  const send = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setMessage('');
    try {
      const response = await fetch('/api/geo/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState('idle');
        setMessage(body.error === 'rate_limited' ? 'Too many links asked for. Try again in a minute.' : 'That did not send. Try again.');
        return;
      }
      setState('sent');
    } catch {
      setState('idle');
      setMessage('That did not send. Try again.');
    }
  };

  if (state === 'sent') {
    return (
      <div className={`rounded-2xl border border-forest-500/40 bg-forest-900/40 p-4 text-sm text-forest-100 ${compact ? '' : 'mt-4'}`}>
        <p className="flex items-center gap-2 font-semibold">
          <Check className="h-4 w-4" />
          Check your email.
        </p>
        <p className="mt-1 text-forest-200/80">The link signs you in and keeps this game. It lasts fifteen minutes.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${compact ? '' : 'mt-4'}`} data-keep-this>
      <p className="text-sm font-semibold text-white">Keep this game</p>
      <p className="mt-1 text-sm text-white/70">
        It's free. Your score, rating and badges live in this browser, and an email address moves them to your phone too
        and brings them back if you clear it.
      </p>
      {/* method="post" is not decoration: a submit before React has
          hydrated does a real browser GET otherwise, and this field is
          an email address (__tests__/form-method.test.js). */}
      <form method="post" onSubmit={send} className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="keep-this-email">
          Your email address
        </label>
        <input
          id="keep-this-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-ocean-950/60 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-clay-400"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="inline-flex items-center gap-2 rounded-xl bg-clay-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-clay-400 disabled:opacity-60"
        >
          <Mail className="h-4 w-4" />
          {state === 'sending' ? 'Sending' : 'Send me a link'}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-clay-200">{message}</p> : null}
    </div>
  );
}
