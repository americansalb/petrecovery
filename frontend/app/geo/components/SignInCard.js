'use client';

/**
 * Signing in, which for this game is an email address and nothing else.
 *
 * Probably Earth accounts are its own (docs/GEO.md, "Signing in"). A
 * player here is not a ReunitePets user and does not become one: that
 * was the founder's answer on 2026-09-10 to what a standalone account
 * means. There is no password and nothing shared with the pet site,
 * neither of which is worth telling a player: nobody arrives worried
 * about a password (founder, 2026-09-17).
 *
 * The only thing an account buys is that your profile follows you to
 * another device and survives a cleared browser. Playing needs no
 * account at all, and the copy says so rather than implying a gate.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LogOut, Mail, Trash2, UserRound } from 'lucide-react';
import { ensureProfile, profileHeaders } from '../lib/profile';
import PhoneSignIn from './PhoneSignIn';

const WHY = {
  'that-link-is-not-valid': 'That link was not valid. Ask for a new one.',
  'that-link-expired': 'That link expired. They last fifteen minutes; ask for a new one.',
  'that-link-was-already-used': 'That link had already been used. Ask for a new one.',
  unknown: 'That did not work. Ask for a new link.',
};

export default function SignInCard({ returnTo = '/geo/me', requireName = false, playerName, onPlayerNameChange, onAuthenticated, compact = false }) {
  const [email, setEmail] = useState('');
  const [localName, setLocalName] = useState('');
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [phoneAvailable, setPhoneAvailable] = useState(false);
  const [method, setMethod] = useState('email');
  const authenticatedRef = useRef(onAuthenticated);
  authenticatedRef.current = onAuthenticated;
  const name = playerName === undefined ? localName : playerName;
  const setName = (value) => {
    if (onPlayerNameChange) onPlayerNameChange(value);
    else setLocalName(value);
  };

  useEffect(() => {
    if (state !== 'sent') return;
    let alive = true;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('/api/geo/auth/me', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (alive && data?.signedIn) {
          setAccount(data);
          setState('idle');
          setMessage('Signed in.');
          window.dispatchEvent(new Event('geo:authenticated'));
          window.dispatchEvent(new Event('geo:session-changed'));
          authenticatedRef.current?.();
        }
      } catch { /* Try again when the player returns from email. */ }
      finally { checking = false; }
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();
    const timer = setInterval(check, 4000);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [state]);

  useEffect(() => {
    let alive = true;
    fetch('/api/geo/auth/options', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((data) => { if (alive) setPhoneAvailable(Boolean(data?.phone)); }).catch(() => {});
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

  useEffect(() => {
    let alive = true;
    setCheckingAccount(true);
    setAccountError('');
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Could not check your account. Your game is still here.');
        return response.json();
      })
      .then((data) => { if (alive) setAccount(data?.signedIn ? data : null); })
      .catch(() => { if (alive) setAccountError('Could not check your account. Your game is still here.'); })
      .finally(() => { if (alive) setCheckingAccount(false); });
    return () => { alive = false; };
  }, [checkAttempt]);

  const request = async (event) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      // No longer a blocker. A player coming back was made to invent a
      // name before the form would send them a link, and then the name
      // was thrown away: following the link binds the account, and the
      // account's own profile wins (accounts.js, completeSignIn), so the
      // name they had just typed onto the browser's anonymous profile
      // was discarded. Being asked to name yourself and then not being
      // remembered is what "it signs me up as a new user" feels like
      // (founder, 2026-09-22). An address is the whole of signing in;
      // somebody who ends up without a name is asked for one on the
      // profile page, where it is theirs to keep.
      // Mint the browser profile before asking for mail. The request route
      // records that profile, so following the link keeps this player\'s
      // score, badges and room identity instead of making a blank one.
      await ensureProfile(name.trim());
      const response = await fetch('/api/geo/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ email, returnTo }),
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
    try {
      const response = await fetch('/api/geo/auth/signout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      setAccount(null);
      window.dispatchEvent(new Event('geo:session-changed'));
      setMessage('Signed out. You are still playing in this browser.');
    } catch (error) { setMessage(error.message); }
  };

  const deleteAccount = async () => {
    setState('deleting');
    try {
      const response = await fetch('/api/geo/auth/delete', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not delete that account');
      setAccount(null);
      window.dispatchEvent(new Event('geo:session-changed'));
      setConfirmDelete(false);
      setState('idle');
      setMessage('Account deleted. Your contact details, profile, rating, points, badges and board scores are gone.');
    } catch (error) {
      setState('error');
      setMessage(error.message);
    }
  };

  // The card's shape while the session is checked. This used to be one
  // line of text, and the form that replaced it is a card four hundred
  // pixels tall, so the footer was shoved 367px down the page about
  // three quarters of a second in (measured: layout shift 0.12, which
  // is "poor"). The placeholders stand where the title, the two fields
  // and the button will be; nothing here is a field, so nothing can be
  // typed into before the page knows who is signed in.
  // Every state below has its own key, so going from one to the next
  // mounts a fresh element and it arrives (pe-swap) rather than
  // rewriting the one already on screen.
  if (checkingAccount) return (
    <div key="checking" className={compact ? '' : 'rounded-xl border border-white/10 p-4'}>
      <p role="status" className="text-sm font-semibold text-white/70">Checking your account…</p>
      <div aria-hidden="true">
        {!compact ? <>
          <span className="pe-skeleton mt-2 block h-3.5 w-full" />
          <span className="pe-skeleton mt-2 block h-3.5 w-3/4" />
          <span className="pe-skeleton mt-2 block h-3.5 w-1/2" />
        </> : null}
        {requireName ? <>
          <span className="pe-skeleton mt-5 block h-3.5 w-40" />
          <span className="pe-skeleton mt-2 block h-12 w-full rounded-xl" />
        </> : null}
        <span className="pe-skeleton mt-4 block h-3.5 w-16" />
        <span className="pe-skeleton mt-2 block h-12 w-full rounded-xl" />
        <span className="pe-skeleton mt-3 block h-12 w-full rounded-xl" />
        <span className="pe-skeleton mt-2 block h-3 w-2/3" />
      </div>
    </div>
  );
  if (accountError) return (
    <div key="error" className="pe-swap py-4">
      <p role="alert" className="text-sm text-white/80">{accountError}</p>
      <button type="button" className="mt-2 min-h-[44px] px-3 underline" onClick={() => setCheckAttempt((n) => n + 1)}>Check again</button>
    </div>
  );

  if (account) {
    return (
      <div key="account" className="pe-swap rounded-xl border border-white/10 p-4">
        <p className="flex items-center gap-2 font-semibold text-white">
          <Check className="h-4 w-4 text-green-400" /> Signed in as {account.email || account.account?.phone}
        </p>
        <p className="mt-1 text-sm text-white/60">Your profile follows you to any device you sign in on. This device stays signed in for 90 days.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={signOut} className="flex min-h-[44px] items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/20">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          {confirmDelete ? null : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/60 hover:bg-red-950/60 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          )}
        </div>
        {confirmDelete ? (
          <div className="pe-swap mt-3 rounded-lg border border-red-400/40 bg-red-950/60 p-3">
            <p className="text-sm font-semibold text-red-100">Delete this account?</p>
            <p className="mt-1 text-sm text-red-200">
              This removes your contact details, your profile, your rating, points, badges and results, and your scores on
              the daily and cup boards. It cannot be undone.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={state === 'deleting'}
                className="min-h-[44px] rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {state === 'deleting' ? 'Deleting' : 'Yes, delete it'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-[44px] rounded-lg bg-ocean-900/60 px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10">
                Keep it
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-2 text-sm text-white/60">{message}</p> : null}
      </div>
    );
  }

  if (method === 'phone') return <PhoneSignIn requireName={requireName} name={name} setName={setName} onUseEmail={() => setMethod('email')} onAuthenticated={(data) => { setAccount(data); setMessage('Signed in.'); authenticatedRef.current?.(); }} />;

  if (state === 'sent') return (
    <div key="sent" className="pe-swap mt-6" role="status" aria-live="polite">
      <Mail size={36} className="mb-4 text-clay-300" aria-hidden="true" />
      <h3 className="text-xl font-semibold">Check your email</h3>
      <p className="mt-2 break-words text-white/80">{email}</p>
      <p className="mt-2 text-sm text-white/70">{message}</p>
      <p className="mt-2 text-sm text-white/70">Open the link to continue. Your progress stays here.</p>
      <button type="button" className="mt-4 min-h-[44px] text-sm underline" onClick={() => setState('idle')}>Change email or resend</button>
    </div>
  );

  return (
    <div key="form" className={`pe-swap ${compact ? '' : 'rounded-xl border border-white/10 p-4'}`}>
      {!compact ? <>
      {/* One door. The old copy told everyone they were making
          something new, which is wrong half the time and is why coming
          back felt like signing up again. The same sentence has to be
          true for a first-timer and for somebody returning. */}
      <p className="font-semibold text-white">{requireName ? 'Sign in, or start an account' : 'Keep this profile across devices'}</p>
      <p className="mt-1 text-sm text-white/60">
        {requireName
          ? 'Your email is all it takes. Played before? The same address brings your player, rating and badges back.'
          : 'Your rating, points and badges live in this browser. An email address moves them to your phone too, and brings them back if you clear it.'}
      </p>
      </> : null}
      {/* method="post" so a submit before hydration does not put the address in the URL (__tests__/form-method.test.js). */}
      <form method="post" onSubmit={request} className="pe-account-form">
        {requireName ? (
          <label className="w-full text-sm font-semibold text-white/80" htmlFor="geo-signin-name">
            {/* Not required. It is only used when this address has no
                player yet; a returning account already has a name and
                this field never touches it. */}
            <span className="flex items-center gap-2"><UserRound size={16} aria-hidden="true" /> Player name <span className="font-normal text-white/45">(new players)</span></span>
            <input
              id="geo-signin-name"
              type="text"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="nickname"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label htmlFor="geo-signin-email">
          <span className="flex items-center gap-2"><Mail size={16} aria-hidden="true" /> Email</span>
        <input
          id="geo-signin-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm"
        />
        </label>
        <button
          type="submit"
          disabled={state === 'sending'}
          className="pe-button pe-button--primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Continue'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      {phoneAvailable ? <button type="button" disabled={state === 'sending'} className="mt-3 min-h-[44px] text-sm underline" onClick={() => { setMethod('phone'); setMessage(''); }}>Use a phone number instead</button> : null}
      <p className="mt-2 text-xs text-white/50">
        {state === 'sent' && requireName ? 'Check your email. The link brings you straight back here.' : 'No password. This device stays signed in for 90 days.'}
      </p>
      {message ? <p role="alert" className={`mt-2 text-sm ${state === 'error' ? 'text-red-300' : 'text-white/60'}`}>{message}</p> : null}
    </div>
  );
}
