'use client';

/**
 * SearchScreen - Mission Control: the search view of one pet's page.
 *
 * Three people, and one card for each at any moment:
 *
 *   someone who wants to help   two buttons; then their street and
 *                               "I walked it"
 *   someone who saw the pet     where and when, and "Send"; then "Sent"
 *   the owner                   who is looking and "Text the link";
 *                               on a sighting, "Directions"
 *
 * One yellow button to a card, and it is the next step. The line at the
 * top always says where the search stands, so nothing ever interrupts a
 * card to say it. It opens for anyone holding the pet's link, with no
 * account. (The version before this one had fourteen cards with up to six
 * choices on one; the founder called it a maze, 2026-11-11.)
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
 * What the product says (founder, 2026-11-11): it never tells a helper to
 * stop or not to search, and its advice is the advice engine's, the
 * searcher's brief's and the owner's own answers, word for word.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { distanceMeters } from '@/app/lib/searchGrid';
// The site's own address, built in: a link or a QR code made here never carries the host's name (app/lib/config.js).
import { getBaseUrl } from '@/app/lib/config';
import { orientWalk, walkTitle, placeFromStreets } from '@/app/lib/streetWalks';
import useSearch from './hooks/useSearch';
import TopBar from './components/TopBar';
import PhotoView from './components/PhotoView';
import FieldGps from './components/FieldGps';
import { Stamp } from './components/kit';
import { Main, Join, Street, Home } from './steps/Helper';
import { Seen, Sent } from './steps/Witness';
import { OwnerNow, OwnerSighting } from './steps/Owner';
import Rail from './desktop/Rail';
import MarkReunitedModal from './components/overlays/MarkReunitedModal';
import { readNote, saveNote } from './lib/identity';
import { dayAndTime, situationLine, neighborsLine, ownerSighting, petSub, HOT_SIGHTING_MS } from './lib/words';
import { searcherBrief } from './lib/briefLines';

const SearchMap = dynamic(() => import('./components/SearchMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mc-ground)]" />,
});

/**
 * A reading rougher than this is not a place. A phone with precise
 * location turned off answers with a point that can be kilometres out,
 * and a sighting pinned there sends the owner to the wrong street. Past
 * this, the witness types the street instead.
 */
const SIGHTING_ACCURACY_METERS = 150;
/** A fresh sighting this close to a helper's street is drawn on the same map as the street. Further off, the top line says where. */
const SIGHTING_IN_VIEW_METERS = 1200;
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

/**
 * What to give someone next: the most urgent street nobody has walked,
 * the nearer one on a tie, and after those the street searched longest
 * ago (a pet moves, and an old pass is worth a second).
 */
function rank(items, here) {
  const away = (i) => (here ? distanceMeters(here, i.center) : 0);
  const free = items.filter((i) => !i.mine && (i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT')).sort((a, b) => b.priority - a.priority || away(a) - away(b));
  const again = items.filter((i) => !i.mine && i.status === 'SEARCHED').sort((a, b) => new Date(a.searchedAt) - new Date(b.searchedAt));
  return [...free, ...again];
}

function Screen({ mission }) {
  const params = useSearchParams();
  const missionParam = mission || params.get('mission') || params.get('caseId');
  const { instrument, resolving } = useInstrument();
  const search = useSearch(missionParam);
  const { picture, items, unit, mine: mineRaw, viewer, now, hot: seenLately, position, mySightings } = search;

  const [view, setView] = useState('main'); // main | join | seen | sent
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState(false);
  const [gps, setGps] = useState(null);
  const [where, setWhere] = useState(null); // the sighting being sent: { lat, lng, address, city }
  const [minutes, setMinutes] = useState(0);
  const [locating, setLocating] = useState(false);
  const [mySeen, setMySeen] = useState(null);
  const [walkFrom, setWalkFrom] = useState(null);
  const [endOpen, setEndOpen] = useState(false);
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
  // The sighting that leads this person's screen. For everyone, one seen within the hour. For the owner, also one
  // that only just reached them, whenever it was seen: they were just told about it and came to see where.
  const hot = isOwner ? ownerSighting(picture?.sightings, now) : seenLately;
  const thing = unit === 'block' ? 'block' : 'street';
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

  // The board's streets and the ring just past them, for calling a place by its corner.
  const naming = useRef([]);
  naming.current = unit === 'street' ? [...items, ...search.around] : [];

  // "I've seen it": one form, where and when. A phone is asked where it is
  // and the pin is set there; a desk, or a phone that will not say, types
  // the street.
  const openSeen = useCallback(async () => {
    setProblem('');
    setWhere(null);
    setMinutes(desk ? 30 : 0);
    setView('seen');
    if (desk) return;
    setLocating(true);
    let here = await locate();
    // A phone's first answer can be an old, rough one. It is asked once more for a new reading before the street has to be typed.
    if (here && !(here.accuracy <= SIGHTING_ACCURACY_METERS)) here = (await locate({ fresh: true })) || here;
    setLocating(false);
    if (here && here.accuracy <= SIGHTING_ACCURACY_METERS) {
      const point = { lat: here.lat, lng: here.lng };
      setWhere({ ...point, address: placeFromStreets(naming.current, point) || '', city: '' });
    } else if (here) {
      setProblem('Your phone only gave a rough location. Type the street or the corner.');
    }
  }, [desk, locate]);

  useEffect(() => {
    if (caseId) setWalkFrom(readNote(caseId, 'walk_from'));
  }, [caseId]);

  // A witness coming back to the page finds what they sent, and what the owner did about it.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !picture || !mySightings.length) return;
    resumed.current = true;
    const last = mySightings[0];
    const report = picture.sightings.find((s) => s.id === last.id);
    if (report && now - new Date(report.at).getTime() < HOT_SIGHTING_MS) {
      setMySeen(last);
      setView('sent');
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
    const url = `${getBaseUrl()}/join/${encodeURIComponent(picture.caseNumber)}`;
    import('qrcode')
      .then((QR) => QR.toDataURL(url, { margin: 1, width: 240 }))
      .then((data) => !cancelled && setQr(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [desk, picture, isOwner]);

  // ----- The street this person holds, and what is left to give out -----
  const candidates = useMemo(() => rank(items, position), [items, position]);
  // "10 to 20": the shortest and longest of what could be given, so the first card never contradicts the street that is.
  const minutesWords = useMemo(() => {
    const all = candidates.filter((c) => c.status !== 'SEARCHED').map((c) => c.minutes).filter(Number.isFinite);
    if (!all.length) return '';
    const low = Math.min(...all);
    const high = Math.max(...all);
    return low === high ? `${low}` : `${low} to ${high}`;
  }, [candidates]);
  const mine = useMemo(() => (mineRaw && unit === 'street' ? orientWalk(mineRaw, walkFrom || position) : mineRaw), [mineRaw, unit, walkFrom, position]);
  const counts = useMemo(
    () => ({ total: items.length, searched: items.filter((i) => i.status === 'SEARCHED').length, inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length }),
    [items]
  );

  // ----- A helper's actions -----
  // A street is theirs as soon as they are given it. Taking a new one hands back the old (the server does both).
  async function takeStreet(exceptId = null) {
    if (busy) return undefined;
    setBusy('walk');
    setProblem('');
    setDone(null);
    const here = await locate();
    const list = rank(items, here || position).filter((i) => i.id !== exceptId);
    let taken = null;
    let last = null;
    // Someone else may take the same street in the same second: the next one is tried, a few times at most.
    for (const item of list.slice(0, 4)) {
      const result = await search.act(unit, item.id, 'claim');
      if (!result.error) {
        taken = item;
        break;
      }
      last = result;
      if (result.code === 'WAIVER_NOT_ACCEPTED' || result.code === 'NOT_JOINED') {
        setBusy(null);
        return go('join');
      }
      if (result.code !== 'TAKEN') break;
    }
    setBusy(null);
    if (!taken) {
      setProblem(last?.error || `Every ${thing} has someone on it right now. Thank you for coming.`);
      return undefined;
    }
    const from = here ? { lat: here.lat, lng: here.lng } : null;
    setWalkFrom(from);
    saveNote(caseId, 'walk_from', from);
    // The app records the walk. A browser does not, and does not say it does.
    if (app && gps && viewer?.signedIn) gps.start().catch(() => {});
    return go('main');
  }
  function startWalk() {
    if (!viewer || !viewer.waiver) return go('join');
    return takeStreet();
  }
  async function walked() {
    if (!mineRaw || busy) return undefined;
    setBusy('walked');
    const title = unit === 'street' ? walkTitle(mineRaw) : mineRaw.title;
    const result = await search.act(unit, mineRaw.id, 'searched');
    setBusy(null);
    if (result.error) return setProblem(result.error);
    if (gps?.recording) gps.stop().catch(() => {});
    setDone(title);
    return go('main');
  }
  async function stopWalking() {
    if (!mineRaw || busy) return undefined;
    setBusy('stop');
    const result = await search.act(unit, mineRaw.id, 'release');
    setBusy(null);
    if (result.error) return setProblem(result.error);
    if (gps?.recording) gps.stop().catch(() => {});
    return go('main');
  }

  // ----- A witness's one action -----
  async function sendSeen() {
    if (busy) return undefined;
    if (!where || !Number.isFinite(Number(where.lat ?? where.latitude))) {
      return setProblem(`Mark where you saw ${name}: type the street or the corner.`);
    }
    setBusy('send');
    setProblem('');
    const result = await search.sendSighting({
      lat: Number(where.lat ?? where.latitude),
      lng: Number(where.lng ?? where.longitude),
      address: where.address || '',
      minutesAgo: minutes,
      sure: 'LIKELY',
    });
    setBusy(null);
    if (result.error) return setProblem(result.error);
    setMySeen(result.sighting);
    return go('sent');
  }

  // ----- The owner's actions -----
  // "Directions" is a link the browser opens by itself. This runs beside it, so the witness hears at once
  // that the owner is coming. How far away the owner is follows where the phone already lets this page
  // read its position: opening directions never puts the phone's location question on the screen.
  function going() {
    if (!hot) return;
    const told = search.answer(hot.id, 'going');
    locate({ ifAllowed: true }).then(async (here) => {
      if (!here || !(here.accuracy <= SIGHTING_ACCURACY_METERS)) return;
      const meters = distanceMeters(here, hot);
      if (meters >= 3000) return;
      // The distance follows the news, never the other way round.
      await told;
      search.answer(hot.id, 'going', { etaMinutes: Math.max(1, Math.ceil(meters / 80)) });
    });
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
      setEndOpen(false);
      await search.reload();
    } catch (error) {
      setModalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function share() {
    if (!picture) return;
    const url = `${getBaseUrl()}/join/${encodeURIComponent(picture.caseNumber)}`;
    const place = picture.lastSeen?.place ? ` near ${picture.lastSeen.place}` : '';
    const payload = { title: `Help find ${name}`, text: `${name} is lost${place}. This page shows where to look and how to send a sighting.`, url };
    if (navigator.share) {
      navigator.share(payload).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => say('Link copied. Paste it into a text or a group.')).catch(() => {});
    }
  }

  // ----- Where this person is, to themselves -----
  // The app's recorded path while it records, otherwise the one reading while it is fresh.
  const track = app && gps?.recording && Array.isArray(gps.path) && gps.path.length ? gps.path : NO_TRACK;
  const lastMark = track.length ? track[track.length - 1] : null;
  const fresh = position && now - position.at < POSITION_FRESH_MS ? position : null;
  const me = useMemo(
    () => (lastMark ? { lat: lastMark.lat, lng: lastMark.lng } : fresh ? { lat: fresh.lat, lng: fresh.lng } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastMark?.lat, lastMark?.lng, fresh?.lat, fresh?.lng]
  );

  // ----- The map -----
  const sending = view === 'seen' || view === 'sent';
  const zone = picture?.timeZone;
  const lastSeenTag = useMemo(() => {
    const at = picture?.lastSeen;
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
    return { lat: at.lat, lng: at.lng, label: `Lost here ${dayAndTime(at.at, zone, now)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture?.lastSeen?.lat, picture?.lastSeen?.lng, picture?.lastSeen?.at, zone, Math.floor(now / 60000)]);
  const mapSightings = useMemo(
    () => (picture?.sightings || []).slice(0, 6).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: `Seen ${dayAndTime(s.at, zone, now)}`, hot: hot?.id === s.id })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture?.sightings, zone, hot?.id, Math.floor(now / 60000)]
  );
  const mapStreets = useMemo(() => (unit === 'street' ? items.map((i) => ({ id: i.id, path: i.path, status: i.status, mine: i.mine, who: i.claimedByName || null })) : []), [unit, items]);
  const mapCells = useMemo(() => (unit === 'block' ? items : []), [unit, items]);
  const lit = mine && !sending && !isOwner ? mine : null;
  const mapTags = useMemo(() => {
    if (!lit || unit !== 'street' || !lit.path?.length) return [];
    const first = lit.path[0];
    const last = lit.path[lit.path.length - 1];
    // The words sit beyond the end of the line, so they never cover the street.
    return [{ lat: last[0], lng: last[1], text: `End: ${lit.toName || 'the end'}`, tone: 'flash', side: first[0] >= last[0] ? 'below' : 'above' }];
  }, [lit, unit]);
  const hotNear = Boolean(hot && lit?.center && distanceMeters(lit.center, hot) <= SIGHTING_IN_VIEW_METERS);
  const fit = useMemo(() => {
    const self = me ? [[me.lat, me.lng]] : [];
    if (hot && isOwner) return [[hot.lat, hot.lng], ...around(hot.lat, hot.lng, desk ? 420 : 180), ...self];
    // A helper keeps their street in view, with a fresh sighting beside it when it is near enough to share a map.
    if (lit) return [...pointsOf(lit, unit), ...self, ...(hotNear ? [[hot.lat, hot.lng]] : [])];
    if (hot) return [[hot.lat, hot.lng], ...around(hot.lat, hot.lng, 220), ...(lastSeenTag ? [[lastSeenTag.lat, lastSeenTag.lng]] : [])];
    if (lastSeenTag) return [...around(lastSeenTag.lat, lastSeenTag.lng, 330), ...mapSightings.slice(0, 3).map((s) => [s.lat, s.lng])];
    return [];
  }, [hot, hotNear, isOwner, lit, unit, me, lastSeenTag, mapSightings, desk]);
  const fitKey = `${lit ? `lit:${lit.id}:${hotNear ? hot.id : ''}` : hot ? `seen:${hot.id}` : 'home'}|${lastSeenTag ? 1 : 0}|${desk}|${Math.round(sheetHeight / 40)}`;

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

  // ----- The card: one for each person at any moment -----
  let step;
  let full = false; // a card that takes the whole phone screen, with no map behind it
  if (view === 'seen') {
    full = true;
    step = <Seen name={name} owner={owner} signedIn={Boolean(viewer?.signedIn)} where={where} onWhere={setWhere} near={hot || picture.lastSeen} locating={locating} canLocate={!desk} minutes={minutes} onMinutes={setMinutes} onSend={sendSeen} busy={busy === 'send'} problem={problem} />;
  } else if (view === 'sent' && mySeen) {
    full = true;
    step = <Sent picture={picture} name={name} owner={owner} mine={mySeen} signedIn={Boolean(viewer?.signedIn)} onAgain={openSeen} onDone={() => go('main')} />;
  } else if (isOwner && hot) {
    step = <OwnerSighting picture={picture} name={name} hot={hot} now={now} onGoing={going} onHome={() => setEndOpen(true)} problem={problem} />;
  } else if (isOwner) {
    step = <OwnerNow picture={picture} name={name} now={now} unit={unit} counts={counts} onShare={share} onHome={() => setEndOpen(true)} problem={problem} />;
  } else if (mine) {
    step = <Street picture={picture} name={name} unit={unit} mine={mine} instrument={instrument} gps={gps} onWalked={walked} onOther={() => takeStreet(mineRaw.id)} onStop={stopWalking} onSeen={openSeen} busy={busy} problem={problem} canOther={candidates.length > 0} />;
  } else if (view === 'join') {
    step = <Join picture={picture} name={name} owner={owner} viewer={viewer} unit={unit} instrument={instrument} search={search} onJoined={() => takeStreet()} onBack={() => go('main')} />;
  } else {
    step = <Main picture={picture} name={name} owner={owner} unit={unit} items={items} counts={counts} minutes={minutesWords} done={done} instrument={instrument} onWalk={startWalk} onSeen={openSeen} onShare={share} busy={busy === 'walk'} problem={problem} qr={qr} />;
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
      {endOpen && (
        <div className="relative z-[850]">
          <MarkReunitedModal mission={{ petName: name }} onClose={() => setEndOpen(false)} onConfirm={confirmHome} isSaving={saving} error={modalError} />
        </div>
      )}
    </>
  );

  const brief = searcherBrief(picture);
  const showChip = !isOwner && view === 'main' && !mine;
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
      me={me}
      track={track}
      tags={mapTags}
      fit={fit}
      fitKey={fitKey}
      padding={desk ? { top: 60, right: 80, bottom: 60, left: 80 } : { top: showChip ? 60 : sheetHeight > 460 ? 28 : 44, right: hotNear ? 128 : 64, bottom: sheetHeight + (sheetHeight > 460 ? 30 : 44), left: 64 }}
      zoomControl={desk}
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
            {/* The sighting cards carry their own padding (they fill a phone's screen), so the frame adds none. */}
            <div className={`rounded-2xl border border-[var(--mc-line)] bg-[var(--mc-surface)] ${full ? 'overflow-hidden pb-2' : 'p-5'}`}>
              {full && (
                <button type="button" onClick={() => go('main')} className="ml-4 mt-3 inline-flex min-h-[36px] items-center gap-1.5 text-[15px] font-semibold text-[var(--mc-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
                  <ArrowLeft size={18} aria-hidden="true" /> Back to the map
                </button>
              )}
              {step}
            </div>
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
    return (
      <div className="mc-dark flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-surface)]">
        <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-[var(--mc-line)] px-2 pt-[env(safe-area-inset-top)]">
          <button type="button" onClick={() => go('main')} aria-label="Back to the map" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
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
