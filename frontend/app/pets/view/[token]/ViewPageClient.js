'use client';

/**
 * Public pet care page (view link)
 *
 * Anyone holding the link sees the care record, read only, no account,
 * rendered by the SAME components the owner uses (DayChecklist,
 * GoodStuff) in their readOnly faces, so the sitter sees exactly what
 * the family sees. The one CTA turns a viewer into a caretaker without
 * leaving the page: sign up (or sign in) inline, the request goes to
 * the owner, and the owner approves from the pet's Care team tab.
 *
 * Layout is information first: header, medical conditions, today's
 * checklist, then plain lists for medications and vet facts.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { vaccinationStatus, latestPerName, rankVaccinations } from '@/lib/healthBook';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { DayChecklist } from '@/app/components/care/DoseChecklist';
import GoodStuff from '@/app/components/care/GoodStuff';
import { formatSchedule, startOfDay } from '@/lib/medications';

const primaryButton = 'w-full inline-flex items-center justify-center gap-2 rounded-full bg-care-teal text-white text-sm font-medium px-4 py-2.5 hover:bg-care-tealDark disabled:opacity-40 transition-colors';
const quietSwitch = 'text-[13px] font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900 transition-colors';
const inputClass = 'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-care-teal';

/* ------------------------------- Join modal ------------------------------- */

function JoinModal({ token, petName, ownerFirstName, onClose }) {
  const { data: session, status } = useSession();
  // signed in -> confirm; signed out -> signup (can flip to signin)
  const [mode, setMode] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // outcome payload

  useEffect(() => {
    if (status === 'loading') return;
    setMode((m) => m ?? (session ? 'confirm' : 'signup'));
  }, [status, session]);

  const submitRequest = useCallback(async (body = {}) => {
    const res = await fetch(`/api/pets/view/${token}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }, [token]);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await submitRequest({});
      setDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await submitRequest({ firstName, email, password });
      if (data.accountExists) {
        setMode('signin');
        setError(null);
        return;
      }
      // Account created: sign them in quietly so the page is theirs now
      if (data.accountCreated) {
        await signIn('credentials', { redirect: false, email, password });
      }
      setDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn('credentials', { redirect: false, email, password });
      if (result?.error) {
        throw new Error('That email and password did not match');
      }
      const data = await submitRequest({});
      setDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <p className="text-lg font-semibold text-neutral-900">
            {done.approved || done.alreadyActive ? 'You have access' : 'Request sent'}
          </p>
          {done.approved || done.alreadyActive ? (
            <>
              <p className="text-sm text-neutral-500 mt-2">
                {done.wasInvited
                  ? `${ownerFirstName} had already invited you, so you are in right away.`
                  : `You already have access to ${petName}.`}
              </p>
              <Link href="/pets" className="mt-6 inline-flex items-center justify-center rounded-full bg-care-teal text-white text-sm font-medium px-6 py-2.5 hover:bg-care-tealDark transition-colors">
                Open my pets
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500 mt-2">
                {done.alreadyRequested
                  ? `You already asked. ${ownerFirstName} just needs to approve it.`
                  : `${ownerFirstName} will get your request right away. Once they approve, you can log ${petName}'s doses yourself.`}
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-full bg-care-teal text-white text-sm font-medium px-6 py-2.5 hover:bg-care-tealDark transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-neutral-900 pr-8">Care for {petName}</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Caretakers log doses and keep the record up to date. {ownerFirstName} approves every request.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          {mode === 'confirm' && (
            <button onClick={handleConfirm} disabled={busy} className={primaryButton}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              Send request
            </button>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" aria-label="Your first name" autoComplete="given-name" className={inputClass} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Email" autoComplete="email" className={inputClass} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Choose a password (8+ characters)" aria-label="Choose a password, at least 8 characters" autoComplete="new-password" className={inputClass} />
              <button
                type="submit"
                disabled={busy || !firstName.trim() || !email.trim() || password.length < 8}
                className={primaryButton}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Create account and send request
              </button>
              <p className="text-center text-[13px] text-neutral-500">
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); }} className={quietSwitch}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleSignin} className="space-y-3">
              <p className="text-sm text-neutral-600">
                You already have an account. Sign in to send the request.
              </p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Email" autoComplete="email" className={inputClass} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" aria-label="Password" autoComplete="current-password" className={inputClass} />
              <button
                type="submit"
                disabled={busy || !email.trim() || !password}
                className={primaryButton}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Sign in and send request
              </button>
              <p className="text-center text-[13px] text-neutral-500">
                New here?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className={quietSwitch}>
                  Create an account
                </button>
              </p>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function PublicPetViewPage() {
  const params = useParams();
  const token = params.token;

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/pets/view/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" role="status" aria-label="Loading">
        <Loader2 size={28} className="animate-spin text-neutral-300" />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-900">This link is no longer active</h1>
          <p className="text-sm text-neutral-500 mt-2">
            The owner may have turned off link sharing. Ask them for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const { pet, ownerFirstName, medications } = data;
  // Same payload as the tracker: medications AND care routines. A walk
  // is not a medication; the page says so.
  const medItems = medications.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);
  const subline = [pet.breed, pet.color].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          {pet.primaryPhotoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-14 h-14 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0" aria-hidden="true">
              <SpeciesIcon species={pet.species} size={26} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 truncate">{pet.name}</h1>
            {subline && <p className="text-sm text-neutral-500 truncate">{subline}</p>}
          </div>
          <span className="text-[12px] font-medium text-neutral-500 border border-neutral-300 rounded-full px-2.5 py-0.5 shrink-0">
            View only
          </span>
        </header>

        {/* What a sitter or vet must see first */}
        {pet.medicalConditions && (
          <p className="mt-3 text-sm font-medium text-red-600">{pet.medicalConditions}</p>
        )}

        {/* The same checklist the family sees, read only */}
        <div className="mt-8">
          <DayChecklist
            meds={medItems}
            day={selectedDay}
            readOnly
            onBackToToday={() => setSelectedDay(startOfDay(new Date()))}
          />
        </div>

        <GoodStuff petId={null} meds={medications} setMeds={() => {}} canManage={false} readOnly />

        {/* Medication list */}
        {active.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[13px] font-medium text-neutral-500">All medications</h2>
            <ul className="divide-y divide-neutral-100 mt-1">
              {active.map((med) => (
                <li key={med.id} className="py-3">
                  <p className="text-[15px] font-medium text-neutral-900">
                    {med.name}
                    {med.strength && <span className="font-normal text-neutral-500"> · {med.strength}</span>}
                  </p>
                  <p className="text-[13px] text-neutral-500 mt-0.5">{med.instructions || formatSchedule(med)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The clinical facts a vet or sitter scans in 20 seconds */}
        {(data.vaccinations?.length > 0 || data.latestWeight || pet.vetName || pet.vetClinic || pet.vetPhone) && (
          <section className="mt-10">
            <h2 className="text-[13px] font-medium text-neutral-500">For the vet</h2>
            <dl className="divide-y divide-neutral-100 mt-1">
              {(pet.vetName || pet.vetClinic) && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[13px] text-neutral-500 shrink-0">Vet</dt>
                  <dd className="text-[15px] text-neutral-900 text-right">
                    {[pet.vetName, pet.vetClinic].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
              {pet.vetPhone && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[13px] text-neutral-500 shrink-0">Phone</dt>
                  <dd className="text-[15px] text-neutral-900 text-right tabular-nums">{pet.vetPhone}</dd>
                </div>
              )}
              {data.latestWeight && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[13px] text-neutral-500 shrink-0">Weight</dt>
                  <dd className="text-[15px] text-neutral-900 text-right tabular-nums">
                    {/* A vet scanning this must see that a weigh-in is old:
                        "May 28" with no year reads as recent forever. */}
                    {data.latestWeight.weightLbs} lbs · {new Date(data.latestWeight.recordedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      ...(new Date(data.latestWeight.recordedAt).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
                    })}
                  </dd>
                </div>
              )}
              {data.vaccinations?.length > 0 && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[13px] text-neutral-500 shrink-0">Vaccines</dt>
                  {/* This is the clinical face a vet or sitter reads, so each
                      vaccine states its status, not a bare date: an expired
                      shot must not read as current, and a no-expiry record
                      must not show its given date as if it were coverage. */}
                  <dd className="text-[15px] text-neutral-900 text-right">
                    {/* One entry per vaccine (newest), worst standing first,
                        matching the owner-facing passport. */}
                    {rankVaccinations(latestPerName(data.vaccinations)).map((v, i) => {
                      const st = vaccinationStatus(v);
                      const mmyyyy = (d) => new Date(d).toLocaleDateString([], { month: 'numeric', year: 'numeric' });
                      let label; let cls = 'text-neutral-500';
                      if (st === 'EXPIRED') { label = `expired ${mmyyyy(v.expiresAt)}`; cls = 'text-red-600 font-medium'; }
                      else if (st === 'DUE_SOON') { label = `due ${mmyyyy(v.expiresAt)}`; cls = 'text-amber-600 font-medium'; }
                      else if (st === 'ON_FILE') { label = 'on file'; }
                      else { label = `thru ${mmyyyy(v.expiresAt)}`; }
                      return (
                        <span key={v.id || i}>
                          {i > 0 && <span className="text-neutral-300"> · </span>}
                          {v.name} <span className={cls}>({label})</span>
                        </span>
                      );
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* The clinical face carries the same soft disclosure the owner
            sees: this is family-kept data, not a clinic-verified record. */}
        <p className="mt-8 text-[12px] text-neutral-400">
          This Health Book is kept by {pet.name}&apos;s people and isn&apos;t verified by a clinic.
          For anything official, ask for the paper certificate — and in an emergency, call a vet first.
        </p>

        {/* Join request */}
        <div className="mt-12 flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">Caring for {pet.name}? Ask to join to log doses yourself.</p>
          <button
            onClick={() => setShowJoin(true)}
            className="shrink-0 rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-2 hover:border-care-teal transition-colors"
          >
            Ask to join
          </button>
        </div>
      </div>

      {showJoin && (
        <JoinModal
          token={token}
          petName={pet.name}
          ownerFirstName={ownerFirstName}
          onClose={() => setShowJoin(false)}
        />
      )}
    </div>
  );
}
