'use client';

/**
 * Public pet care page (view link)
 *
 * Anyone holding the link sees the care record, read only, no account —
 * rendered by the SAME components the owner uses (DayChecklist,
 * WeekStrip, GoodStuff, VetCard, AlertRibbon) in their readOnly faces,
 * so the sitter sees exactly the book the family keeps. The one CTA
 * turns a viewer into a caretaker without leaving the page: sign up
 * (or sign in) inline, the request goes to the owner, and the owner
 * approves from the pet's Care team tab.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  Eye, HeartHandshake, Loader2, Check, Sparkles, ArrowRight, LinkIcon,
} from 'lucide-react';
import { Card, Badge, Modal } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { DayChecklist } from '@/app/components/care/DoseChecklist';
import WeekStrip from '@/app/components/care/WeekStrip';
import GoodStuff from '@/app/components/care/GoodStuff';
import { AlertRibbon } from '@/app/components/care/HealthRecord';
import { formatSchedule, startOfDay } from '@/lib/medications';

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

  const inputClass = 'w-full h-12 px-4 rounded-2xl border-2 border-midnight-200 text-midnight-900 placeholder:text-midnight-400 focus:outline-none focus:border-flash-400 transition-colors';

  return (
    <Modal onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-600" strokeWidth={3} />
          </div>
          {done.approved || done.alreadyActive ? (
            <>
              <h2 className="text-2xl font-bold text-midnight-900">You&apos;re on the team</h2>
              <p className="text-midnight-500 mt-2">
                {done.wasInvited
                  ? `${ownerFirstName} had already invited you, so you're in right away.`
                  : `You already have access to ${petName}.`}
              </p>
              <Link
                href="/pets"
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition"
              >
                Open my pets <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-midnight-900">Request sent</h2>
              <p className="text-midnight-500 mt-2">
                {done.alreadyRequested
                  ? `You already asked. ${ownerFirstName} just needs to approve it.`
                  : `${ownerFirstName} will get a note right away. Once they approve, you can log ${petName}'s doses yourself.`}
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-midnight-900 hover:bg-midnight-800 text-white font-bold rounded-2xl transition"
              >
                Done
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <div className="w-12 h-12 bg-flash-400 rounded-2xl flex items-center justify-center mb-3">
              <HeartHandshake size={24} className="text-midnight-900" />
            </div>
            <h2 className="text-2xl font-bold text-midnight-900">Help care for {petName}</h2>
            <p className="text-midnight-500 mt-1 text-sm">
              Caretakers can log doses and keep the record up to date. {ownerFirstName} approves every request.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{error}</p>
          )}

          {mode === 'confirm' && (
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="w-full py-4 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : <HeartHandshake size={20} />}
              Request caretaker access
            </button>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" autoComplete="given-name" className={inputClass} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="email" className={inputClass} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Choose a password (8+ characters)" autoComplete="new-password" className={inputClass} />
              <button
                type="submit"
                disabled={busy || !firstName.trim() || !email.trim() || password.length < 8}
                className="w-full py-4 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={18} />}
                Create account &amp; send request
              </button>
              <p className="text-center text-xs text-midnight-500">
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="font-bold text-midnight-900 underline underline-offset-2">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleSignin} className="space-y-3">
              <p className="text-sm text-midnight-600 bg-flash-50 border border-flash-200 rounded-xl px-3 py-2">
                Good news: you already have an account. Sign in to send the request.
              </p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="email" className={inputClass} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" autoComplete="current-password" className={inputClass} />
              <button
                type="submit"
                disabled={busy || !email.trim() || !password}
                className="w-full py-4 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={18} />}
                Sign in &amp; send request
              </button>
              <p className="text-center text-xs text-midnight-500">
                New here?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="font-bold text-midnight-900 underline underline-offset-2">
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
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-midnight-300" />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <LinkIcon size={36} className="text-midnight-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-midnight-900 mb-2">This link is no longer active</h1>
          <p className="text-midnight-500">The owner may have turned off link sharing. Ask them for a fresh link.</p>
        </Card>
      </div>
    );
  }

  const { pet, ownerFirstName, medications } = data;
  // Same payload as the tracker: medications AND care routines. A walk
  // is not a medication; the page says so.
  const medItems = medications.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-midnight-50 to-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-midnight-100 overflow-hidden flex items-center justify-center flex-shrink-0">
              {pet.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <SpeciesIcon species={pet.species} size={32} className="text-midnight-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-midnight-900">{pet.name}&apos;s care page</h1>
              <p className="text-sm text-midnight-500 truncate">
                {[pet.breed, pet.color].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Badge variant="default" icon={Eye}>View only</Badge>
          </div>
          <p className="text-xs text-midnight-400 mt-3">
            Shared by {ownerFirstName} · {active.length} active medication{active.length !== 1 ? 's' : ''}
          </p>
        </Card>

        {/* What a sitter or vet must see first */}
        <AlertRibbon text={pet.medicalConditions} />

        {/* Join CTA */}
        <button
          onClick={() => setShowJoin(true)}
          className="w-full mb-6 rounded-3xl border-2 border-flash-400 bg-flash-50 hover:bg-flash-100 p-5 text-left transition group"
        >
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-flash-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <HeartHandshake size={24} className="text-midnight-900" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-midnight-900">Help care for {pet.name}</p>
              <p className="text-sm text-midnight-600">
                Join as a caretaker to log doses yourself. Takes 30 seconds, no app needed.
              </p>
            </div>
            <ArrowRight size={20} className="text-midnight-400 group-hover:translate-x-1 transition shrink-0" />
          </div>
        </button>

        {/* The same checklist the family sees, read-only */}
        <DayChecklist
          meds={medItems}
          day={selectedDay}
          readOnly
          onBackToToday={() => setSelectedDay(startOfDay(new Date()))}
        />
        <WeekStrip meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

        <GoodStuff petId={null} meds={medications} setMeds={() => {}} canManage={false} readOnly />

        {/* Medication list */}
        {active.length > 0 && (
          <Card padding="lg" className="mb-6">
            <h3 className="font-bold text-midnight-900 mb-3">All medications</h3>
            <ul className="divide-y divide-midnight-100">
              {active.map((med) => (
                <li key={med.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <MedIconChip med={med} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-midnight-900 truncate">
                      {med.name}
                      {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
                    </p>
                    <p className="text-xs text-midnight-500 truncate">{med.instructions || formatSchedule(med)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* The clinical face: what a vet or sitter scans in 20 seconds */}
        {(data.vaccinations?.length > 0 || data.latestWeight || pet.vetName || pet.vetClinic) && (
          <Card padding="lg" className="mb-6">
            <h3 className="font-bold text-midnight-900 mb-1">For the vet</h3>
            <p className="text-xs text-midnight-400 mb-3">From {pet.name}&apos;s Health Book.</p>
            <dl className="space-y-2 text-sm">
              {data.latestWeight && (
                <div className="flex justify-between gap-3">
                  <dt className="text-midnight-500">Weight</dt>
                  <dd className="font-semibold text-midnight-900">
                    {data.latestWeight.weightLbs} lbs · {new Date(data.latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </dd>
                </div>
              )}
              {data.vaccinations?.length > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-midnight-500 shrink-0">Vaccines</dt>
                  <dd className="font-semibold text-midnight-900 text-right">
                    {data.vaccinations.map((v) =>
                      `${v.name} ${new Date(v.expiresAt || v.administeredAt).toLocaleDateString([], { month: 'numeric', year: 'numeric' })}`
                    ).join(' · ')}
                  </dd>
                </div>
              )}
              {(pet.vetName || pet.vetClinic) && (
                <div className="flex justify-between gap-3">
                  <dt className="text-midnight-500">Vet</dt>
                  <dd className="font-semibold text-midnight-900 text-right">
                    {[pet.vetName, pet.vetClinic].filter(Boolean).join(', ')}
                    {pet.vetPhone ? ` · ${pet.vetPhone}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        <p className="text-center text-xs text-midnight-400 pb-6">
          Powered by <Link href="/" className="font-bold text-midnight-600 hover:text-midnight-900">ReunitePets</Link>, free forever for every pet. Your vet&rsquo;s guidance always comes first.
        </p>
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
