'use client';

/**
 * Signing in, which for this game is an email address and nothing else.
 *
 * WanderGuesser accounts are its own (docs/GEO.md, "Signing in"). A
 * player here is not a ReunitePets user and does not become one: that
 * was the founder's answer on 2026-09-10 to what a standalone account
 * means. So there is no password, no profile to fill in, and nothing
 * shared with the pet site.
 *
 * The only thing an account buys is that your profile follows you to
 * another device and survives a cleared browser. Playing needs no
 * account at all, and the copy says so rather than implying a gate.
 */

import { useEffect, useState } from 'react';
import { Check, LogOut, Mail } from 'lucide-react';

const WHY = {
  'that-link-is-not-valid': 'That link was not valid. Ask for a new one.',
  'that-link-expired': 'That link expired. They last fifteen minutes; ask for a new one.',
  'that-link-was-already-used': 'That link had already been used. Ask for a new one.',
  unknown: 'That did not work. Ask for a new link.',
};

export default function SignInCard() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/geo/auth/me')
      .then((r) => r.json())
      .then((d) => alive && setAccount(d?.signedIn ? d : null))
      .catch(() => {});
    // A redirect back from the emailed link carries what happened.
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed-in')) setMessage('Signed in.');
    const failed = params.get('sign-in-failed');
    if (failed) {
      setState('error');
      setMessage(WHY[failed] || WHY.unknown);
    }
    return () => {
      alive = false;
    };
  }, []);

  const request = async (event) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      const response = await fetch('/api/geo/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not send that link');
      setState('sent');
      setMessage(data.message || 'Check your email.');
    } catch (error) {
      setState('error');
      setMessage(error.message);
    }
  };

  const signOut = async () => {
    await fetch('/api/geo/auth/signout', { method: 'POST' }).catch(() => {});
    setAccount(null);
    setMessage('Signed out. You are still playing in this browser.');
  };

  if (account) {
    return (
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="flex items-center gap-2 font-semibold text-gray-900">
          <Check className="h-4 w-4 text-green-600" /> Signed in as {account.email}
        </p>
        <p className="mt-1 text-sm text-gray-600">Your profile follows you to any device you sign in on.</p>
        <button type="button" onClick={signOut} className="mt-3 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-200">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        {message ? <p className="mt-2 text-sm text-gray-600">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="font-semibold text-gray-900">Keep this profile across devices</p>
      <p className="mt-1 text-sm text-gray-600">
        Give an email address and we send a link. No password. You do not need an account to play; it only keeps your
        rating, points and badges if you change browser or phone.
      </p>
      {/* method="post" so a submit before hydration does not put the address in the URL (__tests__/form-method.test.js). */}
      <form method="post" onSubmit={request} className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="geo-signin-email">
          Email address
        </label>
        <input
          id="geo-signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="flex items-center gap-2 rounded-lg bg-flash-500 px-4 py-2 text-sm font-semibold text-midnight-950 transition enabled:hover:bg-flash-400 disabled:opacity-60"
        >
          <Mail className="h-4 w-4" /> {state === 'sending' ? 'Sending' : 'Send link'}
        </button>
      </form>
      {message ? <p className={`mt-2 text-sm ${state === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{message}</p> : null}
    </div>
  );
}
