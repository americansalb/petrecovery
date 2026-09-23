'use client';

/**
 * Signing in with a phone number instead of an email: the number, then
 * the code sent to it. Same shape as the email steps in SignInCard, and
 * like them it asks nothing else; a player's name is asked once they
 * are in, and only if they have none.
 */

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ensureProfile, profileHeaders } from '../lib/profile';

export default function PhoneSignIn({ onAuthenticated, onUseEmail }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!challenge) await ensureProfile('');
      const response = await fetch(`/api/geo/auth/phone/${challenge ? 'verify' : 'request'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify(challenge ? { challenge, code } : { phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not sign in. Please try again.');
      if (challenge) onAuthenticated?.(data);
      else {
        setChallenge(data.challenge);
        setCode('');
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" onSubmit={submit} className="grid gap-4">
      {challenge ? (
        <div key="code" className="pe-swap grid gap-4">
          <div>
            <p className="ui-h2">Check your texts</p>
            <p className="mt-1 text-sm text-pe-muted">
              Enter the code sent to <span className="font-medium text-pe-fg">{phone}</span>.
            </p>
          </div>
          <div className="ui-field">
            <label className="ui-label" htmlFor="geo-phone-code">Code</label>
            <input
              id="geo-phone-code"
              className="ui-input ui-input--code"
              autoFocus
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4,10}"
              maxLength={10}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
      ) : (
        <div key="phone" className="pe-swap ui-field">
          <label className="ui-label" htmlFor="geo-phone-number">Phone number</label>
          <input
            id="geo-phone-number"
            className="ui-input"
            type="tel"
            required
            autoComplete="tel"
            maxLength={40}
            placeholder="+1 202 555 0123"
            aria-describedby="geo-phone-help"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <p id="geo-phone-help" className="ui-hint">Include your country code. We&apos;ll text you a code.</p>
        </div>
      )}
      {error ? <p role="alert" className="ui-error">{error}</p> : null}
      <button type="submit" disabled={busy} className="ui-btn ui-btn--primary ui-btn--block">
        {busy ? 'Please wait…' : challenge ? 'Sign in' : 'Send code'}
      </button>
      <div className="flex flex-wrap justify-between gap-2">
        {challenge ? (
          <button type="button" disabled={busy} className="ui-btn ui-btn--ghost ui-btn--sm -ml-3" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Different number
          </button>
        ) : null}
        <button type="button" disabled={busy} className="ui-btn ui-btn--ghost ui-btn--sm -mr-3 ml-auto" onClick={onUseEmail}>
          Use email instead
        </button>
      </div>
    </form>
  );
}
