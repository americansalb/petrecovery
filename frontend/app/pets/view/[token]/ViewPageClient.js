'use client';

/**
 * Public pet care page (view link)
 *
 * Anyone holding the link sees the care record, read only, no account —
 * rendered by the SAME components the owner uses (DayChecklist,
 * WeekStrip, GoodStuff, AlertRibbon) in their readOnly faces, so the
 * sitter sees exactly the book the family keeps. The one CTA turns a
 * viewer into a caretaker without leaving the page: sign up (or sign
 * in) inline, the request goes to the owner, and the owner approves
 * from the pet's Care team tab.
 *
 * Presentation is the Paper Passport: the page is the book itself laid
 * open on the desk — cream sheets, ink, a VIEW ONLY stamp — with the
 * join invitation as a dashed red-ink note.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  HeartHandshake, Loader2, Sparkles, ArrowRight, LinkIcon,
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { DayChecklist } from '@/app/components/care/DoseChecklist';
import WeekStrip from '@/app/components/care/WeekStrip';
import GoodStuff from '@/app/components/care/GoodStuff';
import { AlertRibbon } from '@/app/components/care/HealthRecord';
import { formatSchedule, startOfDay } from '@/lib/medications';
import {
  PaperScaffold, Sheet, SectionInk, RuledList, RuledRow, StampText, Polaroid,
} from '@/app/components/care/paper/Paper';

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

  const inputClass = 'w-full rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred transition-colors';

  return (
    <Modal onClose={onClose} variant="paper">
      {done ? (
        <div className="text-center py-4">
          <div className="flex justify-center mb-4">
            <StampText tone="green" rotate={-5}>
              {done.approved || done.alreadyActive ? 'On the team' : 'Request sent'}
            </StampText>
          </div>
          {done.approved || done.alreadyActive ? (
            <>
              <p className="font-diary italic text-[16px] text-pen-900 leading-snug">
                {done.wasInvited
                  ? `${ownerFirstName} had already invited you, so you're in right away.`
                  : `you already have access to ${petName}.`}
              </p>
              <Link
                href="/pets"
                className="mt-6 inline-flex items-center gap-2 font-stamp text-[11px] uppercase tracking-[0.12em] bg-stampred text-paper-50 rounded-[5px] px-5 py-3 hover:bg-stampred-dark transition-colors"
              >
                Open my pets <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <p className="font-diary italic text-[16px] text-pen-900 leading-snug">
                {done.alreadyRequested
                  ? `you already asked — ${ownerFirstName} just needs to approve it.`
                  : `${ownerFirstName} will get a note right away. once they approve, you can write ${petName}'s doses in yourself.`}
              </p>
              <button
                onClick={onClose}
                className="mt-6 font-stamp text-[11px] uppercase tracking-[0.12em] bg-pen-900 text-paper-50 rounded-[5px] px-6 py-3 hover:bg-pen-600 transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <h2 className="font-diary italic text-[22px] text-pen-900 pr-8">Help care for {petName}</h2>
            <p className="font-diary italic text-[13px] text-pen-400 mt-1">
              caretakers write doses into the book and keep the record up to date. {ownerFirstName} approves every request.
            </p>
          </div>

          {error && (
            <p className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark px-4 py-3 mb-4 text-sm">{error}</p>
          )}

          {mode === 'confirm' && (
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 font-stamp text-[11px] uppercase tracking-[0.12em] bg-stampred text-paper-50 rounded-[5px] py-3.5 hover:bg-stampred-dark transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <HeartHandshake size={16} />}
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
                className="w-full inline-flex items-center justify-center gap-2 font-stamp text-[11px] uppercase tracking-[0.12em] bg-stampred text-paper-50 rounded-[5px] py-3.5 hover:bg-stampred-dark transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
                Create account &amp; send request
              </button>
              <p className="text-center font-diary italic text-[12px] text-pen-400">
                already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-900 underline underline-offset-2 hover:text-stampred transition-colors">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleSignin} className="space-y-3">
              <p className="border-l-[3px] border-marker bg-marker-wash/60 px-3 py-2 font-diary italic text-[13px] text-pen-600">
                good news: you already have an account. sign in to send the request.
              </p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="email" className={inputClass} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" autoComplete="current-password" className={inputClass} />
              <button
                type="submit"
                disabled={busy || !email.trim() || !password}
                className="w-full inline-flex items-center justify-center gap-2 font-stamp text-[11px] uppercase tracking-[0.12em] bg-stampred text-paper-50 rounded-[5px] py-3.5 hover:bg-stampred-dark transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={15} />}
                Sign in &amp; send request
              </button>
              <p className="text-center font-diary italic text-[12px] text-pen-400">
                new here?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-900 underline underline-offset-2 hover:text-stampred transition-colors">
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
      <PaperScaffold className="flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-pen-300" />
      </PaperScaffold>
    );
  }

  if (failed || !data) {
    return (
      <PaperScaffold className="flex items-center justify-center px-4">
        <Sheet className="max-w-md w-full text-center py-8">
          <LinkIcon size={32} className="text-pen-300 mx-auto mb-4" />
          <h1 className="font-diary italic text-[22px] text-pen-900 mb-2">This link is no longer active</h1>
          <p className="font-diary italic text-[13.5px] text-pen-400">
            the owner may have turned off link sharing. ask them for a fresh link.
          </p>
        </Sheet>
      </PaperScaffold>
    );
  }

  const { pet, ownerFirstName, medications } = data;
  // Same payload as the tracker: medications AND care routines. A walk
  // is not a medication; the page says so.
  const medItems = medications.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);

  return (
    <PaperScaffold className="px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <Sheet className="mb-4">
          <div className="flex items-center gap-5">
            <Polaroid
              src={pet.primaryPhotoUrl}
              alt={pet.name}
              fallback={<SpeciesIcon species={pet.species} size={30} />}
              size="md"
              rotate={-3}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-diary italic text-[24px] leading-tight text-pen-900">{pet.name}&apos;s care page</h1>
              <p className="font-stamp text-[9.5px] uppercase tracking-[0.16em] text-pen-400 truncate mt-1">
                {[pet.breed, pet.color].filter(Boolean).join(' · ')}
              </p>
            </div>
            <StampText tone="ink" rotate={5} className="shrink-0">View only</StampText>
          </div>
          <p className="font-diary italic text-[12.5px] text-pen-400 mt-3">
            shared by {ownerFirstName} · {active.length} active medication{active.length !== 1 ? 's' : ''}
          </p>
        </Sheet>

        {/* What a sitter or vet must see first */}
        <AlertRibbon text={pet.medicalConditions} />

        {/* Join CTA */}
        <button
          onClick={() => setShowJoin(true)}
          className="w-full mb-6 border-[1.5px] border-dashed border-stampred bg-paper-50 rounded-[6px] px-5 py-4 text-left hover:bg-stampred-wash/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <HeartHandshake size={22} className="text-stampred shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-diary italic text-[17px] text-pen-900 leading-tight">Help care for {pet.name}</p>
              <p className="font-diary italic text-[12.5px] text-pen-400 mt-0.5">
                join as a caretaker to write doses in yourself. takes 30 seconds, no app needed.
              </p>
            </div>
            <span className="font-stamp text-[10px] uppercase tracking-[0.14em] text-stampred shrink-0 group-hover:translate-x-0.5 transition-transform">
              ask to join →
            </span>
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
          <Sheet className="mb-6">
            <SectionInk>all medications</SectionInk>
            <RuledList>
              {active.map((med) => (
                <RuledRow key={med.id}>
                  <span
                    className="w-8 h-8 border border-pen-400 rounded-[3px] bg-paper-50 flex items-center justify-center font-stamp text-[13px] text-pen-600 shrink-0"
                    style={{ transform: 'rotate(-2deg)' }}
                  >
                    ℞
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-pen-900 truncate leading-tight">
                      {med.name}
                      {med.strength && <span className="font-medium text-pen-400"> · {med.strength}</span>}
                    </p>
                    <p className="font-diary italic text-[12px] text-pen-400 truncate mt-0.5">{med.instructions || formatSchedule(med)}</p>
                  </div>
                </RuledRow>
              ))}
            </RuledList>
          </Sheet>
        )}

        {/* The clinical face: what a vet or sitter scans in 20 seconds */}
        {(data.vaccinations?.length > 0 || data.latestWeight || pet.vetName || pet.vetClinic) && (
          <Sheet className="mb-6">
            <SectionInk>for the vet</SectionInk>
            <p className="font-diary italic text-[12px] text-pen-400 -mt-1 mb-2">from {pet.name}&apos;s Health Book.</p>
            <dl className="text-sm">
              {data.latestWeight && (
                <div className="flex justify-between gap-3 py-2 border-b border-pen-900/[0.14] last:border-b-0">
                  <dt className="font-stamp text-[9px] uppercase tracking-[0.14em] text-pen-400 pt-1">Weight</dt>
                  <dd className="font-semibold text-pen-900">
                    {data.latestWeight.weightLbs} lbs · {new Date(data.latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </dd>
                </div>
              )}
              {data.vaccinations?.length > 0 && (
                <div className="flex justify-between gap-3 py-2 border-b border-pen-900/[0.14] last:border-b-0">
                  <dt className="font-stamp text-[9px] uppercase tracking-[0.14em] text-pen-400 pt-1 shrink-0">Vaccines</dt>
                  <dd className="font-semibold text-pen-900 text-right">
                    {data.vaccinations.map((v) =>
                      `${v.name} ${new Date(v.expiresAt || v.administeredAt).toLocaleDateString([], { month: 'numeric', year: 'numeric' })}`
                    ).join(' · ')}
                  </dd>
                </div>
              )}
              {(pet.vetName || pet.vetClinic) && (
                <div className="flex justify-between gap-3 py-2 border-b border-pen-900/[0.14] last:border-b-0">
                  <dt className="font-stamp text-[9px] uppercase tracking-[0.14em] text-pen-400 pt-1">Vet</dt>
                  <dd className="font-semibold text-pen-900 text-right">
                    {[pet.vetName, pet.vetClinic].filter(Boolean).join(', ')}
                    {pet.vetPhone ? ` · ${pet.vetPhone}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </Sheet>
        )}

        <p className="text-center font-diary italic text-[12px] text-pen-400 pb-6">
          Powered by <Link href="/" className="font-semibold text-pen-600 hover:text-pen-900 transition-colors">ReunitePets</Link>, free forever for every pet. Your vet&rsquo;s guidance always comes first.
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
    </PaperScaffold>
  );
}
