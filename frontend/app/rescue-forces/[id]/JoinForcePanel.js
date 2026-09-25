'use client';

/**
 * Join a Rescue Force from its page, signed in or not.
 *
 * Signed in: one tap, and the server page re-renders you as a member.
 *
 * Signed out: the form opens in place. Someone new signs up and asks to
 * join in one step (POST /api/auth/register with joinForceId). The
 * membership starts when they confirm their email (POST
 * /api/auth/verify-email), and the confirm page sends them back here.
 * Someone with an account signs in here and joins in the same step.
 *
 * This replaced a Join link to /login. Its "Sign up" link dropped the way
 * back, sign-up was five screens and a confirmation email, and at the end
 * you landed on the dashboard and had to find the force and press Join
 * again.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2, UserPlus, Eye, EyeOff, Mail } from 'lucide-react';
import { captchaHeaders } from '@/app/lib/captchaClient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PRIMARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flash-400 px-5 py-3 font-semibold text-midnight-900 shadow-sm transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:opacity-60';
const INPUT =
  'w-full rounded-xl border-2 border-midnight-200 bg-white px-3.5 py-2.5 text-midnight-900 outline-none transition placeholder:text-midnight-300 focus:border-flash-400 focus:ring-2 focus:ring-flash-100';
const LABEL = 'mb-1 block text-sm font-semibold text-midnight-700';
// Inline: the global touch-target rule (globals.css) gives every button a
// 44px minimum height, which breaks a text action out of its sentence.
const TEXT_BUTTON = 'inline min-h-0 min-w-0 p-0 font-semibold text-midnight-800 underline underline-offset-2 hover:text-midnight-950';

function WhatMembersGet() {
  return (
    <p className="mt-2 text-sm text-midnight-500">
      Members see each pet reported lost in this area in the force&apos;s updates, and talk in its chat.
    </p>
  );
}

export default function JoinForcePanel({ forceId, forceName, signedIn }) {
  const router = useRouter();
  const [mode, setMode] = useState('closed'); // closed | signup | signin | sent
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [resent, setResent] = useState('idle'); // idle | sending | sent | failed
  const sentRef = useRef(null);

  // The form is taller than the note that replaces it, so after submitting
  // on a phone the note's heading sat under the sticky navbar. Bring it
  // down below the bar (scroll-mt-24) and focus it. block 'start', because
  // Chrome's 'nearest' ignores the scroll margin and counts the note as
  // already visible.
  useEffect(() => {
    const note = sentRef.current;
    if (mode !== 'sent' || !note) return;
    if (note.getBoundingClientRect().top < 80) note.scrollIntoView({ block: 'start', behavior: 'smooth' });
    note.focus({ preventScroll: true });
  }, [mode]);

  const join = async () => {
    const res = await fetch(`/api/rescue-forces/${forceId}/join`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not join right now. Try again in a moment.');
    }
    router.refresh();
  };

  const switchTo = (next) => {
    setError('');
    setMode(next);
  };

  /* ------------------------------ Signed in ------------------------------ */

  if (signedIn) {
    const joinNow = async () => {
      setBusy(true);
      setError('');
      try {
        await join();
      } catch (e) {
        setError(e.message);
        setBusy(false);
      }
    };
    return (
      <div>
        <button type="button" onClick={joinNow} disabled={busy} className={PRIMARY}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          Join this Rescue Force
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <WhatMembersGet />
      </div>
    );
  }

  /* ------------------------------ Signed out ----------------------------- */

  if (mode === 'closed') {
    return (
      <div>
        <button type="button" onClick={() => switchTo('signup')} className={PRIMARY}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Join this Rescue Force
        </button>
        <WhatMembersGet />
      </div>
    );
  }

  if (mode === 'sent') {
    const resend = async () => {
      setResent('sending');
      try {
        const res = await fetch(`/api/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
        setResent(res.ok ? 'sent' : 'failed');
      } catch {
        setResent('failed');
      }
    };
    return (
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="scroll-mt-24 rounded-2xl bg-white p-4 outline-none ring-1 ring-midnight-200"
      >
        <p className="inline-flex items-center gap-2 font-semibold text-midnight-900">
          <Mail size={18} aria-hidden="true" />
          Check your email
        </p>
        <p className="mt-2 text-sm text-midnight-700">
          We sent a link to <strong className="break-all">{email.trim()}</strong>. Open it to confirm your email and
          finish joining {forceName}. The link works for 24 hours.
        </p>
        <p className="mt-3 text-sm text-midnight-500">
          Nothing there? Check your spam folder, or{' '}
          <button type="button" onClick={resend} disabled={resent === 'sending'} className={TEXT_BUTTON}>
            send it again
          </button>
          .
        </p>
        {resent === 'sent' && <p className="mt-1 text-sm text-emerald-700">Sent again.</p>}
        {resent === 'failed' && <p className="mt-1 text-sm text-red-600">That didn&apos;t go through. Try again later.</p>}
        <p className="mt-3 text-sm">
          <button type="button" onClick={() => switchTo('signup')} className={TEXT_BUTTON}>
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  const emailOk = EMAIL_REGEX.test(email.trim());

  if (mode === 'signin') {
    const ready = emailOk && password.length > 0;
    const submit = async (e) => {
      e.preventDefault();
      if (!ready || busy) return;
      setBusy(true);
      setError('');
      let signedInNow = false;
      try {
        const result = await signIn('credentials', { redirect: false, email: email.trim(), password });
        if (!result || result.error) {
          throw new Error(
            "That email and password don't match. If you just signed up, open the link we emailed you first."
          );
        }
        signedInNow = true;
        await join();
      } catch (err) {
        setError(err.message);
        setBusy(false);
        // Signed in but the join failed: re-render as signed in, so the
        // one-tap Join button (with this error under it) replaces the form.
        if (signedInNow) router.refresh();
      }
    };
    return (
      <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200" noValidate>
        <p className="font-semibold text-midnight-900">Sign in to join</p>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="join-signin-email" className={LABEL}>
              Email
            </label>
            <input
              id="join-signin-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
              autoFocus
            />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="join-signin-password" className="text-sm font-semibold text-midnight-700">
                Password
              </label>
              <Link
                href={`/forgot-password${emailOk ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
                className="text-sm font-medium text-midnight-500 hover:text-midnight-900"
              >
                Forgot it?
              </Link>
            </div>
            <input
              id="join-signin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={!ready || busy} className={`${PRIMARY} mt-4`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sign in and join
        </button>
        <p className="mt-3 text-center text-sm text-midnight-500">
          New here?{' '}
          <button type="button" onClick={() => switchTo('signup')} className={TEXT_BUTTON}>
            Create an account
          </button>
        </p>
      </form>
    );
  }

  // mode === 'signup'
  const ready = firstName.trim().length > 0 && emailOk && password.length >= 8 && agreed;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('register')) },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          password,
          acceptedTerms: true,
          joinForceId: forceId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        // Sign-ups are limited per connection (RateLimitPresets.AUTH); a
        // blocked connection waits up to half an hour, so say how long.
        const minutes = Number(data.retryAfter) > 0 ? Math.ceil(Number(data.retryAfter) / 60) : null;
        throw new Error(
          `Too many sign-ups from this connection. Try again ${
            minutes ? `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : 'later'
          }.`
        );
      }
      if (!res.ok) {
        // The register API answers an address that already has an account
        // with this same general message, on purpose (it must not say which
        // addresses are registered). Point at the likely fix.
        throw new Error(
          data.error?.startsWith('Unable to create account')
            ? "We couldn't create an account with that email. If you already have one, sign in instead."
            : data.error || "We couldn't create your account. Try again in a moment."
        );
      }
      setResent('idle');
      setMode('sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200" noValidate>
      <p className="font-semibold text-midnight-900">Join {forceName}</p>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="join-first-name" className={LABEL}>
            First name
          </label>
          <input
            id="join-first-name"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={INPUT}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="join-email" className={LABEL}>
            Email
          </label>
          <input
            id="join-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="join-password" className={LABEL}>
            Password
          </label>
          <div className="relative">
            <input
              id="join-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="join-password-hint"
              className={`${INPUT} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-midnight-400 hover:text-midnight-700"
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          <p id="join-password-hint" className="mt-1 text-xs text-midnight-500">
            At least 8 characters.
          </p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-midnight-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-midnight-300 accent-midnight-900"
          />
          <span>
            I agree to the{' '}
            <Link href="/legal/terms" target="_blank" className={TEXT_BUTTON}>
              Terms of Service
            </Link>{' '}
            and the{' '}
            <Link href="/legal/waiver" target="_blank" className={TEXT_BUTTON}>
              Liability Waiver
            </Link>
            .
          </span>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className={`${PRIMARY} mt-4`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Create account and join
      </button>
      <p className="mt-3 text-center text-sm text-midnight-500">
        Already have an account?{' '}
        <button type="button" onClick={() => switchTo('signin')} className={TEXT_BUTTON}>
          Sign in
        </button>
      </p>
    </form>
  );
}
