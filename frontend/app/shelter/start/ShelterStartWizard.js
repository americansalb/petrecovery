'use client';

/**
 * Shelter onboarding wizard (/shelter/start): one decision per screen.
 *
 * name -> where -> (is this yours? only when we find candidates) ->
 * kind -> role -> account (skipped when signed in) -> done.
 *
 * Guests never hit a login wall: the application rides along with
 * registration in one atomic step (register API `shelterRequest`
 * payload), mirroring the Health Book wizard. Signed-in users submit
 * straight to /api/shelter/request. If the visitor already manages a
 * shelter or has a pending application, the wizard short-circuits to a
 * status screen instead of letting them re-apply.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Building2, HeartHandshake, Loader2, CheckCircle2, Clock, MailCheck, ArrowRight,
} from 'lucide-react';
import CityAutocomplete from '@/app/components/CityAutocomplete';

const SHELTER_TYPES = [
  { value: 'SHELTER', label: 'Shelter', hint: 'a facility that takes animals in' },
  { value: 'RESCUE', label: 'Rescue', hint: 'foster-based rescue group' },
  { value: 'FOSTER_NETWORK', label: 'Foster network', hint: 'a network of foster homes' },
];

const ROLES = [
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
  { value: 'BOARD', label: 'Board member' },
  { value: 'OTHER', label: 'Other' },
];

const inputClass =
  'w-full rounded-xl border border-midnight-200 px-4 py-3 text-base text-midnight-900 ' +
  'placeholder:text-midnight-300 focus:outline-none focus:ring-2 focus:ring-flash-400 focus:border-flash-400';

const labelClass = 'block text-sm font-semibold text-midnight-800 mb-1.5';

function Chip({ active, onClick, children, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border-2 px-5 py-3.5 text-left transition-all ${
        active
          ? 'border-flash-400 bg-flash-50 shadow-sm'
          : 'border-midnight-100 bg-white hover:border-flash-300'
      }`}
    >
      <span className="block font-bold text-midnight-900">{children}</span>
      {hint && <span className="block text-sm text-midnight-500 mt-0.5">{hint}</span>}
    </button>
  );
}

function Nav({ onBack, onNext, nextLabel = 'Continue', canNext = true, busy = false, hideBack = false }) {
  return (
    <div className="flex items-center justify-between mt-10">
      {!hideBack ? (
        <button type="button" onClick={onBack} className="text-sm font-medium text-midnight-500 hover:text-midnight-900 transition-colors">
          Back
        </button>
      ) : <span />}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext || busy}
        className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 disabled:opacity-40 text-midnight-900 font-bold px-7 py-3 rounded-2xl transition-all"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {nextLabel}
      </button>
    </div>
  );
}

export default function ShelterStartWizard() {
  const { data: session, status } = useSession();
  const isMember = status === 'authenticated';

  // Existing relationship with us? APPROVED -> dashboard; PENDING -> status.
  const [existing, setExisting] = useState(null); // null = checking, false = clear to apply
  useEffect(() => {
    if (status === 'loading') return;
    if (!isMember) { setExisting(false); return; }
    fetch('/api/shelter/request')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return setExisting(false);
        if (d.status === 'APPROVED') return setExisting({ kind: 'approved', name: d.shelter?.name });
        if (['PENDING', 'UNDER_REVIEW', 'VERIFICATION_SENT'].includes(d.status)) {
          return setExisting({ kind: 'pending', name: d.claim?.shelterName });
        }
        setExisting(false);
      })
      .catch(() => setExisting(false));
  }, [status, isMember]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [where, setWhere] = useState(null); // { city, state, lat, lng }
  const [candidates, setCandidates] = useState([]);
  const [pickedExisting, setPickedExisting] = useState(null); // shelter object | 'NEW'
  const [kind, setKind] = useState('');
  const [role, setRole] = useState('');
  const [account, setAccount] = useState({ firstName: '', email: '', password: '', terms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { guest: bool, shelterName }

  const STEPS = useMemo(() => {
    const s = ['name', 'where'];
    if (candidates.length > 0) s.push('match');
    s.push('kind', 'role');
    if (!isMember) s.push('account');
    return s;
  }, [candidates.length, isMember]);
  const stepKey = STEPS[Math.min(step, STEPS.length - 1)];
  const lastStep = step === STEPS.length - 1;

  const TITLES = {
    name: 'What is your organization called?',
    where: `Where is ${name.trim() || 'it'} located?`,
    match: 'Is one of these yours?',
    kind: 'What kind of organization is it?',
    role: 'What is your role there?',
    account: 'Last step: your free account',
  };

  const canNext =
    stepKey === 'name' ? name.trim().length >= 3 :
    stepKey === 'where' ? Boolean(where) :
    stepKey === 'match' ? pickedExisting !== null :
    stepKey === 'kind' ? Boolean(kind) :
    stepKey === 'role' ? Boolean(role) :
    true;

  const goBack = () => { setError(''); setStep((s) => Math.max(0, s - 1)); };

  const advanceFromWhere = async () => {
    // Quiet dedupe lookup; the match step only appears when we find something.
    try {
      const params = new URLSearchParams({ name: name.trim(), city: where.city, state: where.state });
      const res = await fetch(`/api/shelter/start/candidates?${params}`);
      const data = res.ok ? await res.json() : { candidates: [] };
      setCandidates(data.candidates || []);
      setPickedExisting(null);
    } catch {
      setCandidates([]);
    }
    setStep((s) => s + 1);
  };

  const requestPayload = () => ({
    shelterName: name.trim(),
    city: where.city,
    state: where.state,
    latitude: where.lat,
    longitude: where.lng,
    shelterType: kind,
    role,
    ...(pickedExisting && pickedExisting !== 'NEW' ? { existingShelterId: pickedExisting.id } : {}),
  });

  const submitSignedIn = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shelter/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit your application');
      setDone({ guest: false, shelterName: data.claim?.shelterName || name.trim() });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitGuest = async (e) => {
    e.preventDefault();
    if (!account.terms || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: account.firstName.trim(),
          email: account.email.trim(),
          password: account.password,
          acceptedTerms: true,
          shelterRequest: requestPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create your account');
      setDone({ guest: true, shelterName: name.trim(), email: account.email.trim() });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    setError('');
    if (stepKey === 'where') return advanceFromWhere();
    if (lastStep && isMember) return submitSignedIn();
    setStep((s) => s + 1);
  };

  /* ------------------------- short-circuit screens ------------------------- */

  if (status === 'loading' || existing === null) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-midnight-300" />
      </div>
    );
  }

  if (existing && existing.kind === 'approved') {
    return (
      <Shell>
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-midnight-900 mb-2 text-center">You already run {existing.name || 'a shelter'} here</h1>
        <p className="text-midnight-600 text-center mb-8">Everything lives on your dashboard.</p>
        <div className="text-center">
          <Link href="/shelter/dashboard" className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-7 py-3 rounded-2xl transition-all">
            Go to your dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (existing && existing.kind === 'pending') {
    return (
      <Shell>
        <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-midnight-900 mb-2 text-center">
          {existing.name ? `${existing.name} is under review` : 'Your application is under review'}
        </h1>
        <p className="text-midnight-600 text-center">
          A human reviews every shelter, usually within a day or two. We&rsquo;ll email you the moment it&rsquo;s approved.
        </p>
      </Shell>
    );
  }

  /* ------------------------------ done screens ----------------------------- */

  if (done) {
    return (
      <Shell>
        {done.guest ? <MailCheck className="w-12 h-12 text-flash-500 mx-auto mb-4" /> : <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />}
        <h1 className="text-2xl font-black text-midnight-900 mb-3 text-center">
          {done.shelterName}&rsquo;s application is in
        </h1>
        <div className="text-midnight-700 space-y-3 max-w-md mx-auto">
          {done.guest && (
            <p>
              <strong>First:</strong> verify your email. We sent a link to{' '}
              <span className="font-semibold">{done.email}</span>.
            </p>
          )}
          <p>
            <strong>Then:</strong> a human reviews every shelter, usually within a day or
            two. You&rsquo;ll get an email the moment you&rsquo;re approved, and your
            dashboard unlocks: animals, health records, lost-pet matching, staff seats,
            and your own public page. No cost, no card.
          </p>
        </div>
        <div className="text-center mt-8">
          <Link href={done.guest ? '/login?callbackUrl=%2Fshelter%2Fdashboard' : '/shelter/dashboard'} className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-7 py-3 rounded-2xl transition-all">
            {done.guest ? 'Sign in after verifying' : 'See your dashboard'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  /* -------------------------------- the wizard ----------------------------- */

  return (
    <Shell>
      <p className="text-sm text-midnight-400 mb-1">Step {step + 1} of {STEPS.length}</p>
      <h1 className="text-2xl md:text-3xl font-black text-midnight-900 mb-8">{TITLES[stepKey]}</h1>

      {stepKey === 'name' && (
        <div>
          <label className={labelClass} htmlFor="sh-name">Shelter or rescue name</label>
          <input
            id="sh-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Happy Tails Animal Shelter"
            autoFocus
            className={inputClass}
          />
          <p className="text-sm text-midnight-500 mt-3">
            Free, no card: animal management, health records, lost-pet matching, and your own page.
          </p>
        </div>
      )}

      {stepKey === 'where' && (
        <div>
          <label className={labelClass}>City</label>
          <CityAutocomplete value={where} onChange={setWhere} inputClassName={inputClass} />
          <p className="text-sm text-midnight-500 mt-3">
            Pick your city from the list; it powers local lost-pet matching.
          </p>
        </div>
      )}

      {stepKey === 'match' && (
        <div className="grid gap-3">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPickedExisting(c.claimed ? null : c)}
              disabled={c.claimed}
              aria-pressed={pickedExisting !== 'NEW' && pickedExisting?.id === c.id}
              className={`rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                c.claimed
                  ? 'border-midnight-100 bg-midnight-50 opacity-60 cursor-not-allowed'
                  : pickedExisting !== 'NEW' && pickedExisting?.id === c.id
                  ? 'border-flash-400 bg-flash-50 shadow-sm'
                  : 'border-midnight-100 bg-white hover:border-flash-300'
              }`}
            >
              <span className="block font-bold text-midnight-900">{c.name}</span>
              <span className="block text-sm text-midnight-500">
                {[c.address, `${c.city}, ${c.state}`].filter(Boolean).join(' · ')}
              </span>
              {c.claimed && (
                <span className="inline-block mt-1 text-xs font-semibold text-amber-700">
                  Already managed on ReunitePets. If that seems wrong, email support@reunitepets.org.
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickedExisting('NEW')}
            aria-pressed={pickedExisting === 'NEW'}
            className={`rounded-2xl border-2 border-dashed px-5 py-4 text-left transition-all ${
              pickedExisting === 'NEW'
                ? 'border-flash-400 bg-flash-50 shadow-sm'
                : 'border-midnight-200 bg-white hover:border-flash-300'
            }`}
          >
            <span className="block font-bold text-midnight-900">None of these</span>
            <span className="block text-sm text-midnight-500">Add {name.trim()} as a new listing</span>
          </button>
        </div>
      )}

      {stepKey === 'kind' && (
        <div className="grid gap-3">
          {SHELTER_TYPES.map((t) => (
            <Chip key={t.value} active={kind === t.value} onClick={() => setKind(t.value)} hint={t.hint}>
              {t.label}
            </Chip>
          ))}
        </div>
      )}

      {stepKey === 'role' && (
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => (
            <Chip key={r.value} active={role === r.value} onClick={() => setRole(r.value)}>
              {r.label}
            </Chip>
          ))}
        </div>
      )}

      {stepKey === 'account' && (
        <form method="post" onSubmit={submitGuest} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="sh-first">First name</label>
            <input
              id="sh-first"
              value={account.firstName}
              onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value.slice(0, 100) }))}
              placeholder="Sam"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sh-email">Work email</label>
            <input
              id="sh-email"
              type="email"
              value={account.email}
              onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
              placeholder="you@yourshelter.org"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sh-password">Password</label>
            <input
              id="sh-password"
              type="password"
              value={account.password}
              onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
              placeholder="8+ characters"
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-midnight-600 cursor-pointer">
            <input
              type="checkbox"
              checked={account.terms}
              onChange={(e) => setAccount((a) => ({ ...a, terms: e.target.checked }))}
              required
              className="mt-0.5 w-4 h-4 rounded accent-midnight-900"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/terms" target="_blank" className="font-semibold text-midnight-900 underline">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" className="font-semibold text-midnight-900 underline">Privacy Policy</Link>.
            </span>
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={goBack} className="text-sm font-medium text-midnight-500 hover:text-midnight-900 transition-colors">
              Back
            </button>
            <button
              type="submit"
              disabled={busy || !account.terms}
              className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 disabled:opacity-40 text-midnight-900 font-bold px-7 py-3 rounded-2xl transition-all"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Send my application
            </button>
          </div>
          <p className="text-sm text-midnight-500">
            Already have an account?{' '}
            <Link href={`/login?callbackUrl=${encodeURIComponent('/shelter/start')}`} className="font-semibold text-midnight-900 underline">
              Sign in
            </Link>{' '}
            and your answers will be waiting.
          </p>
        </form>
      )}

      {error && stepKey !== 'account' && (
        <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>
      )}

      {stepKey !== 'account' && (
        <Nav
          onBack={goBack}
          onNext={onNext}
          canNext={canNext}
          busy={busy}
          hideBack={step === 0}
          nextLabel={lastStep && isMember ? 'Send my application' : 'Continue'}
        />
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] py-10">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-flash-400/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-xl mx-auto px-4 text-center relative">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-1.5 rounded-full border border-flash-400/25 text-sm font-medium">
            <Building2 className="w-4 h-4" /> Free shelter accounts
            <HeartHandshake className="w-4 h-4" />
          </span>
        </div>
      </section>
      <section className="max-w-xl mx-auto px-4 py-10 md:py-12">
        {children}
      </section>
    </div>
  );
}
