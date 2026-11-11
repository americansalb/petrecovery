'use client';

/**
 * SearchScreen - Mission Control: the search view of one pet's page.
 *
 * One step for each person: a verb, a place, a time, and when it ends.
 * One yellow button to a screen, and it is the next step in the search.
 * The line at the top always says where the search stands. It opens for
 * anyone holding the pet's link, with no account.
 *
 * One mission, three instruments (app/hooks/useInstrument.js), and they
 * do different jobs:
 *
 *   desk (desktop)        see and plan. Nobody walks from a desk, so
 *                         there is no street to take here and no GPS.
 *   phone (mobile web)    see, join, take a street, mark it by tapping,
 *                         report a sighting with one location reading.
 *                         No GPS walk: a browser cannot record with the
 *                         screen off.
 *   app (native shell)    everything the phone does, plus the GPS walk.
 *
 * Three rules on what the product says (founder, 2026-11-11):
 *   1. It never tells a helper to stop or not to search. It says what
 *      was seen, and what to do on seeing the pet.
 *   2. Holding people back is the owner's or the lead's choice, sent in
 *      their name, and a helper can decline.
 *   3. Advice wording is the advice engine's, the searcher's brief's and
 *      the owner's own answers, word for word. None is written here.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { distanceMeters } from '@/app/lib/searchGrid';
import { orientWalk, walkTitle } from '@/app/lib/streetWalks';
import useSearch from './hooks/useSearch';
import TopBar from './components/TopBar';
import PhotoView from './components/PhotoView';
import FieldGps from './components/FieldGps';
import { Stamp } from './components/kit';
import { Main, Join, Street, Walking, SightingIn, Home } from './steps/Helper';
import { Seen, SeenWay, SeenSent, SeenEarlier } from './steps/Witness';
import { OwnerNow, OwnerSighting, OwnerMore, SightingList } from './steps/Owner';
import Rail from './desktop/Rail';
import MarkReunitedModal from './components/overlays/MarkReunitedModal';
import UpdateModal from './components/modals/UpdateModal';
import FlyerPickerModal from './components/FlyerPickerModal';
import { readNote, saveNote } from './lib/identity';
import { clockTime, dayAndTime, situationLine, neighborsLine, standing, petSub } from './lib/words';
import { searcherBrief } from './lib/briefLines';

const SearchMap = dynamic(() => import('./components/SearchMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mc-ground)]" />,
});

const COMPASS_BEARING = { NORTH: 0, NORTHEAST: 45, EAST: 90, SOUTHEAST: 135, SOUTH: 180, SOUTHWEST: 225, WEST: 270, NORTHWEST: 315 };

/**
 * A reading rougher than this is not a place. A phone with precise
 * location turned off answers with a point that can be kilometres out,
 * and a sighting pinned there sends the owner to the wrong street. Past
 * this, the witness types the street instead.
 */
const SIGHTING_ACCURACY_METERS = 150;
/** One reading says where the phone was, not where it is: the "You" dot is dropped after this long. */
const POSITION_FRESH_MS = 2 * 60 * 1000;
const NO_TRACK = [];

function Centered({ children }) {
  return (
    <div className="mc-dark flex h-[100dvh] items-center justify-center bg-[var(--mc-ground)] px-5">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

const WAY_OUT =
  'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-4 text-base font-bold text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

/** A corner of a square, or an end of a street, as map points. */
function pointsOf(item, unit) {
  if (!item) return [];
  if (unit === 'street') return item.path || [];
  return [
    [item.northLat, item.westLng],
    [item.southLat, item.eastLng],
  ];
}

/** Four points a little way round a centre, so the first view is a neighbourhood and not a dot. */
function around(lat, lng, meters) {
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat + dLat, lng],
    [lat - dLat, lng],
    [lat, lng + dLng],
    [lat, lng - dLng],
  ];
}

function Screen({ mission }) {
  const params = useSearchParams();
  const missionParam = mission || params.get('mission') || params.get('caseId');
  const { instrument, resolving } = useInstrument();
  const search = useSearch(missionParam);
  const { picture, items, unit, mine: mineRaw, viewer, now, hot, position, mySightings } = search;

  const [view, setView] = useState('main');
  const [skip, setSkip] = useState(0);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState(false);
  const [gps, setGps] = useState(null);
  const [mySeen, setMySeen] = useState(null);
  const [earlierFrom, setEarlierFrom] = useState(30);
  const [pendingKind, setPendingKind] = useState(null); // "I see it now" that fell back to a typed street
  const [acked, setAcked] = useState(null);
  const [askAnswer, setAskAnswer] = useState(null);
  const [ownerStep, setOwnerStep] = useState(0);
  const [walkFrom, setWalkFrom] = useState(null);
  const [modal, setModal] = useState(null); // 'home' | 'message' | 'flyer'
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [toast, setToast] = useState('');
  const [qr, setQr] = useState(null);
  const [sheetHeight, setSheetHeight] = useState(280);
  const sheetWatch = useRef(null);

  const desk = instrument === INSTRUMENTS.COMMAND;
  const app = instrument === INSTRUMENTS.FIELD;
  const caseId = picture?.id || null;
  const name = picture?.pet?.name || 'this pet';
  const owner = picture?.owner || null;
  const isOwner = Boolean(viewer?.isOwner);
  const petHref = picture ? `/cases/${encodeURIComponent(picture.caseNumber)}` : '/lost-and-found';
  const go = useCallback((next) => {
    setProblem('');
    setView(next);
  }, []);
  const say = useCallback((words) => {
    setToast(words);
    setTimeout(() => setToast(''), 3500);
  }, []);
  // The one way this screen asks where the device is. A desk is never
  // asked: its answer is a guess from the network, and nobody walks or
  // watches a pet from one.
  const readPosition = search.locate;
  const locate = useCallback((options) => (desk ? Promise.resolve(null) : readPosition(options)), [desk, readPosition]);
  // "I've seen it": a phone is asked whether it is now, a desk goes straight to the street.
  const openSeen = useCallback(() => {
    setPendingKind(null);
    if (desk) {
      setEarlierFrom(30);
      return go('seenEarlier');
    }
    return go('seen');
  }, [desk, go]);

  // What this phone remembers about this pet.
  useEffect(() => {
    if (!caseId) return;
    setAcked(readNote(caseId, 'sighting_ack'));
    setOwnerStep(Number(readNote(caseId, 'owner_step')) || 0);
    setWalkFrom(readNote(caseId, 'walk_from'));
  }, [caseId]);
  useEffect(() => {
    if (caseId && hot) setAskAnswer(readNote(caseId, `ask_${hot.id}`));
  }, [caseId, hot]);

  // A witness coming back to the page finds what they sent, not the start.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !picture || !mySightings.length) return;
    resumed.current = true;
    const mine = mySightings[0];
    const report = picture.sightings.find((s) => s.id === mine.id);
    if (report && (report.state === 'WATCHING' || report.state === 'WITH_WITNESS') && now - new Date(report.at).getTime() < 60 * 60 * 1000) {
      setMySeen(mine);
      setView('seenSent');
    }
  }, [picture, mySightings, now]);

  // ?action=sighting: the pet's page sends "I've seen" straight here.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !picture || resolving) return;
    linked.current = true;
    if (params.get('action') === 'sighting' && picture.open) openSeen();
  }, [picture, params, resolving, openSeen]);

  // The owner opening a fresh sighting is itself news for the witness.
  useEffect(() => {
    if (isOwner && hot && !hot.ownerSeenAt) search.answer(hot.id, 'seen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, hot?.id, hot?.ownerSeenAt]);

  // A desk hands the search to a phone with a code to scan.
  useEffect(() => {
    if (!desk || !picture || isOwner) return undefined;
    let cancelled = false;
    const url = `${window.location.origin}/join/${encodeURIComponent(picture.caseNumber)}`;
    import('qrcode')
      .then((QR) => QR.toDataURL(url, { margin: 1, width: 240 }))
      .then((data) => !cancelled && setQr(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [desk, picture, isOwner]);

  // ----- The street this person is offered, and the one they hold -----
  const candidates = useMemo(() => {
    const away = (i) => (position ? distanceMeters(position, i.center) : 0);
    const free = items.filter((i) => !i.mine && (i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT')).sort((a, b) => b.priority - a.priority || away(a) - away(b));
    const again = items.filter((i) => !i.mine && i.status === 'SEARCHED').sort((a, b) => new Date(a.searchedAt) - new Date(b.searchedAt));
    return [...free, ...again];
  }, [items, position]);
  const offer = useMemo(() => {
    const raw = candidates.length ? candidates[skip % candidates.length] : null;
    if (!raw) return null;
    const turned = unit === 'street' ? orientWalk(raw, position) : raw;
    return { ...turned, searchedClock: raw.searchedAt ? dayAndTime(raw.searchedAt, picture?.timeZone, now) : '' };
  }, [candidates, skip, unit, position, picture?.timeZone, now]);
  const mine = useMemo(() => (mineRaw && unit === 'street' ? orientWalk(mineRaw, walkFrom || position) : mineRaw), [mineRaw, unit, walkFrom, position]);
  const counts = useMemo(
    () => ({ total: items.length, searched: items.filter((i) => i.status === 'SEARCHED').length, inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length }),
    [items]
  );

  // ----- A helper's actions -----
  async function startWalk() {
    setDone(null);
    if (!viewer || !viewer.waiver) return go('join');
    setBusy('walk');
    await locate();
    setBusy(null);
    setSkip(0);
    return go('street');
  }
  async function afterJoin() {
    await locate();
    setSkip(0);
    go('street');
  }
  async function claim() {
    if (!offer || busy) return;
    setBusy('go');
    setProblem('');
    const result = await search.act(unit, offer.id, 'claim');
    setBusy(null);
    if (result.error) {
      if (result.code === 'WAIVER_NOT_ACCEPTED' || result.code === 'NOT_JOINED') return go('join');
      setProblem(result.error);
      if (result.code === 'TAKEN') setSkip((s) => s + 1);
      return;
    }
    const from = position ? { lat: position.lat, lng: position.lng } : null;
    setWalkFrom(from);
    saveNote(caseId, 'walk_from', from);
    // The app records the walk. A browser does not, and does not say it does.
    if (app && gps && viewer?.signedIn) gps.start().catch(() => {});
    go('main');
  }
  async function reached() {
    if (!mineRaw || busy) return;
    setBusy('reached');
    const title = unit === 'street' ? walkTitle(mineRaw) : mineRaw.title;
    const result = await search.act(unit, mineRaw.id, 'searched');
    setBusy(null);
    if (result.error) return setProblem(result.error);
    if (gps?.recording) gps.stop().catch(() => {});
    setDone(title);
    return go('main');
  }
  async function stopWalking() {
    if (!mineRaw || busy) return;
    setBusy('stop');
    const result = await search.act(unit, mineRaw.id, 'release');
    setBusy(null);
    if (result.error) return setProblem(result.error);
    if (gps?.recording) gps.stop().catch(() => {});
    return go('main');
  }

  // ----- A witness's actions -----
  async function seeNow(kind) {
    if (busy) return;
    setBusy(kind);
    setProblem('');
    let here = await locate();
    // A phone's first answer can be an old, rough one. It is asked once more for a new reading before the street has to be typed.
    if (here && !(here.accuracy <= SIGHTING_ACCURACY_METERS)) here = (await locate({ fresh: true })) || here;
    if (!here || !(here.accuracy <= SIGHTING_ACCURACY_METERS)) {
      setBusy(null);
      setEarlierFrom(0);
      setPendingKind(kind);
      setProblem(here ? 'Your phone only gave a rough location. Type the street or the corner instead.' : 'Your phone did not share where you are. Type the street instead.');
      setView('seenEarlier');
      return;
    }
    const result = await search.sendSighting({ lat: here.lat, lng: here.lng, sure: 'LIKELY', state: kind === 'with' ? 'WITH_WITNESS' : 'WATCHING' }, kind);
    setBusy(null);
    if (result.error) return setProblem(result.error);
    setMySeen(result.sighting);
    go(kind === 'with' ? 'seenSent' : 'seenWay');
  }
  async function sendWay(patch) {
    if (!mySeen) return go('seenSent');
    setBusy('way');
    const result = patch ? await search.updateSighting(mySeen, patch) : { ok: true };
    setBusy(null);
    if (result.error) return setProblem(result.error);
    return go('seenSent');
  }
  async function witnessState(state) {
    if (!mySeen || busy) return;
    setBusy(state);
    const result = await search.updateSighting(mySeen, { state });
    setBusy(null);
    if (result.error) setProblem(result.error);
  }
  async function sendEarlier(body) {
    setBusy('earlier');
    setProblem('');
    // "I see it now" that had to be typed is still someone watching the pet.
    const live = Boolean(pendingKind) && body.minutesAgo === 0;
    const kind = live ? pendingKind : 'earlier';
    const result = await search.sendSighting({ ...body, sure: 'LIKELY', ...(live ? { state: kind === 'with' ? 'WITH_WITNESS' : 'WATCHING' } : {}) }, kind);
    setBusy(null);
    if (result.error) return setProblem(result.error);
    setPendingKind(null);
    setMySeen(result.sighting);
    return go(kind === 'now' ? 'seenWay' : 'seenSent');
  }

  // ----- The owner's actions -----
  async function hold(on) {
    if (!hot) return;
    setBusy('hold');
    const result = await search.answer(hot.id, on ? 'hold' : 'release');
    setBusy(null);
    if (result.error) setProblem(result.error);
  }
  async function going() {
    if (!hot || busy) return;
    setBusy('going');
    const here = await locate();
    const meters = here && here.accuracy <= SIGHTING_ACCURACY_METERS ? distanceMeters(here, hot) : NaN;
    const etaMinutes = Number.isFinite(meters) && meters < 3000 ? Math.max(1, Math.ceil(meters / 80)) : undefined;
    const result = await search.answer(hot.id, 'going', { etaMinutes });
    setBusy(null);
    if (result.error) setProblem(result.error);
  }
  async function confirmHome({ resolution, resolutionNotes }) {
    setSaving(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/missions/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REUNITED', resolution, resolutionNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Could not update the search');
      }
      setModal(null);
      await search.reload();
    } catch (error) {
      setModalError(error.message);
    } finally {
      setSaving(false);
    }
  }
  function nextOwnerStep(next) {
    setOwnerStep(next);
    saveNote(caseId, 'owner_step', next);
  }

  function share() {
    if (!picture) return;
    const url = `${window.location.origin}/join/${encodeURIComponent(picture.caseNumber)}`;
    const place = picture.lastSeen?.place ? ` near ${picture.lastSeen.place}` : '';
    const payload = { title: `Help find ${name}`, text: `${name} is lost${place}. This page shows where to look and how to send a sighting.`, url };
    if (navigator.share) {
      navigator.share(payload).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => say('Link copied. Paste it into a text or a group.')).catch(() => {});
    }
  }

  // ----- Which step this person is on -----
  const witnessing = view.startsWith('seen');
  const myHot = Boolean(hot && (mySeen?.id === hot.id || mySightings.some((m) => m.id === hot.id)));
  const sightingIn = Boolean(hot && !isOwner && !myHot && acked !== hot.id && !witnessing && view !== 'join');
  const ownerSighting = Boolean(hot && isOwner && view === 'main');
  // Where this person is, to themselves: the app's recorded path while it
  // records, otherwise the one reading while it is fresh.
  const track = app && gps?.recording && Array.isArray(gps.path) && gps.path.length ? gps.path : NO_TRACK;
  const lastMark = track.length ? track[track.length - 1] : null;
  const fresh = position && now - position.at < POSITION_FRESH_MS ? position : null;
  const me = useMemo(
    () => (lastMark ? { lat: lastMark.lat, lng: lastMark.lng } : fresh ? { lat: fresh.lat, lng: fresh.lng } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastMark?.lat, lastMark?.lng, fresh?.lat, fresh?.lng]
  );
  const awayFrom = mine ? mine.center : position;
  const awayMeters = hot && awayFrom ? distanceMeters(awayFrom, hot) : NaN;

  // ----- The map -----
  const zone = picture?.timeZone;
  const lastSeenTag = useMemo(() => {
    const at = picture?.lastSeen;
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
    return { lat: at.lat, lng: at.lng, label: `Lost here ${dayAndTime(at.at, zone, now)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture?.lastSeen?.lat, picture?.lastSeen?.lng, picture?.lastSeen?.at, zone, Math.floor(now / 60000)]);
  const mapSightings = useMemo(
    () =>
      standing(picture?.sightings || [])
        .slice(0, 6)
        .map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: `Seen ${dayAndTime(s.at, zone, now)}`, hot: hot?.id === s.id, bearing: COMPASS_BEARING[s.direction] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture?.sightings, zone, hot?.id, Math.floor(now / 60000)]
  );
  const mapStreets = useMemo(() => (unit === 'street' ? items.map((i) => ({ id: i.id, path: i.path, status: i.status, mine: i.mine, who: i.claimedByName || null })) : []), [unit, items]);
  const mapCells = useMemo(() => (unit === 'block' ? items : []), [unit, items]);
  const offering = view === 'street' && !mine && !sightingIn;
  const walking = Boolean(mine) && !witnessing;
  const lit = walking ? mine : offering ? offer : null;
  const mapTags = useMemo(() => {
    if (!lit || unit !== 'street' || !lit.path?.length) return [];
    const first = lit.path[0];
    const last = lit.path[lit.path.length - 1];
    // Each end's words sit beyond the end of the line, so they never cover the street.
    const northFirst = first[0] >= last[0];
    const tags = [{ lat: last[0], lng: last[1], text: `End: ${lit.toName || 'the end'}`, tone: 'flash', side: northFirst ? 'below' : 'above' }];
    if (!walking) tags.push({ lat: first[0], lng: first[1], text: `Start: ${lit.fromName || 'here'}`, side: northFirst ? 'above' : 'below' });
    return tags;
  }, [lit, unit, walking]);
  const fit = useMemo(() => {
    const me = position ? [[position.lat, position.lng]] : [];
    if (hot && (sightingIn || ownerSighting)) return [[hot.lat, hot.lng], ...around(hot.lat, hot.lng, desk ? 420 : 180), ...(mine ? pointsOf(mine, unit) : me)];
    if (lit) return [...pointsOf(lit, unit), ...me];
    if (lastSeenTag) return [...around(lastSeenTag.lat, lastSeenTag.lng, 330), ...mapSightings.slice(0, 3).map((s) => [s.lat, s.lng])];
    return [];
  }, [hot, sightingIn, ownerSighting, mine, lit, unit, position, lastSeenTag, mapSightings, desk]);
  const fitKey = `${sightingIn || ownerSighting ? `seen:${hot?.id}` : lit ? `lit:${lit.id}` : 'home'}|${lastSeenTag ? 1 : 0}|${desk}|${Math.round(sheetHeight / 40)}`;

  // The sheet's height, so the map keeps what matters above it.
  const sheetRef = useCallback((el) => {
    if (sheetWatch.current) sheetWatch.current.disconnect();
    sheetWatch.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    sheetWatch.current = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    sheetWatch.current.observe(el);
    setSheetHeight(el.offsetHeight);
  }, []);

  // ----- Gates -----
  if (!missionParam) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-[var(--mc-ink)]">No search is open</h1>
        <p className="mt-2 text-[17px] text-[var(--mc-soft)]">A search opens from a lost pet&apos;s page.</p>
        <Link href="/lost-and-found" className={`${WAY_OUT} mt-6`}>
          Lost and found near you
        </Link>
      </Centered>
    );
  }
  if (search.loading || resolving || (!picture && !search.failure)) {
    return (
      <Centered>
        <Loader2 size={36} className="mx-auto animate-spin text-flash-400" aria-hidden="true" />
        <p className="mt-4 text-[17px] text-[var(--mc-soft)]">Opening the search</p>
      </Centered>
    );
  }
  if (search.failure || !picture) {
    const gone = search.failure === 'gone';
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-[var(--mc-ink)]">{gone ? 'This link does not match a pet' : 'The search did not load'}</h1>
        <p className="mt-2 text-[17px] text-[var(--mc-soft)]">{gone ? 'Ask whoever sent it for a fresh link.' : 'Check your connection and try again.'}</p>
        {!gone && (
          <button type="button" onClick={() => window.location.reload()} className={`${WAY_OUT} mt-6`}>
            Try again
          </button>
        )}
        <Link href="/lost-and-found" className={`${WAY_OUT} mt-3`}>
          Lost and found near you
        </Link>
      </Centered>
    );
  }
  if (picture.reportType === 'FOUND') {
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-[var(--mc-ink)]">This pet was found, not lost</h1>
        <p className="mt-2 text-[17px] text-[var(--mc-soft)]">There is no search to join. Its page says how to claim it.</p>
        <Link href={petHref} className={`${WAY_OUT} mt-6`}>
          Open the page
        </Link>
      </Centered>
    );
  }

  // The search is over: one screen for everyone.
  if (!picture.open) {
    return (
      <div className="mc-dark flex h-[100dvh] flex-col overflow-y-auto bg-[var(--mc-surface)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Home picture={picture} name={name} owner={owner} petHref={petHref} />
        </div>
      </div>
    );
  }

  const line = isOwner && !hot && picture.neighbors?.told ? { text: neighborsLine(picture.neighbors, name), tone: 'lost' } : situationLine(picture, now);

  // ----- The step -----
  let step;
  let full = false; // a step that takes the whole phone screen, with no map behind it
  if (view === 'seen') {
    full = true;
    step = <Seen picture={picture} name={name} owner={owner} onNow={() => seeNow('now')} onWithMe={() => seeNow('with')} onEarlier={() => { setEarlierFrom(30); go('seenEarlier'); }} onBack={() => go('main')} busy={busy} problem={problem} />;
  } else if (view === 'seenWay' && mySeen) {
    full = true;
    const report = picture.sightings.find((s) => s.id === mySeen.id);
    const spot = report ? [{ id: report.id, lat: report.lat, lng: report.lng, label: 'You saw ' + name + ' here', hot: true }] : [];
    step = (
      <SeenWay
        picture={picture}
        name={name}
        owner={owner}
        mine={mySeen}
        streets={unit === 'street' ? [...items, ...search.around] : []}
        map={report ? <SearchMap theme="dark" sightings={spot} fit={around(report.lat, report.lng, 110)} fitKey={`way:${report.id}`} label={`Map of where you saw ${name}`} /> : null}
        onPick={(way) => sendWay({ direction: way.compass, toward: way.toward || '' })}
        onStaying={() => sendWay({ direction: 'STAYING', toward: '' })}
        onUnsure={() => sendWay(null)}
        onClose={() => go('seenSent')}
        busy={Boolean(busy)}
        problem={problem}
      />
    );
  } else if (view === 'seenSent' && mySeen) {
    full = true;
    step = (
      <SeenSent
        picture={picture}
        name={name}
        owner={owner}
        mine={mySeen}
        onState={witnessState}
        onAgain={openSeen}
        onChangeWay={() => go('seenWay')}
        onDone={() => go('main')}
        busy={busy}
        problem={problem}
      />
    );
  } else if (view === 'seenEarlier') {
    full = true;
    step = <SeenEarlier name={name} owner={owner} onSend={sendEarlier} onBack={() => go(desk ? 'main' : 'seen')} busy={busy === 'earlier'} problem={problem} startMinutes={earlierFrom} canLocate={!desk} />;
  } else if (isOwner && view === 'more') {
    step = <OwnerMore picture={picture} name={name} now={now} petHref={petHref} onClose={() => go('main')} onShare={share} onMessage={() => setModal('message')} onFlyer={() => setModal('flyer')} onSightings={() => go('sightings')} onEnd={() => setModal('home')} />;
  } else if (isOwner && view === 'sightings') {
    step = <SightingList picture={picture} name={name} now={now} onClose={() => go('more')} />;
  } else if (ownerSighting) {
    step = <OwnerSighting picture={picture} name={name} hot={hot} awayMeters={me ? distanceMeters(me, hot) : NaN} helpers={picture.looking?.helpers || 0} onHold={hold} onGoing={going} onHome={() => setModal('home')} onMore={() => go('more')} busy={busy} problem={problem} />;
  } else if (isOwner) {
    step = <OwnerNow picture={picture} name={name} now={now} step={ownerStep} onStep={nextOwnerStep} onShare={share} onHome={() => setModal('home')} onMore={() => go('more')} />;
  } else if (sightingIn) {
    step = (
      <SightingIn
        picture={picture}
        name={name}
        owner={owner}
        hot={hot}
        ask={picture.ask && picture.ask.sightingId === hot.id ? picture.ask : null}
        mine={mine}
        awayMeters={awayMeters}
        answered={askAnswer}
        onAnswer={(value) => {
          setAskAnswer(value);
          saveNote(caseId, `ask_${hot.id}`, value);
        }}
        onSeen={openSeen}
        onBack={() => {
          setAcked(hot.id);
          saveNote(caseId, 'sighting_ack', hot.id);
        }}
        onShare={mine ? null : share}
      />
    );
  } else if (mine) {
    step = <Walking picture={picture} name={name} owner={owner} unit={unit} mine={mine} instrument={instrument} gps={gps} onReached={reached} onStop={stopWalking} onSeen={openSeen} busy={busy === 'reached'} problem={problem} />;
  } else if (view === 'join') {
    step = <Join picture={picture} name={name} owner={owner} viewer={viewer} unit={unit} search={search} onJoined={afterJoin} onBack={() => go('main')} />;
  } else if (view === 'street') {
    step = <Street name={name} owner={owner} unit={unit} offer={offer} counts={counts} onGo={claim} onOther={() => { setProblem(''); setSkip((s) => s + 1); }} onSeen={openSeen} busy={busy === 'go'} problem={problem} canOther={candidates.length > 1} />;
  } else {
    step = <Main picture={picture} name={name} owner={owner} unit={unit} items={items} counts={counts} offer={offer} done={done} instrument={instrument} onWalk={startWalk} onSeen={openSeen} onShare={share} busy={busy === 'walk'} problem={problem} qr={qr} />;
  }

  const overlays = (
    <>
      {photo && <PhotoView pet={picture.pet} onClose={() => setPhoto(false)} />}
      {app && viewer?.signedIn && <FieldGps caseId={caseId} lastSeen={picture.lastSeen} onChange={setGps} />}
      {toast && (
        <p role="status" className="fixed left-4 right-4 top-[calc(76px+env(safe-area-inset-top))] z-[800] rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-xl lg:left-auto lg:w-96">
          {toast}
        </p>
      )}
      {modal === 'home' && (
        <div className="relative z-[850]">
          <MarkReunitedModal mission={{ petName: name }} onClose={() => setModal(null)} onConfirm={confirmHome} isSaving={saving} error={modalError} />
        </div>
      )}
      {modal === 'message' && (
        <div className="relative z-[850]">
          <UpdateModal missionId={caseId} petName={name} onClose={() => setModal(null)} onPosted={() => { setModal(null); say('Posted. Everyone helping sees it.'); }} />
        </div>
      )}
      {modal === 'flyer' && (
        <div className="relative z-[850]">
          <FlyerPickerModal caseNumber={picture.caseNumber} petName={name} onClose={() => setModal(null)} onQuickFlyer={() => window.open(petHref, '_blank')} />
        </div>
      )}
    </>
  );

  const brief = searcherBrief(picture);
  const showChip = !isOwner && view === 'main' && !mine && !sightingIn && !witnessing;
  const keyBits = [
    counts.searched > 0 ? ['bar', 'Already searched'] : null,
    counts.inProgress > (mine ? 1 : 0) ? ['dots', 'Someone is on it now'] : null,
    track.length > 1 ? ['path', 'Your path'] : null,
  ].filter(Boolean);
  const map = (
    <SearchMap
      theme={desk ? 'light' : 'dark'}
      lastSeen={lit && lastSeenTag ? { ...lastSeenTag, label: '' } : lastSeenTag}
      sightings={mapSightings}
      streets={mapStreets}
      cells={mapCells}
      offered={offering ? offer?.id : null}
      me={me}
      track={track}
      tags={mapTags}
      fit={fit}
      fitKey={fitKey}
      padding={desk ? { top: 60, right: 80, bottom: 60, left: 80 } : { top: showChip ? 60 : sheetHeight > 460 ? 28 : 44, right: 64, bottom: sheetHeight + (sheetHeight > 460 ? 30 : 44), left: 64 }}
      zoomControl={desk}
      onPick={offering ? (id) => { const at = candidates.findIndex((c) => c.id === id); if (at >= 0) { setProblem(''); setSkip(at); } } : null}
      label={`Map of the search for ${name}`}
    />
  );
  const mapKey = keyBits.length > 0 && (
    <div className="pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[var(--mc-soft)]">
      {keyBits.map(([kind, words]) => (
        <span key={words} className="flex items-center gap-1.5 rounded-md bg-[var(--mc-surface)]/85 px-1.5 py-0.5">
          {kind === 'bar' ? (
            <span className="h-1.5 w-5 rounded-full bg-slate-400/70" aria-hidden="true" />
          ) : kind === 'path' ? (
            <span className="h-[3px] w-5 rounded-full bg-[var(--mc-ink)]" aria-hidden="true" />
          ) : (
            <span className="w-5 border-t-4 border-dotted border-teal-400" aria-hidden="true" />
          )}
          {words}
        </span>
      ))}
    </div>
  );

  // ----- A desk -----
  if (desk) {
    const seesNames = Boolean(viewer?.seesNames);
    return (
      <div className="mc-light flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-ground)]">
        <TopBar picture={picture} line={line} backHref={petHref} onPhoto={() => setPhoto(true)} wide />
        <div className="flex min-h-0 flex-1">
          <aside className="w-[400px] shrink-0 overflow-y-auto p-5" aria-label="Your step">
            {/* The sighting steps carry their own padding (they fill a phone's screen), so the card adds none. */}
            <div className={`rounded-2xl border border-[var(--mc-line)] bg-[var(--mc-surface)] ${full ? 'overflow-hidden pb-2' : 'p-5'}`}>{step}</div>
          </aside>
          <div className="relative min-w-0 flex-1 border-x border-[var(--mc-line)]">
            <div className="absolute inset-0 z-0">{map}</div>
            {showChip && <p className="absolute left-4 top-4 z-[400] rounded-full border border-[var(--mc-line)] bg-[var(--mc-surface)] px-3.5 py-2 text-[13px] font-bold text-[var(--mc-ink)] shadow">{brief.neverFirst}</p>}
            {mapKey && <div className="absolute bottom-4 left-4 z-[400]">{mapKey}</div>}
          </div>
          {seesNames && (
            <aside className="w-[340px] shrink-0 overflow-y-auto p-5" aria-label="The search so far">
              <Rail picture={picture} items={items} unit={unit} now={now} />
            </aside>
          )}
        </div>
        {overlays}
      </div>
    );
  }

  // ----- A phone, in a browser or in the app -----
  if (full) {
    const slim = view !== 'seen';
    return (
      <div className="mc-dark flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-surface)]">
        {slim ? (
          <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-[var(--mc-line)] px-2 pt-[env(safe-area-inset-top)]">
            <button type="button" onClick={() => go(view === 'seenEarlier' ? 'seen' : 'main')} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
              <ArrowLeft size={22} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-2">
                <span className="truncate text-[17px] font-bold leading-6 text-[var(--mc-ink)]">{name}</span>
                <Stamp kind="lost" />
              </p>
              <p className="truncate text-[13px] font-medium leading-[18px] text-[var(--mc-soft)]">{petSub({ owner: owner?.firstName, species: picture.pet?.species, color: picture.pet?.color, breed: picture.pet?.breed })}</p>
            </div>
          </header>
        ) : (
          <button type="button" onClick={() => go('main')} aria-label="Back to the map" className="absolute left-3 top-[calc(12px+env(safe-area-inset-top))] z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/70 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{step}</div>
        {overlays}
      </div>
    );
  }

  return (
    <div className="mc-dark flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-ground)]">
      <TopBar picture={picture} line={line} backHref={petHref} onPhoto={() => setPhoto(true)} />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 z-0">{map}</div>
        {showChip && (
          <p className="absolute left-3 top-3 z-[400] max-w-[calc(100%-24px)] rounded-full border border-[var(--mc-line)] bg-[var(--mc-surface)] px-3.5 py-2 text-[13px] font-bold leading-[18px] text-[var(--mc-ink)] shadow-lg">
            {brief.neverFirst}
          </p>
        )}
        {mapKey && (
          <div className="absolute left-3 z-[400]" style={{ bottom: sheetHeight + 8 }}>
            {mapKey}
          </div>
        )}
        <section
          ref={sheetRef}
          aria-label="Your step"
          data-sheet={sheetHeight}
          className="absolute inset-x-0 bottom-0 z-[450] max-h-[78%] overflow-y-auto rounded-t-3xl bg-[var(--mc-surface)] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_rgba(2,6,23,0.5)]"
        >
          {step}
        </section>
      </div>
      {overlays}
    </div>
  );
}

export default function SearchScreen({ mission = null }) {
  return (
    <Suspense
      fallback={
        <div className="mc-dark flex h-[100dvh] items-center justify-center bg-[var(--mc-ground)]">
          <Loader2 size={36} className="animate-spin text-flash-400" aria-hidden="true" />
        </div>
      }
    >
      <Screen mission={mission} />
    </Suspense>
  );
}
