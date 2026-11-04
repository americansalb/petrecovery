'use client';

/**
 * The pet's share link, /join/[id]: the page a stranger opens from a text,
 * a group chat or a flyer. No account. Two things they can do, one screen
 * each:
 *
 *   I've seen {pet}   where (map), how sure, which way, a note, a name,
 *                     then it is sent (app/lib/witness.js): the owner's
 *                     phone, the forces' bells and pushes, the board.
 *   Join the search   a name, where they are (if they choose), the
 *                     safety waiver, then the brief and the way in.
 *
 * `?action=sighting` opens the first directly (the pet's page sends a
 * signed-out "I've seen" here). Data: /api/mission/[id]/join-info, the
 * whitelist that is safe for anyone holding the link.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronRight, Eye, Loader2, MapPin, Navigation, Users } from 'lucide-react';
import LocationPicker from '@/app/components/report/LocationPicker';
import { describePet } from '@/app/lib/species';
import { timeAgo } from '@/app/lib/caseLabels';
import { briefFor } from '@/app/lib/brief';
import { announce, triggerHaptic } from '@/app/lib/missionControl/accessibility';

const YELLOW =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-flash-400 px-5 text-base font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-600 disabled:opacity-60';
const OUTLINE =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-midnight-200 bg-white px-5 text-base font-bold text-midnight-900 transition hover:border-midnight-400 hover:bg-midnight-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-60';
const INPUT =
  'w-full rounded-2xl border-2 border-midnight-200 bg-white px-4 py-3 text-[16px] text-midnight-900 placeholder:text-midnight-400 focus:border-flash-400 focus:outline-none focus:ring-4 focus:ring-flash-100';
const CHIP =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const LABEL = 'block text-xs font-extrabold uppercase tracking-wide text-midnight-500';

const SURE_CHOICES = (name) => [
  { id: 'SURE', label: `Sure it was ${name}` },
  { id: 'LIKELY', label: `Looked like ${name}` },
  { id: 'UNSURE', label: 'Not sure' },
];
const DIRECTIONS = [
  { id: 'NORTH', label: 'North' },
  { id: 'EAST', label: 'East' },
  { id: 'SOUTH', label: 'South' },
  { id: 'WEST', label: 'West' },
];

function deviceIdFromStorage() {
  try {
    let id = localStorage.getItem('petrecovery_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 15);
      localStorage.setItem('petrecovery_device_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`${CHIP} ${on ? 'border-flash-400 bg-flash-400 text-midnight-900' : 'border-midnight-200 bg-white text-midnight-800 hover:border-midnight-400'}`}
    >
      {on && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** The pet, as the top of every screen: who this is about. */
function PetCard({ info, name }) {
  const pet = info.pet || {};
  const searching = info.stats?.activeVolunteers || 0;
  const done = info.stats?.zonesSearched || 0;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
      {pet.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pet.photoUrl} alt={name} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-red-500" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-midnight-100 text-midnight-500">
          <Eye className="h-8 w-8" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-red-600">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          Lost{info.lastSeenAt ? ` ${timeAgo(info.lastSeenAt)}` : ''}
        </p>
        <h1 className="truncate text-2xl font-extrabold text-midnight-900">{name}</h1>
        <p className="truncate text-midnight-700">{describePet({ species: pet.species, breed: pet.breed, color: pet.color })}</p>
        <p className="mt-1 text-sm text-midnight-500">
          {info.lastSeenPlace ? `Last seen near ${info.lastSeenPlace}. ` : ''}
          {searching > 0 ? `${searching} ${searching === 1 ? 'person' : 'people'} searching now` : done > 0 ? `${done} blocks searched` : 'The search is on'}
          {searching > 0 && done > 0 ? `, ${done} blocks searched` : ''}.
        </p>
      </div>
    </div>
  );
}

function Card({ title, text, children }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-midnight-200">
      <h1 className="text-2xl font-extrabold text-midnight-900">{title}</h1>
      {text && <p className="mt-2 text-midnight-600">{text}</p>}
      {children && <div className="mt-5 space-y-3">{children}</div>}
    </div>
  );
}

export default function JoinPageClient() {
  const { missionId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const wantsSighting = search.get('action') === 'sighting';

  const [screen, setScreen] = useState('loading'); // loading | home | seen | sent | join | in | gone | closed | error
  const [info, setInfo] = useState(null);
  const [volunteerId, setVolunteerId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The sighting
  const [where, setWhere] = useState(null);
  const [sure, setSure] = useState('LIKELY');
  const [direction, setDirection] = useState(null);
  const [note, setNote] = useState('');
  const [who, setWho] = useState('');
  const [sent, setSent] = useState(null);

  // Joining
  const [here, setHere] = useState(null); // { lat, lng, accuracy }
  const [locating, setLocating] = useState(false);
  const [waiver, setWaiver] = useState(null);
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const name = info?.pet?.name || 'the pet';
  const caseNumber = info?.case?.caseNumber || missionId;
  const petHref = `/cases/${encodeURIComponent(caseNumber)}`;
  const brief = useMemo(
    () => (info ? briefFor({ way: 'foot', pet: { petName: info.pet?.name, petSpecies: info.pet?.species, petColor: info.pet?.color, petBreed: info.pet?.breed } }) : []),
    [info]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mission/${encodeURIComponent(missionId)}/join-info`);
        if (cancelled) return;
        if (res.status === 404) return setScreen('gone');
        if (!res.ok) return setScreen('error');
        const data = await res.json();
        setInfo(data);
        if (['INACTIVE', 'RESOLVED', 'CLOSED'].includes(data.mode)) return setScreen('closed');
        let joined = null;
        try {
          joined = localStorage.getItem(`mission_${missionId}_volunteer`);
        } catch {
          /* no storage: a fresh visit */
        }
        if (joined) setVolunteerId(joined);
        setScreen(wantsSighting ? 'seen' : joined ? 'in' : 'home');
      } catch {
        if (!cancelled) setScreen('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionId, wantsSighting]);

  // The waiver text, read here rather than behind a link.
  useEffect(() => {
    if (screen !== 'join' || waiver) return;
    fetch('/api/legal/documents/liability-waiver')
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => doc && setWaiver(doc))
      .catch(() => {});
  }, [screen, waiver]);

  async function sendSighting() {
    if (busy) return;
    if (!where) return setError(`Mark where you saw ${name} on the map.`);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/public/missions/${encodeURIComponent(missionId)}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: where.lat, lng: where.lng, address: where.address || '', sure, direction, note, name: who }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not send. Check your connection and try again.');
      setSent(data);
      triggerHaptic('success');
      announce(`Sighting sent. ${name}'s owner was told.`, 'assertive');
      setScreen('sent');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) return setError('This browser cannot share your location. You can still join.');
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Your location did not come through. You can still join.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function join() {
    if (busy) return;
    if (!agreed) return setError('Accept the safety waiver to join.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/mission/${encodeURIComponent(missionId)}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN',
          deviceId: deviceIdFromStorage(),
          location: here,
          name: who.trim() || undefined,
          waiverAccepted: true,
          waiverVersion: waiver?.version || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'That did not go through. Try again in a moment.');
      setVolunteerId(data.volunteerId);
      try {
        localStorage.setItem(`mission_${missionId}_volunteer`, data.volunteerId);
      } catch {
        /* no storage: the page still works for this visit */
      }
      triggerHaptic('success');
      announce('You are in the search.', 'polite');
      setScreen('in');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const go = (next) => {
    setError('');
    setScreen(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  let body;
  if (screen === 'loading') {
    body = (
      <div className="flex items-center justify-center gap-2 py-16 text-midnight-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading the search
      </div>
    );
  } else if (screen === 'gone') {
    body = (
      <Card title="This link does not match a pet" text="Ask whoever sent it for a fresh link, or look at the reports near you.">
        <Link href="/lost-and-found" className={OUTLINE}>Lost and found near you</Link>
      </Card>
    );
  } else if (screen === 'error') {
    body = (
      <Card title="The search did not load" text="Check your connection and try again.">
        <button type="button" className={YELLOW} onClick={() => router.refresh()}>Try again</button>
      </Card>
    );
  } else if (screen === 'closed') {
    const home = info?.mode === 'RESOLVED';
    body = (
      <Card title={home ? `${name} is home` : 'This search has ended'} text={home ? 'The owner marked the search over. Thank you for looking.' : 'The owner closed this search. Thank you for wanting to help.'}>
        <Link href={petHref} className={OUTLINE}>Open {name}&apos;s page</Link>
      </Card>
    );
  } else if (screen === 'home') {
    body = (
      <>
        <PetCard info={info} name={name} />
        <div className="mt-4 space-y-3">
          <button type="button" className={YELLOW} onClick={() => go('seen')}>
            <Eye className="h-5 w-5" aria-hidden="true" /> I&apos;ve seen {name}
          </button>
          <button type="button" className={OUTLINE} onClick={() => go('join')}>
            <Users className="h-5 w-5" aria-hidden="true" /> Join the search
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-midnight-500">No account needed. Your location is shared only when you choose to.</p>
        <Link href={petHref} className="mt-6 flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
          <span className="font-semibold text-midnight-800">Everything about {name}: the map, what happened, how to help</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-midnight-400" aria-hidden="true" />
        </Link>
      </>
    );
  } else if (screen === 'seen') {
    body = (
      <>
        <PetCard info={info} name={name} />
        <h2 className="mt-6 text-xl font-extrabold text-midnight-900">Where did you see {name}?</h2>
        <p className="mt-1 text-midnight-600">Search for the street or use your location, then drag the pin to the spot.</p>
        <div className="mt-3">
          <LocationPicker value={where} onChange={setWhere} variant="lost" />
        </div>

        <fieldset className="mt-6">
          <legend className={LABEL}>How sure are you?</legend>
          <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
            {SURE_CHOICES(name).map((c) => (
              <Chip key={c.id} on={sure === c.id} onClick={() => setSure(c.id)}>{c.label}</Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className={LABEL}>Which way did {name} go?</legend>
          <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => (
              <Chip key={d.id} on={direction === d.id} onClick={() => setDirection(direction === d.id ? null : d.id)}>{d.label}</Chip>
            ))}
            <Chip on={direction === null} onClick={() => setDirection(null)}>Didn&apos;t see</Chip>
          </div>
        </fieldset>

        <label htmlFor="seen-note" className={`${LABEL} mt-5`}>What did you see?</label>
        <textarea
          id="seen-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={`Collar on? Limping? With someone? Anything helps.`}
          className={`${INPUT} mt-2`}
        />

        <label htmlFor="seen-name" className={`${LABEL} mt-5`}>Your first name</label>
        <input id="seen-name" type="text" value={who} onChange={(e) => setWho(e.target.value)} maxLength={60} placeholder="Optional" className={`${INPUT} mt-2`} autoComplete="given-name" />

        {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-5 space-y-3">
          <button type="button" className={YELLOW} onClick={sendSighting} disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <MapPin className="h-5 w-5" aria-hidden="true" />}
            {busy ? 'Sending' : `Send it to everyone searching`}
          </button>
          <button type="button" className={OUTLINE} onClick={() => go(volunteerId ? 'in' : 'home')}>Back</button>
        </div>
        <p className="mt-4 text-sm text-midnight-600">
          If {name} is in sight now, don&apos;t chase or call out. Sit down, look away, and keep watching from where you are.
        </p>
      </>
    );
  } else if (screen === 'sent') {
    const owner = sent?.ownerName || info?.owner?.name;
    const dog = String(info?.pet?.species || '').toUpperCase() === 'DOG';
    body = (
      <>
        <div className="rounded-2xl bg-midnight-900 p-6 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-flash-400 text-midnight-900">
            <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-extrabold">Sent{sent?.place ? `: ${name} near ${sent.place}` : ''}</h2>
          <p className="mt-2 text-midnight-200">
            {owner ? `${owner} was told.` : 'The owner was told.'}
            {sent?.told?.bell > 0 ? ` So were the ${sent.told.bell} people in the force looking for ${name}.` : ''}
          </p>
        </div>
        <h3 className="mt-6 text-lg font-extrabold text-midnight-900">What to do now</h3>
        <ol className="mt-2 space-y-2.5 text-[15px] text-midnight-800">
          <li className="flex gap-3"><span className="font-extrabold text-midnight-400">1</span>Stay where you can see {name}, if you still can. Don&apos;t chase or call out{dog ? '; a scared dog runs from strangers' : ''}.</li>
          <li className="flex gap-3"><span className="font-extrabold text-midnight-400">2</span>If {name} moves, send another sighting from here with the new spot.</li>
          <li className="flex gap-3"><span className="font-extrabold text-midnight-400">3</span>{owner ? `${owner} may call if you left a name on the pet's page; the search comes to you.` : 'The search comes to where you marked.'}</li>
        </ol>
        <div className="mt-6 space-y-3">
          <button type="button" className={YELLOW} onClick={() => { setWhere(null); setNote(''); go('seen'); }}>
            <Eye className="h-5 w-5" aria-hidden="true" /> {name} moved: send where
          </button>
          <Link href={petHref} className={OUTLINE}>Open {name}&apos;s page</Link>
          {!volunteerId && (
            <button type="button" className={OUTLINE} onClick={() => go('join')}>
              <Users className="h-5 w-5" aria-hidden="true" /> Join the search
            </button>
          )}
        </div>
      </>
    );
  } else if (screen === 'join') {
    body = (
      <>
        <PetCard info={info} name={name} />
        <h2 className="mt-6 text-xl font-extrabold text-midnight-900">Join the search for {name}</h2>
        <p className="mt-1 text-midnight-600">A name so the team knows who is out, where you are if you want to share it, and the safety waiver. Then the brief.</p>

        <label htmlFor="join-name" className={`${LABEL} mt-5`}>Your first name</label>
        <input id="join-name" type="text" value={who} onChange={(e) => setWho(e.target.value)} maxLength={60} placeholder="Optional" className={`${INPUT} mt-2`} autoComplete="given-name" />

        <p className={`${LABEL} mt-5`}>Where you are</p>
        <button type="button" className={`${OUTLINE} mt-2`} onClick={locate} disabled={locating || Boolean(here)}>
          {locating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : here ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /> : <Navigation className="h-5 w-5" aria-hidden="true" />}
          {here ? 'Got it. The team sees roughly where you are' : locating ? 'Finding you' : 'Share my location'}
        </button>
        <p className="mt-1.5 text-sm text-midnight-500">Optional. It puts you on the map for the people coordinating so the gaps go to whoever is nearest.</p>

        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 rounded border-midnight-300 text-flash-500 focus:ring-flash-400" />
            <span className="text-[15px] text-midnight-800">
              I accept the{' '}
              <button type="button" onClick={() => setWaiverOpen((v) => !v)} className="inline min-h-0 min-w-0 font-bold underline underline-offset-2">
                safety waiver
              </button>
              {waiver?.version ? ` (v${waiver.version})` : ''}. I am searching voluntarily and at my own risk.
            </span>
          </label>
          {waiverOpen && (
            <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-midnight-50 p-3 text-sm text-midnight-700">
              {waiver?.content || 'Loading the waiver'}
            </div>
          )}
        </div>

        {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-5 space-y-3">
          <button type="button" className={YELLOW} onClick={join} disabled={busy || !agreed}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Users className="h-5 w-5" aria-hidden="true" />}
            {busy ? 'Joining' : 'Join and get the brief'}
          </button>
          <button type="button" className={OUTLINE} onClick={() => go('home')}>Back</button>
        </div>
      </>
    );
  } else if (screen === 'in') {
    body = (
      <>
        <div className="rounded-2xl bg-midnight-900 p-6 text-white">
          <p className="text-xs font-extrabold uppercase tracking-wide text-flash-400">You&apos;re in</p>
          <h2 className="mt-1 text-2xl font-extrabold">{who.trim() ? `${who.trim()}, you are` : 'You are'} searching for {name}</h2>
          <p className="mt-2 text-midnight-200">Read this once, then go. Everything you send from this page reaches everyone searching.</p>
        </div>
        <h3 className="mt-6 text-lg font-extrabold text-midnight-900">The brief</h3>
        <ol className="mt-2 space-y-2.5 text-[15px] text-midnight-800">
          {brief.map((line, i) => (
            <li key={line} className="flex gap-3"><span className="font-extrabold text-midnight-400">{i + 1}</span>{line}</li>
          ))}
        </ol>
        <div className="mt-6 space-y-3">
          <button type="button" className={YELLOW} onClick={() => go('seen')}>
            <Eye className="h-5 w-5" aria-hidden="true" /> I see {name}
          </button>
          <Link href={petHref} className={OUTLINE}>
            <MapPin className="h-5 w-5" aria-hidden="true" /> Open {name}&apos;s page
          </Link>
        </div>
        <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
          <p className="font-bold text-midnight-900">Want a block of your own?</p>
          <p className="mt-1 text-sm text-midnight-600">With an account you claim blocks on the map, your walk records as you go, and the force can reach you.</p>
          <Link href={`/register?callbackUrl=${encodeURIComponent(petHref)}`} className="mt-3 inline-flex min-h-[44px] items-center gap-1 font-bold text-midnight-900 underline underline-offset-2">
            Make an account <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-midnight-50 pb-16">
      <div className="mx-auto w-full max-w-lg px-4 py-5 lg:max-w-2xl lg:py-8">{body}</div>
    </main>
  );
}
