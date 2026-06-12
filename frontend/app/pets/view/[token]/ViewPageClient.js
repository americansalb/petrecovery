'use client';

/**
 * Public pet care page (view link)
 *
 * Anyone holding the link sees the care record, read only, no account.
 * The one CTA turns a viewer into a caretaker without leaving the page:
 * sign up (or sign in) inline, the request goes to the owner, and the
 * owner approves from their sharing settings.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  PawPrint, Eye, Sun, Sunset, Moon, CalendarDays, HeartHandshake,
  Loader2, X, Check, Sparkles, ArrowRight, LinkIcon,
} from 'lucide-react';
import { Card, Badge, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import {
  formatSchedule, formatTime, timeOfDayBucket,
  slotsWithStatus, adherenceForDay, startOfDay, sameDay, careEmoji,
} from '@/lib/medications';

const BUCKET_ICONS = { Morning: Sun, Afternoon: Sunset, Evening: Moon };

/* ----------------------------- Read-only day ------------------------------ */

function ReadOnlyDay({ meds, day, onBackToToday }) {
  const isToday = sameDay(day, new Date());
  const scheduled = meds.filter((m) => m.isActive && m.scheduleType !== 'AS_NEEDED');

  const buckets = useMemo(() => {
    const grouped = { Morning: [], Afternoon: [], Evening: [] };
    for (const med of scheduled) {
      for (const slot of slotsWithStatus(med, med.doses, day)) {
        grouped[timeOfDayBucket(slot.time)].push({ med, slot });
      }
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.slot.time.localeCompare(b.slot.time));
    }
    return grouped;
  }, [meds, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = Object.values(buckets).flat();
  if (all.length === 0) return null;
  const given = all.filter(({ slot }) => slot.status === 'GIVEN').length;

  return (
    <Card padding="lg" className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-midnight-900">
            {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-sm text-midnight-500">{given} of {all.length} doses given</p>
        </div>
        {!isToday && (
          <button
            onClick={onBackToToday}
            className="text-xs font-bold text-midnight-500 hover:text-midnight-900 px-3 py-1.5 rounded-lg border border-midnight-200 hover:border-midnight-400 transition-colors"
          >
            Back to today
          </button>
        )}
      </div>
      <div className="space-y-4">
        {Object.entries(buckets).map(([bucket, items]) => {
          if (!items.length) return null;
          const BucketIcon = BUCKET_ICONS[bucket];
          return (
            <div key={bucket}>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">
                <BucketIcon size={14} /> {bucket}
              </p>
              <div className="space-y-2">
                {items.map(({ med, slot }) => {
                  const givenSlot = slot.status === 'GIVEN';
                  const skipped = slot.status === 'SKIPPED';
                  return (
                    <div
                      key={`${med.id}-${slot.time}`}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                        givenSlot ? 'bg-emerald-50/70 border-emerald-200' : skipped ? 'bg-midnight-50 border-midnight-200' : 'bg-white border-midnight-200'
                      )}
                    >
                      <MedIconChip med={med} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-semibold text-sm text-midnight-900 truncate', skipped && 'line-through text-midnight-400')}>
                          {med.name}
                          {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
                        </p>
                        <p className="text-xs text-midnight-500">
                          {givenSlot && slot.dose?.givenAt
                            ? `Given at ${new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                            : skipped ? 'Skipped' : `Due ${formatTime(slot.time)}`}
                        </p>
                      </div>
                      {(givenSlot || skipped) && (
                        <span className={cn('text-xs font-bold px-2 py-1 rounded-full', givenSlot ? 'bg-emerald-100 text-emerald-700' : 'bg-midnight-100 text-midnight-500')}>
                          {givenSlot ? 'Given' : 'Skipped'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReadOnlyWeek({ meds, selectedDay, onSelectDay }) {
  const scheduled = meds.filter((m) => m.scheduleType !== 'AS_NEEDED');
  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date(Date.now() - i * 86400000));
      let due = 0; let given = 0;
      for (const med of scheduled) {
        const a = adherenceForDay(med, med.doses, day);
        due += a.due; given += a.given;
      }
      out.push({ day, due, given });
    }
    return out;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!days.some((d) => d.due > 0)) return null;

  return (
    <Card padding="lg" className="mb-6">
      <h3 className="flex items-center gap-2 font-bold text-midnight-900 mb-4">
        <CalendarDays size={18} className="text-midnight-400" /> This week
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const isSelected = selectedDay && sameDay(day, selectedDay);
          const pct = due > 0 ? given / due : null;
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl p-1 -m-1 transition-all', isSelected ? 'ring-2 ring-flash-400 bg-flash-50' : 'hover:bg-midnight-50')}
            >
              <span className={cn('text-[11px] font-semibold', isToday || isSelected ? 'text-midnight-900' : 'text-midnight-400')}>
                {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'narrow' })}
              </span>
              <div className="w-full h-12 bg-midnight-100 rounded-lg relative overflow-hidden">
                {pct != null && (
                  <div
                    className={cn('absolute bottom-0 left-0 right-0 rounded-lg', pct >= 1 ? 'bg-emerald-400' : pct > 0 ? 'bg-flash-400' : 'bg-midnight-200')}
                    style={{ height: `${Math.max(pct * 100, pct > 0 ? 18 : 8)}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-midnight-500 tabular-nums">{due ? `${given}/${due}` : '—'}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* --------------------------- Read-only good stuff ------------------------- */

function ReadOnlyGoodStuff({ careItems, day }) {
  if (careItems.length === 0) return null;
  const isToday = sameDay(day, new Date());

  const scheduled = [];
  for (const care of careItems.filter((c) => c.scheduleType !== 'AS_NEEDED')) {
    for (const slot of slotsWithStatus(care, care.doses, day)) {
      scheduled.push({ care, slot });
    }
  }
  scheduled.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
  const whenever = careItems.filter((c) => c.scheduleType === 'AS_NEEDED');

  return (
    <Card padding="lg" className="mb-6">
      <h3 className="flex items-center gap-2 font-bold text-midnight-900 mb-1">
        <span className="text-lg" aria-hidden="true">🎾</span> The good stuff
      </h3>
      <p className="text-sm text-midnight-500 mb-4">
        Walks, brushing, treats: daily life, not medicine.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {scheduled.map(({ care, slot }) => {
          const done = slot.status === 'GIVEN';
          return (
            <div
              key={`${care.id}-${slot.time}`}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5',
                done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-midnight-200'
              )}
            >
              <span className="text-2xl" aria-hidden="true">{careEmoji(care.name)}</span>
              <span className="text-left">
                <span className={cn('block text-sm font-bold', done ? 'text-emerald-700' : 'text-midnight-900')}>
                  {care.name}
                </span>
                <span className={cn('block text-[11px]', done ? 'text-emerald-600' : 'text-midnight-500')}>
                  {done ? 'Done!' : formatTime(slot.time)}
                </span>
              </span>
            </div>
          );
        })}
        {whenever.map((care) => {
          const count = (care.doses || []).filter(
            (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
          ).length;
          return (
            <div
              key={care.id}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5',
                count > 0 ? 'bg-flash-50 border-flash-200' : 'bg-white border-midnight-200'
              )}
            >
              <span className="text-2xl" aria-hidden="true">{careEmoji(care.name)}</span>
              <span className="text-left">
                <span className="block text-sm font-bold text-midnight-900">{care.name}</span>
                <span className="block text-[11px] text-midnight-500">
                  {count > 0 ? `x${count} ${isToday ? 'today' : 'this day'}` : 'Whenever'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 z-10">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition">
          <X size={22} />
        </button>

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
      </div>
    </div>
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
  const careItems = medications.filter((m) => m.kind === 'CARE' && m.isActive);
  const active = medItems.filter((m) => m.isActive);

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <Card padding="lg" className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-midnight-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {pet.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <PawPrint className="w-8 h-8 text-midnight-400" />
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

        <ReadOnlyDay meds={medItems} day={selectedDay} onBackToToday={() => setSelectedDay(startOfDay(new Date()))} />
        <ReadOnlyWeek meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

        <ReadOnlyGoodStuff careItems={careItems} day={selectedDay} />

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
                    <p className="text-xs text-midnight-500 truncate">{formatSchedule(med)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="text-center text-xs text-midnight-400 pb-6">
          Powered by <Link href="/" className="font-bold text-midnight-600 hover:text-midnight-900">ReunitePets</Link>, free forever for every pet.
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
