'use client';

/**
 * "How can you help {pet}?" Someone says how (on foot, by car, from home,
 * with gear) and when (now for half an hour, an hour or more, tonight, the
 * next search party), and the search hands them one job with a brief
 * (GET /api/public/missions/[caseNumber]/job, app/lib/jobs.js). Taking it
 * uses the route that owns the thing: a street (or, where the map has no
 * named streets, a square) is taken on the board and the search screen
 * opens on it; a need is taken; "I am going" is said to the party.
 *
 * A street needs the safety waiver, which the board asks for with
 * WAIVER_NOT_ACCEPTED; the waiver opens here and the claim goes through
 * after. Someone not in the force gets streets only; taking a need joins
 * the force first (`onJoin`), like the needs below.
 *
 * Someone with no account who wants to walk goes straight to the search
 * screen's join card, which takes a first name and the safety tick
 * instead of an account (app/mission-control, `?action=walk`). They have
 * already said "on foot" here, so they are not asked again there.
 *
 * The brief is the site's (app/lib/brief.js), with two cuts so that every
 * line is true on this page (`briefOnPage` there): nothing here says a
 * path is recorded, which happens only in the app and is said there while
 * it records; and a job that is one street is not told to "walk every
 * street in the block".
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Check, Footprints, Loader2, Phone, Wrench, ArrowRight, RotateCcw } from 'lucide-react';
import WaiverModal from '@/components/WaiverModal';
import { briefOnPage } from '@/app/lib/brief';

const WAYS = [
  { id: 'foot', label: 'On foot', sub: 'Walk a street, check hiding spots', icon: Footprints },
  { id: 'car', label: 'By car', sub: 'Drive the edge, reach a sighting fast', icon: Car },
  { id: 'home', label: 'From home', sub: 'Calls and posts, 10 minutes at a time', icon: Phone },
  { id: 'gear', label: 'With gear', sub: 'A trap, a drone, a flashlight at night', icon: Wrench },
];

const WHENS = [
  { id: 'now30', label: 'Now, 30 min' },
  { id: 'now60', label: 'Now, an hour or more' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'party', label: 'The next search party' },
];

const WAY_BUTTON =
  'flex min-h-[72px] flex-col items-start gap-0.5 rounded-2xl border-2 px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const CHIP =
  'inline-flex h-10 min-h-0 items-center rounded-full border-2 px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const PRIMARY =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-flash-400 px-5 text-base font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500 disabled:opacity-60';
const QUIET =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-midnight-200 bg-white px-4 text-sm font-bold text-midnight-800 transition hover:border-midnight-300 disabled:opacity-60';

/** Where the person is, if the browser says within a few seconds; else nothing. */
function whereAmI() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    const done = (v) => resolve(v);
    const timer = setTimeout(() => done(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { maximumAge: 60000, timeout: 3500 }
    );
  });
}

async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function HelpIntake({ name, caseId, caseNumber, signedIn, member, force, missionHref, onJoin, onChanged }) {
  const router = useRouter();
  const [way, setWay] = useState('foot');
  const [when, setWhen] = useState('now30');
  const [stage, setStage] = useState('ask'); // ask | loading | job | taken
  const [picked, setPicked] = useState(null); // the API's answer
  const [job, setJob] = useState(null); // the job on screen (the pick, or an alternative)
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const retry = useRef(null);

  useEffect(() => {
    // A different way or time means a different job; back to the question.
    setStage('ask');
    setJob(null);
    setPicked(null);
    setError('');
  }, [way, when]);

  async function ask() {
    if (!signedIn) {
      // Walking a street needs no account: the search screen takes a first name, and opens on that card.
      router.push(way === 'foot' ? `${missionHref}&action=walk` : `/login?callbackUrl=${encodeURIComponent(`/cases/${caseNumber}`)}`);
      return;
    }
    setStage('loading');
    setError('');
    const near = way === 'foot' || way === 'car' ? await whereAmI() : null;
    const q = new URLSearchParams({ way, when });
    if (near) {
      q.set('lat', String(near.lat));
      q.set('lng', String(near.lng));
    }
    const { ok, data } = await send(`/api/public/missions/${encodeURIComponent(caseNumber)}/job?${q}`, 'GET');
    if (!ok) {
      setError(data.error || 'Could not find a job right now. Try again in a moment.');
      setStage('ask');
      return;
    }
    setPicked(data);
    setJob(data.job);
    setStage('job');
  }

  async function claimBlocks(j) {
    // One person holds one street at a time: the job's first is the one taken.
    const { ok, status, data } = await send(`/api/mission/${caseId}/board`, 'PATCH', { unit: j.unit || 'block', id: j.id, action: 'claim' });
    if (!ok) {
      if (status === 403 && data.code === 'WAIVER_NOT_ACCEPTED') {
        retry.current = () => take(j);
        setWaiver(true);
        return false;
      }
      if (data.code === 'TAKEN') {
        setError(`${j.labels?.[0] || 'That street'} was just taken. Ask for another.`);
        return false;
      }
      throw new Error(data.error || 'That did not go through. Try again in a moment.');
    }
    return true;
  }

  async function take(j) {
    if (!j) return;
    setBusy(true);
    setError('');
    try {
      if (j.kind === 'block') {
        const claimed = await claimBlocks(j);
        if (claimed) router.push(missionHref);
        return;
      }
      if (!member) {
        onJoin(() => take(j));
        return;
      }
      if (j.kind === 'need') {
        const { ok, data } = await send(`/api/rescue-forces/${force.id}/needs/${j.id}`, 'POST', { action: 'take' });
        if (!ok) throw new Error(data.error || 'That did not go through. Try again in a moment.');
      } else if (j.kind === 'party') {
        const { ok, data } = await send(`/api/rescue-forces/${force.id}/posts/${j.id}/going`, 'POST', { going: true });
        if (!ok) throw new Error(data.error || 'That did not go through. Try again in a moment.');
      }
      setStage('taken');
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const wayLabel = WAYS.find((w) => w.id === way)?.label || 'On foot';
  const brief = briefOnPage(picked?.brief, job);

  return (
    <div className="rounded-2xl border-2 border-midnight-200 bg-white p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-midnight-900">How can you help {name}?</h3>
      <p className="mt-0.5 text-sm text-midnight-600">
        Say how and when. You get one job, sized to the time you have, with a brief.
      </p>

      <div role="radiogroup" aria-label="How you can help" className="mt-3 grid grid-cols-2 gap-2">
        {WAYS.map((w) => {
          const on = w.id === way;
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setWay(w.id)}
              className={`${WAY_BUTTON} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-900 hover:border-midnight-300'}`}
            >
              <w.icon size={20} className={on ? 'text-flash-400' : 'text-midnight-700'} aria-hidden="true" />
              <span className="text-[15px] font-bold leading-tight">{w.label}</span>
              <span className={`text-xs leading-snug ${on ? 'text-midnight-200' : 'text-midnight-500'}`}>{w.sub}</span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label="When" className="mt-3 flex flex-wrap gap-2">
        {WHENS.map((t) => {
          const on = t.id === when;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setWhen(t.id)}
              className={`${CHIP} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-800 hover:border-midnight-300'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {stage !== 'job' && stage !== 'taken' && (
        <div className="mt-4">
          <button type="button" onClick={ask} disabled={stage === 'loading'} className={PRIMARY}>
            {stage === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
            {stage === 'loading' ? 'Finding your job' : 'Give me a job'}
          </button>
          <p className="mt-2 text-center text-xs text-midnight-500">
            Every job is a real need or a street nobody has walked. Nothing is made up to keep you busy.
          </p>
        </div>
      )}

      {stage === 'job' && !job && (
        <div className="mt-4 rounded-xl bg-midnight-50 p-4 text-sm text-midnight-700">
          <p className="font-semibold text-midnight-900">Nothing fits that right now.</p>
          <p className="mt-1">
            {picked?.force && !picked.member
              ? `Join ${picked.force.name} to take its needs, or pick "On foot" for a street to walk.`
              : 'Try another way or time.'}
          </p>
          {picked?.force && !picked.member && (
            <button type="button" onClick={() => onJoin(ask)} className={`${QUIET} mt-3`}>
              Join {picked.force.name}
            </button>
          )}
        </div>
      )}

      {stage === 'job' && job && (
        <div className="mt-4 rounded-2xl border-2 border-flash-400 bg-white p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-midnight-500">
            Your job · {wayLabel.toLowerCase()} · about {job.minutes} min
          </p>
          <p className="mt-1 text-lg font-bold leading-snug text-midnight-900">{job.title}</p>
          {job.why && <p className="mt-1 text-sm text-midnight-600">{job.why}</p>}
          {brief.length > 0 && (
            <ol className="mt-3 space-y-2">
              {brief.map((line, i) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-midnight-800">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${i === brief.length - 1 ? 'bg-red-600' : 'bg-midnight-900'}`}>
                    {i === brief.length - 1 ? '!' : i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => take(job)} disabled={busy} className={`${PRIMARY} sm:flex-1`}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />}
              {job.kind === 'block' ? (job.unit === 'street' ? 'I will walk it' : `Take it. Claim ${job.labels?.join(' and ') || 'the block'}`) : job.kind === 'party' ? 'I am going' : 'I will do it'}
            </button>
            {picked?.alternatives?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const [next, ...rest] = picked.alternatives;
                  setPicked({ ...picked, alternatives: [...rest, job] });
                  setJob(next);
                  setError('');
                }}
                disabled={busy}
                className={QUIET}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Something else
              </button>
            )}
          </div>
          {job.kind === 'block' && (
            <p className="mt-2 text-xs text-midnight-500">The map opens on it. Nobody else is sent there while you have it.</p>
          )}
        </div>
      )}

      {stage === 'taken' && job && (
        <div className="mt-4 rounded-2xl bg-midnight-900 p-4 text-white">
          <p className="font-bold">You are on it: {job.title}</p>
          <p className="mt-1 text-sm text-midnight-200">
            {job.kind === 'party'
              ? 'The force sees you are coming. Streets are handed out when it meets.'
              : 'It is yours in the list below. Tap Done there when you finish, and the next job is a tap away.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setStage('ask');
              setJob(null);
            }}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
          >
            Another job
          </button>
        </div>
      )}

      {error && stage !== 'job' && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

      {waiver && (
        <WaiverModal
          isOpen={true}
          onClose={() => setWaiver(false)}
          onAccepted={() => {
            setWaiver(false);
            const run = retry.current;
            retry.current = null;
            if (run) run();
          }}
        />
      )}
    </div>
  );
}
