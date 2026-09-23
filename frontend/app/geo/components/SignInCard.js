'use client';

/**
 * Signing in: an email address, then the six-digit code from the email.
 *
 * Founder, 2026-09-23, looking at this screen: "Very unclear. Why not
 * just have normal sign in process?" It was one form that tried to be
 * sign-in and sign-up at once: a "Player name (new players)" field above
 * the email field, two headings saying "Sign in" and "Sign in, or start
 * an account", and a paragraph explaining the difference. Then it sent
 * a link, and a link opened from a phone's mail app usually lands in
 * the mail app's own browser - which signed THAT browser in and left
 * the game's tab exactly as it was.
 *
 * So it is the normal process now, one question per screen:
 *
 *   1. Email, Continue.
 *   2. The code from the email, typed here (the email's link still
 *      works too, and this screen notices when it has been used).
 *   3. Only for a player who has no name yet: what to call them, which
 *      they can skip.
 *
 * The email's link lands on this screen with a Sign in button rather than
 * signing in by itself (api/geo/auth/verify says why: mail scanners open
 * links, and that used to spend the link and the code with it).
 *
 * Probably Earth accounts are the game's own (docs/GEO.md, "Signing
 * in"), not ReunitePets accounts. There is no password. Playing needs
 * no account at all; this is how a player keeps their progress.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, LogOut, Mail, Trash2 } from 'lucide-react';
import { DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { saveName } from '../lib/useRoom';
import PhoneSignIn from './PhoneSignIn';

const WHY = {
  'that-link-is-not-valid': 'That link was not valid. Send yourself a new code.',
  'that-link-expired': 'That link expired. Codes and links last fifteen minutes; send a new one.',
  'that-link-was-already-used': 'That link had already been used. Send yourself a new code.',
  unknown: 'That did not work. Send yourself a new code.',
};

/** What a refused link says, by the code the server gives. */
const LINK_REFUSED = {
  invalid: WHY['that-link-is-not-valid'],
  expired: WHY['that-link-expired'],
  used: WHY['that-link-was-already-used'],
};

/** The page to go to after a link, marked the way the play page expects. */
function markedSignedIn(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('signed-in', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Seconds before "Send a new code" is offered again. */
const RESEND_AFTER = 30;

function announce() {
  window.dispatchEvent(new Event('geo:authenticated'));
  window.dispatchEvent(new Event('geo:session-changed'));
}

export default function SignInCard({
  returnTo = '/geo/me',
  // Ask a player with no name yet what to call them, once they are in.
  requireName = false,
  playerName,
  onPlayerNameChange,
  onAuthenticated,
  // Where to go once signed in. Only the sign-in page sets it; a dialog
  // or a card on another screen stays where it is.
  continueTo = '',
}) {
  const router = useRouter();
  const [step, setStep] = useState('checking');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(playerName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [account, setAccount] = useState(null);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [phoneAvailable, setPhoneAvailable] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const authenticatedRef = useRef(onAuthenticated);
  authenticatedRef.current = onAuthenticated;
  const finishedRef = useRef(false);
  // The token from the email's link, when this page was opened from it:
  // null until the address has been read, '' when there is none.
  const linkRef = useRef(null);
  const viaLinkRef = useRef(false);

  // Is this browser signed in already?
  useEffect(() => {
    let alive = true;
    setStep('checking');
    if (linkRef.current === null) {
      // Opened from the email's link: keep its token, and take it out of
      // the address bar so it is not left in the history.
      const params = new URLSearchParams(window.location.search);
      linkRef.current = params.get('link') || '';
      if (linkRef.current) {
        params.delete('link');
        const rest = params.toString();
        // null, not history.state: with its own state Next takes this for
        // one of its own calls and keeps the old address, token and all,
        // as the one it writes back on its next update.
        window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
      }
    }
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('offline');
        return response.json();
      })
      .then((data) => {
        if (!alive) return;
        if (data?.signedIn) {
          setAccount(data);
          setStep('account');
        } else setStep(linkRef.current ? 'link' : 'email');
      })
      .catch(() => { if (alive) setStep('unreachable'); });
    return () => { alive = false; };
  }, [checkAttempt]);

  // Phone sign-in, where the server has it, and what a followed link
  // came back to say.
  useEffect(() => {
    let alive = true;
    fetch('/api/geo/auth/options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) setPhoneAvailable(Boolean(data?.phone)); })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const failed = params.get('sign-in-failed');
    if (failed) setError(WHY[failed] || WHY.unknown);
    return () => { alive = false; };
  }, []);

  // Waiting for the code: the email's link may be opened in this very
  // browser instead, and then there is nothing left to type.
  useEffect(() => {
    if (step !== 'code') return undefined;
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch('/api/geo/auth/me', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (alive && data?.signedIn) signedIn(data);
      } catch { /* try again on the next tick */ }
    };
    const timer = setInterval(check, 4000);
    // Coming back from the mail app: a phone fires visibilitychange, not
    // always focus, and waiting for the next tick would feel like nothing
    // happened.
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    authenticatedRef.current?.();
    // After the link, the page it returns to is told so (signed-in=1),
    // which is how a game left mid-way is carried into the account.
    if (continueTo) router.push(viaLinkRef.current ? markedSignedIn(continueTo) : continueTo);
    else setStep('account');
  };

  // Signed in, by the code or by the link. A player who already has a
  // name is done; one who does not is asked for it once, now.
  const signedIn = async (data) => {
    announce();
    let profile = null;
    try {
      profile = await ensureProfile('');
    } catch { /* the name can be set from the profile page */ }
    setAccount({ signedIn: true, email: data?.email || email || null });
    const current = profile?.name || '';
    if (current && current !== DEFAULT_PLAYER_NAME) saveName(current);
    if (requireName && (!current || current === DEFAULT_PLAYER_NAME)) {
      setStep('name');
      return;
    }
    finish();
  };

  const sendCode = async (event) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      // The browser's profile exists before the email is asked for, so
      // signing in carries this player's scores, badges and rating into
      // the account rather than starting a blank one.
      await ensureProfile('');
      const response = await fetch('/api/geo/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ email, returnTo }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not send the code. Try again in a minute.');
      if (data.code === 'logged_not_sent') setNote(data.message);
      setCode('');
      setResendIn(RESEND_AFTER);
      setStep('code');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async (value = code) => {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/geo/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ email, code: digits }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'That code did not work.');
      await signedIn(data);
    } catch (failure) {
      setError(failure.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // The one press that spends the email's link.
  const followLink = async (event) => {
    event?.preventDefault();
    if (busy || !linkRef.current) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/geo/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkRef.current, next: returnTo }),
      });
      const data = await response.json().catch(() => ({}));
      linkRef.current = '';
      if (!response.ok) throw new Error(LINK_REFUSED[data?.code] || data?.error || WHY.unknown);
      viaLinkRef.current = true;
      await signedIn(data);
    } catch (failure) {
      setError(failure.message);
      setStep('email');
    } finally {
      setBusy(false);
    }
  };

  const typeCode = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Six digits is the whole answer; nobody should have to find a button.
    if (digits.length === 6) checkCode(digits);
  };

  const saveTheName = async (event) => {
    event.preventDefault();
    const clean = name.trim().slice(0, 20);
    if (!clean) return finish();
    setBusy(true);
    setError('');
    try {
      await ensureProfile(clean);
      saveName(clean);
      onPlayerNameChange?.(clean);
      // The header shows the player's name; tell it there is one.
      window.dispatchEvent(new Event('geo:session-changed'));
      finish();
    } catch (failure) {
      setError(failure.message || 'Could not save the name. You can set it from your profile.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setError('');
    try {
      const response = await fetch('/api/geo/auth/signout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      setAccount(null);
      finishedRef.current = false;
      window.dispatchEvent(new Event('geo:session-changed'));
      setNote('Signed out. You can keep playing in this browser.');
      setStep('email');
    } catch (failure) { setError(failure.message); }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/geo/auth/delete', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not delete that account');
      setAccount(null);
      setConfirmDelete(false);
      window.dispatchEvent(new Event('geo:session-changed'));
      setNote('Account deleted. Your email, profile, rating, points, badges and board scores are gone.');
      setStep('email');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  // Each step has its own key, so moving from one to the next mounts a
  // fresh element and it arrives (pe-swap) rather than being rewritten
  // in place.
  if (step === 'checking') {
    return (
      <div key="checking" aria-busy="true">
        <p role="status" className="sr-only">Checking your account…</p>
        {/* The email step's shape - label, field, button, the line under
            it - so the card does not jump when the form replaces it. */}
        <div aria-hidden="true" className="grid gap-4">
          <span className="pe-skeleton block h-4 w-16" />
          <span className="pe-skeleton block h-12 w-full rounded-xl" />
          <span className="pe-skeleton block h-11 w-full rounded-xl" />
          <span className="pe-skeleton block h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (step === 'unreachable') {
    return (
      <div key="error" className="pe-swap grid gap-3">
        <p role="alert" className="ui-error">Could not check your account. Your game in this browser is safe.</p>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setCheckAttempt((n) => n + 1)}>
          Check again
        </button>
      </div>
    );
  }

  if (step === 'account' && account) {
    return (
      <div key="account" className="pe-swap grid gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pe-good/15 text-pe-good">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 pt-1 text-pe-muted">
            Signed in as <span className="break-all font-semibold text-pe-fg">{account.email || account.account?.phone || 'your account'}</span>
          </p>
        </div>
        <p className="ui-small">Your profile follows you to any device you sign in on. This device stays signed in for 90 days.</p>
        {confirmDelete ? (
          <div className="pe-swap grid gap-3 rounded-xl border border-pe-bad/40 bg-pe-bad/10 p-4">
            <p className="font-semibold text-pe-fg">Delete this account?</p>
            <p className="text-sm text-pe-muted">
              This removes your email, your profile, rating, points, badges and results, and your scores on the daily and
              cup boards. It cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={deleteAccount} disabled={busy} className="ui-btn ui-btn--danger">
                {busy ? 'Deleting…' : 'Yes, delete it'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="ui-btn ui-btn--ghost">
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={signOut} className="ui-btn ui-btn--secondary">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="ui-btn ui-btn--ghost">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete account
            </button>
          </div>
        )}
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
      </div>
    );
  }

  if (step === 'name') {
    return (
      <form key="name" method="post" onSubmit={saveTheName} className="pe-swap grid gap-4">
        <div>
          <p className="ui-h2">You&apos;re in</p>
          <p className="mt-1 text-sm text-pe-muted">What should other players see you as? You can change it later.</p>
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="geo-signin-name">Player name</label>
          <input
            id="geo-signin-name"
            className="ui-input"
            type="text"
            maxLength={20}
            autoComplete="nickname"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada"
          />
        </div>
        <button type="submit" disabled={busy} className="ui-btn ui-btn--primary ui-btn--block">
          {busy ? 'Saving…' : name.trim() ? 'Save and continue' : 'Continue'}
        </button>
        {name.trim() ? (
          <button type="button" onClick={finish} className="ui-btn ui-btn--ghost ui-btn--block">
            Skip for now
          </button>
        ) : null}
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
      </form>
    );
  }

  if (step === 'link') {
    return (
      <form key="link" method="post" onSubmit={followLink} className="pe-swap grid gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pe-accent/15 text-pe-accent-fg">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="ui-h2">Finish signing in</p>
            <p className="mt-1 text-sm text-pe-muted">You opened the link from your sign-in email. Press Sign in to finish.</p>
          </div>
        </div>
        <button type="submit" disabled={busy} className="ui-btn ui-btn--primary ui-btn--block" autoFocus>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm justify-self-start -ml-3"
          onClick={() => { linkRef.current = ''; setStep('email'); }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Use a different email
        </button>
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
      </form>
    );
  }

  if (step === 'phone') {
    return (
      <div key="phone" className="pe-swap">
        <PhoneSignIn onUseEmail={() => setStep('email')} onAuthenticated={(data) => signedIn(data)} />
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form
        key="code"
        method="post"
        onSubmit={(e) => { e.preventDefault(); checkCode(); }}
        className="pe-swap grid gap-4"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pe-accent/15 text-pe-accent-fg">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="ui-h2">Check your email</p>
            <p className="mt-1 text-sm text-pe-muted">
              We sent a 6-digit code to <span className="break-all font-medium text-pe-fg">{email}</span>.
            </p>
          </div>
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="geo-signin-code">Code</label>
          <input
            id="geo-signin-code"
            className="ui-input ui-input--code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            autoFocus
            value={code}
            onChange={(e) => typeCode(e.target.value)}
            placeholder="······"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby="geo-signin-code-help"
          />
          <p id="geo-signin-code-help" className="ui-hint">
            The email also has a Sign in button. Either one works, for fifteen minutes.
          </p>
        </div>
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
        {note ? <p className="ui-hint">{note}</p> : null}
        <button type="submit" disabled={busy || code.length !== 6} className="ui-btn ui-btn--primary ui-btn--block">
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm -ml-3"
            onClick={() => { setStep('email'); setError(''); setCode(''); }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Different email
          </button>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm -mr-3" disabled={busy || resendIn > 0} onClick={sendCode}>
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
          </button>
        </div>
      </form>
    );
  }

  // The first step: an address, and nothing else to decide.
  return (
    <form key="email" method="post" onSubmit={sendCode} className="pe-swap grid gap-4">
      <div className="ui-field">
        <label className="ui-label" htmlFor="geo-signin-email">Email</label>
        <input
          id="geo-signin-email"
          className="ui-input"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={error ? 'true' : undefined}
        />
      </div>
      {error ? <p role="alert" className="ui-error">{error}</p> : null}
      {note ? <p className="ui-hint">{note}</p> : null}
      <button type="submit" disabled={busy} className="ui-btn ui-btn--primary ui-btn--block">
        {busy ? 'Sending…' : 'Continue'}
      </button>
      <p className="ui-small">
        We&apos;ll email you a 6-digit code. No password. New here? This creates your free account.
      </p>
      {phoneAvailable ? (
        <button type="button" disabled={busy} className="ui-btn ui-btn--ghost ui-btn--block" onClick={() => { setError(''); setStep('phone'); }}>
          Use a phone number instead
        </button>
      ) : null}
    </form>
  );
}
