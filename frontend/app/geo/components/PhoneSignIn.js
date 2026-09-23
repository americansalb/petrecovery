'use client';

import { useState } from 'react';
import { ArrowRight, Phone, UserRound } from 'lucide-react';
import { ensureProfile, profileHeaders } from '../lib/profile';

export default function PhoneSignIn({ requireName, name, setName, onAuthenticated, onUseEmail }) {
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
      if (!challenge) {
        if (requireName && !name.trim()) throw new Error('Choose a player name first.');
        await ensureProfile(name.trim());
      }
      const response = await fetch(`/api/geo/auth/phone/${challenge ? 'verify' : 'request'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify(challenge ? { challenge, code } : { phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not sign in. Please try again.');
      if (challenge) {
        // Stay in the current round or room form, preserving its draft.
        window.dispatchEvent(new Event('geo:authenticated'));
        window.dispatchEvent(new Event('geo:session-changed'));
        onAuthenticated(data);
      } else { setChallenge(data.challenge); setCode(''); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="pe-swap">
      {challenge ? <div className="pe-swap mt-4" role="status"><h3 className="text-xl font-semibold">Check your texts</h3><p className="mt-2 text-white/70">Enter the code sent to {phone}.</p></div> : null}
      <form method="post" onSubmit={submit} className="pe-account-form">
        {!challenge && requireName ? <label htmlFor="geo-phone-name"><span className="flex items-center gap-2"><UserRound size={16} aria-hidden="true" /> Player name</span><input id="geo-phone-name" required maxLength={20} autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} /></label> : null}
        {challenge ? <label htmlFor="geo-phone-code"><span>Verification code</span><input id="geo-phone-code" autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label> : <label htmlFor="geo-phone-number"><span className="flex items-center gap-2"><Phone size={16} aria-hidden="true" /> Phone number</span><input id="geo-phone-number" type="tel" required autoComplete="tel" maxLength={40} placeholder="+1 202 555 0123" aria-describedby="geo-phone-help" value={phone} onChange={(event) => setPhone(event.target.value)} /><span id="geo-phone-help" className="text-xs font-normal text-white/60">Include your country code. We’ll text you a sign-in code.</span></label>}
        <button type="submit" disabled={busy} className="pe-button pe-button--primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">{busy ? 'Please wait…' : challenge ? 'Verify and continue' : 'Send code'}<ArrowRight size={16} aria-hidden="true" /></button>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {challenge ? <button type="button" disabled={busy} className="min-h-[44px] underline" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Change number or resend</button> : null}
        <button type="button" disabled={busy} className="min-h-[44px] underline" onClick={onUseEmail}>Use email instead</button>
      </div>
      <p className="mt-2 text-xs text-white/50">No password. This device stays signed in for 90 days.</p>
    </div>
  );
}
