'use client';

/**
 * SearchScreen - Mission Control: the search view of one pet's page.
 *
 * Three people, and one card for each at any moment:
 *
 *   someone who wants to help   two buttons; then their area of ground
 *                               and "I searched it"
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
 *   desk (desktop)        see the whole search and run it: every area
 *                         on the map, the people on it, what the numbers
 *                         show, everything said and done, and for the
 *                         owner, giving a person an area, writing to
 *                         them and where helpers go first. Nobody searches
 *                         from a desk, so there is no area to take
 *                         here and no GPS.
 *   phone (mobile web)    see, join, take an area, mark it by tapping,
 *                         report a sighting with one location reading.
 *                         No GPS walk: a browser cannot record with the
 *                         screen off.
 *   app (native shell)    everything the phone does, plus the GPS walk.
 *
 * What the product says (founder, 2026-11-11): it never tells a helper to
 * stop or not to search, and its advice is the advice engine's, the
 * searcher's brief's and the owner's own answers, word for word.
 */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { distanceMeters } from '@/app/lib/searchGrid';
import { rankAreas, needsSearch } from '@/app/lib/searchCircle';
// The site's own address, built in: a link or a QR code made here never carries the host's name (app/lib/config.js).
import { getBaseUrl } from '@/app/lib/config';
import { orientWalk, walkTitle, placeFromStreets } from '@/app/lib/streetWalks';
import useSearch from './hooks/useSearch';
import usePutAway from './hooks/usePutAway';
import TopBar from './components/TopBar';
import PhotoView from './components/PhotoView';
import FieldGps from './components/FieldGps';
import { Stamp } from './components/kit';
import { Main, Join, Area, Street, Home } from './steps/Helper';
import { Seen, Sent } from './steps/Witness';
import { OwnerNow, OwnerSighting } from './steps/Owner';
import Command from './desktop/Command';
import MarkReunitedModal from './components/overlays/MarkReunitedModal';
import { readNote, saveNote } from './lib/identity';
import { dayAndTime, situationLine, neighborsLine, ownerSighting, petSub, HOT_SIGHTING_MS } from './lib/words';
import { searcherBrief } from './lib/briefLines';
import { wordsForCard, wordsForOwner, dealtLine } from './lib/team';
import { AreaName, circleAreas, isSeenCircle, minutesRange } from './lib/ground';

/** The space between the sheet and the map's key above it, and between the sheet and the map's credit when there is no key. */
const KEY_GAP = 8;

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
/**
 * How tall a phone's card may be, closed and open. Closed, the map keeps about two fifths of what is above the
 * browser's own bar: the card had up to 78% and a helper's area was a strip of map with the area cut off at its
 * top (founder, 2026-11-14: "Bad interface"). What does not fit scrolls under the buttons, or the handle opens
 * the card. Open, a strip of map stays under the top bar, so the way back to it shows.
 */
const SHEET_CLOSED = 'calc(62% + 0.38 * env(safe-area-inset-bottom))';
const SHEET_OPEN = 'calc(100% - 72px)';
/** One reading says where the phone was, not where it is: the "You" dot is dropped after this long. */
const POSITION_FRESH_MS = 2 * 60 * 1000;
/**
 * Where the phone is joins the first view of someone's area, or of a sighting, only this close to it. Further
 * off, the map shows the ground and not the way there: a phone in the US given an area in Coyoacán opened on a
 * map of the whole continent, with the area a dot (2026-11-14).
 */
const SELF_IN_VIEW_METERS = 2000;
const NO_TRACK = [];
const NO_WORDS = [];

function Centered({ children }) {
  return (
    <div className="mc-dark mc-screen flex h-[100dvh] items-center justify-center bg-[var(--mc-ground)] px-5">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

const WAY_OUT =
  'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-4 text-base font-bold text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

/** The edge of an area, a corner of a square, or an end of a street, as map points. */
function pointsOf(item, unit) {
  if (!item) return [];
  if (unit === 'area') return item.outline || [];
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
function rank(items, here, unit = 'street') {
  const away = (i) => (here ? distanceMeters(here, i.center) : 0);
  // Ground is given out in its own order (app/lib/searchCircle.js): several people can be on one area.
  if (unit === 'area') return rankAreas(items, away);
  // A street kept for someone the person running the search asked is not offered to anyone else, and the one
  // this person was asked to walk comes before every other (app/lib/searchAsk.js).
  const free = items
    .filter((i) => !i.mine && !i.reserved && (i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT'))
    .sort((a, b) => Number(Boolean(b.askedOfMe)) - Number(Boolean(a.askedOfMe)) || b.priority - a.priority || away(a) - away(b));
  const again = items.filter((i) => !i.mine && i.status === 'SEARCHED').sort((a, b) => new Date(a.searchedAt) - new Date(b.searchedAt));
  return [...free, ...again];
}

function Screen({ mission }) {
  const params = useSearchParams();
  const missionParam = mission || params.get('mission') || params.get('caseId');
  const { instrument, resolving } = useInstrument();
  // A desk steering the search is kept current to the few seconds (hooks/useSearch.js).
  const search = useSearch(missionParam, { desk: instrument === INSTRUMENTS.COMMAND });
  const { picture, items, unit, mine: mineRaw, viewer, now, hot: seenLately, position, mySightings } = search;

  const [view, setView] = useState('main'); // main | join | seen | sent
  const [done, setDone] = useState(null);
  // Whether what they just searched was the circle round a sighting, which is not one of the areas the card counts.
  const [doneAtSighting, setDoneAtSighting] = useState(false);
  // The area just searched, so the card that says thank you can take its debrief.
  const [doneId, setDoneId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState(false);
  const [gps, setGps] = useState(null);
  const [where, setWhere] = useState(null); // the sighting being sent: { lat, lng, address, city }
  const [whereFrom, setWhereFrom] = useState(null); // 'phone': where the phone is. 'hand': typed, or the pin was put there.
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
  // On a phone the card leaves the map room (SHEET_CLOSED), and its handle opens it to read all of it.
  const [sheetOpen, setSheetOpen] = useState(false);
  // The card's height when it was last closed: the map is fitted above that, so opening the card to read it
  // does not move the map.
  const closedSheet = useRef(280);
  // Where a finger came down on the card's handle, to tell a swipe from a tap.
  const handleFrom = useRef(null);
  // The part of the card that scrolls.
  const sheetScroll = useRef(null);
  const [keyHeight, setKeyHeight] = useState(0);
  const keyWatch = useRef(null);

  const desk = instrument === INSTRUMENTS.COMMAND;
  const app = instrument === INSTRUMENTS.FIELD;
  const caseId = picture?.id || null;
  const name = picture?.pet?.name || 'this pet';
  const owner = picture?.owner || null;
  const isOwner = Boolean(viewer?.isOwner);
  // The sighting that leads this person's screen. For everyone, one seen within the hour. For the owner, also one
  // that only just reached them, whenever it was seen: they were just told about it and came to see where.
  const hot = isOwner ? ownerSighting(picture?.sightings, now) : seenLately;
  const ground = unit === 'area';
  const thing = ground ? 'area' : unit === 'block' ? 'block' : 'street';
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

  // The named streets near the search, for calling a place by its corner.
  const naming = useRef([]);
  naming.current = unit === 'street' ? [...items, ...search.around] : ground ? search.around : [];

  // "I've seen it": one form, where and when. A phone is asked where it is
  // and the pin is set there; a desk, or a phone that will not say, types
  // the street.
  const phoneSpot = useRef(null);
  // The time picked, as it is now: the reading below can arrive after someone has already tapped "Today".
  const pickedMinutes = useRef(0);
  const openSeen = useCallback(async () => {
    setProblem('');
    setWhere(null);
    setWhereFrom(null);
    phoneSpot.current = null;
    pickedMinutes.current = desk ? 30 : 0;
    setMinutes(pickedMinutes.current);
    setView('seen');
    if (desk) return;
    setLocating(true);
    let here = await locate();
    // A phone's first answer can be an old, rough one. It is asked once more for a new reading before the street has to be typed.
    if (here && !(here.accuracy <= SIGHTING_ACCURACY_METERS)) here = (await locate({ fresh: true })) || here;
    setLocating(false);
    if (here && here.accuracy <= SIGHTING_ACCURACY_METERS) {
      const point = { lat: here.lat, lng: here.lng };
      const spot = { ...point, address: placeFromStreets(naming.current, point) || '', city: '' };
      phoneSpot.current = spot;
      // Only for "Just now". If an earlier time was picked while the phone was still finding itself, the pin is kept back.
      if (pickedMinutes.current === 0) {
        setWhere(spot);
        setWhereFrom('phone');
      }
    } else if (here && pickedMinutes.current === 0) {
      setProblem('Your phone only gave a rough location. Type the street or the corner.');
    }
  }, [desk, locate]);
  // Where the phone is now is where the pet is only for "Just now". Someone at home in the evening, sending
  // what they saw at noon, must not pin the pet (and themselves) to their own house: for any earlier time the
  // phone's pin comes off and the place is typed, or put there by hand. Back on "Just now" it returns.
  function chooseWhen(next) {
    pickedMinutes.current = next;
    setMinutes(next);
    if (next > 0 && whereFrom === 'phone') {
      setWhere(null);
      setWhereFrom(null);
    } else if (next === 0 && !where && phoneSpot.current) {
      setWhere(phoneSpot.current);
      setWhereFrom('phone');
    }
  }
  // Typing a street, moving the pin or pressing "Use my location" is the person saying where. That stands whatever the time.
  function placeByHand(value) {
    setWhere(value);
    setWhereFrom(value ? 'hand' : null);
  }
  // A click on the desk's map while the form is open is where the pet was seen. It is named by the streets it is
  // on, where the search knows them; the place itself is what is sent.
  function placeOnMap(point) {
    setProblem('');
    placeByHand({ lat: point.lat, lng: point.lng, address: placeFromStreets(naming.current, point) || '', city: '' });
  }

  useEffect(() => {
    if (caseId) setWalkFrom(readNote(caseId, 'walk_from'));
  }, [caseId]);

  // Each new card starts closed over the map, except joining: the rules and "Before you go out" are read in
  // full, and the map has nothing to show for them. And it is read from its top: the sheet is one element for
  // every card, and kept the place the last card was scrolled to, so an area's card opened at its advice with
  // its name and its caution scrolled out of sight. Before the card's own effects run, so a word that moves the
  // sheet to show itself (components/Word.js) still can.
  // A sighting changes the owner's card; a helper's stays as it is, and is not moved while they read it.
  const ownerCard = isOwner && hot ? hot.id : null;
  useLayoutEffect(() => {
    setSheetOpen(view === 'join');
    if (sheetScroll.current) sheetScroll.current.scrollTop = 0;
  }, [view, mineRaw?.id, ownerCard]);

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

  // ?action=sighting: "I've seen" on the pet's page opens the form here. ?action=walk: "Give me a job, on foot"
  // there opens the join card, so nobody is asked the same thing twice. Each is used once and taken off the
  // address: a reload or a restored tab opens the map and asks the phone nothing.
  const linked = useRef(false);
  useEffect(() => {
    // Not until the first load is whole: who this person is (a helper who joined before) arrives with it.
    if (linked.current || !picture || resolving || search.loading) return;
    linked.current = true;
    const action = params.get('action');
    if (!action) return;
    const rest = new URLSearchParams(window.location.search);
    rest.delete('action');
    // With no state of its own, so that the router takes the new address in too (it skips entries that carry its own mark).
    window.history.replaceState(null, '', `${window.location.pathname}?${rest}`);
    if (!picture.open) return;
    if (action === 'sighting') openSeen();
    else if (action === 'walk' && !desk && !viewer?.isOwner && !viewer?.waiver) go('join');
  }, [picture, params, resolving, search.loading, openSeen, desk, viewer, go]);

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

  // ----- The area this person is on, and what is left to give out -----
  const candidates = useMemo(() => rank(items, position, unit), [items, position, unit]);
  // "30 to 45": the shortest and longest of what could be given, so the first card never contradicts the area that is.
  const minutesWords = useMemo(() => {
    if (unit === 'area') return minutesRange(candidates);
    const all = candidates.filter((c) => c.status !== 'SEARCHED').map((c) => c.minutes).filter(Number.isFinite);
    if (!all.length) return '';
    const low = Math.min(...all);
    const high = Math.max(...all);
    return low === high ? `${low}` : `${low} to ${high}`;
  }, [candidates, unit]);
  const mine = useMemo(() => (mineRaw && unit === 'street' ? orientWalk(mineRaw, walkFrom || position) : mineRaw), [mineRaw, unit, walkFrom, position]);
  // The area the person running the search asked this person to search, until they start it.
  const askedRaw = useMemo(() => (unit === 'street' || unit === 'area' ? items.find((i) => i.askedOfMe && !i.mine) || null : null), [items, unit]);
  const asked = useMemo(() => (askedRaw && unit === 'street' ? orientWalk(askedRaw, position) : askedRaw), [askedRaw, position, unit]);
  // What this person has put away on this phone or computer: a helper's word on the owner's card, the owner's on a helper's.
  const [put, putAway] = usePutAway(caseId || 'none');
  // What was said to this person: the newest word written to them, and what the owner last told everyone, while each is fresh.
  const said = useMemo(
    () => (isOwner || !picture ? NO_WORDS : wordsForCard({ words: search.words, updates: picture.updates || [], ownerName: owner?.firstName || null, now, put })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOwner, picture?.updates, search.words, owner?.firstName, put, Math.floor(now / 60000)]
  );
  // Once all of it has been dealt with, the one line the card shows in its place.
  const saidLine = useMemo(
    () => dealtLine({ said, words: search.words, timeZone: picture?.timeZone, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [said, search.words, picture?.timeZone, Math.floor(now / 60000)]
  );
  // On a phone the owner reads what a helper said, and answers it, on their own card. (On a desk it is in "Needs
  // you" and in Messages.) One at a time: answering it brings up the next.
  const heard = useMemo(
    () => (isOwner && !desk ? wordsForOwner({ talk: search.talk, put, now }) : NO_WORDS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOwner, desk, search.talk, put, Math.floor(now / 60000)]
  );
  const answerHelper = async (to, text) => {
    const result = await search.say(text, to.handle);
    // Answered, so the word leaves the card: said here, where it can still be read.
    if (!result.error) say(`Sent to ${to.from}.`);
    return result;
  };
  // "Got it": read, and nothing to write back. The same list the desk's "Needs you" keeps.
  const gotIt = (word) => putAway(`word-${word.id}`);
  // A helper's "Got it" puts away every word that was waiting on their card.
  const gotWords = (list) => list.forEach((word) => putAway(`word-${word.id}`));
  // The card says when it has shown a word written to this person, or the street they were asked to walk.
  const sawWord = (id) => search.saw({ words: [id] });
  const sawAsk = () => search.saw({ ask: true });
  // Answering takes someone on the search, as the server also checks. Someone leading answers what was written to them.
  const canSay = Boolean(viewer && !isOwner && (viewer.leads ? search.words.some((w) => !w.mine) : viewer.seesNames || search.volunteer || mineRaw || askedRaw || search.words.length > 0));
  const counts = useMemo(() => {
    // Ground counts what has been searched at least once, over the circle's own areas: a sighting's circle is not one of them.
    if (unit === 'area') {
      const own = circleAreas(items);
      return { total: own.length, searched: own.filter((i) => i.searchCount > 0).length, inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length };
    }
    return { total: items.length, searched: items.filter((i) => i.status === 'SEARCHED').length, inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length };
  }, [items, unit]);

  // ----- A helper's actions -----
  // The streets this person passed on in this round of "Different street", so it moves down the list and does not hand one straight back.
  const passed = useRef(new Set());
  // A street is theirs as soon as they are given it. Taking a new one hands back the old (the server does both).
  // Answers { ok } or { error }, and never leaves the button spinning: a dropped signal is words on the card.
  async function takeStreet(exceptId = null) {
    // A desk is never handed a street: a tablet turned on its side while on the join card is a desk from then on.
    if (busy || desk) return { error: '' };
    setBusy('walk');
    setProblem('');
    setDone(null);
    setDoneId(null);
    try {
      const here = await locate();
      // Passing on a street lasts for one round of "Different street". A fresh ask starts clean, so the
      // street someone passed on an hour ago is offered again before any street is walked twice.
      if (exceptId) passed.current.add(exceptId);
      else passed.current = new Set();
      const ranked = rank(items, here || position, unit).filter((i) => i.id !== exceptId);
      // Ground that still needs a search: never searched, or put up for another look.
      const unwalked = (i) => (unit === 'area' ? needsSearch(i) : i.status !== 'SEARCHED');
      let list = ranked.filter((i) => !passed.current.has(i.id));
      if (!list.length || (!list.some(unwalked) && ranked.some(unwalked))) {
        // Everything that needs a search has been passed on, or everything has: the round starts again, rather
        // than a second pass of a searched area, and never an empty hand.
        passed.current = new Set(exceptId ? [exceptId] : []);
        list = ranked;
      }
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
          go('join');
          return { error: '' };
        }
        if (result.code !== 'TAKEN') break;
      }
      if (!taken) {
        const words = last?.error || (unit === 'area' ? 'That did not go through. Try again in a moment.' : `Every ${thing} has someone on it right now. One comes free when it has been walked.`);
        // Said on the first card, which has the button to try again.
        setView('main');
        setProblem(words);
        return { error: words };
      }
      const from = here ? { lat: here.lat, lng: here.lng } : null;
      setWalkFrom(from);
      saveNote(caseId, 'walk_from', from);
      // The app records the walk. A browser does not, and does not say it does.
      if (app && gps && viewer?.signedIn) gps.start().catch(() => {});
      go('main');
      return { ok: true };
    } finally {
      setBusy(null);
    }
  }
  function startWalk() {
    if (!viewer || !viewer.waiver) return go('join');
    return takeStreet();
  }
  async function walked() {
    if (!mineRaw || busy) return undefined;
    setBusy('walked');
    try {
      const title = unit === 'area' ? AreaName(mineRaw) : unit === 'street' ? walkTitle(mineRaw) : mineRaw.title;
      const result = await search.act(unit, mineRaw.id, 'searched');
      if (result.error) return setProblem(result.error);
      if (gps?.recording) gps.stop().catch(() => {});
      setDone(title);
      setDoneId(unit === 'area' ? mineRaw.id : null);
      setDoneAtSighting(unit === 'area' && isSeenCircle(mineRaw));
      return go('main');
    } finally {
      setBusy(null);
    }
  }
  async function stopWalking() {
    if (!mineRaw || busy) return undefined;
    setBusy('stop');
    try {
      const result = await search.act(unit, mineRaw.id, 'release');
      if (result.error) return setProblem(result.error);
      if (gps?.recording) gps.stop().catch(() => {});
      return go('main');
    } finally {
      setBusy(null);
    }
  }
  // Asked to walk a street, and cannot: it goes back to the search, and the people running it are told.
  async function cannot() {
    if (busy) return undefined;
    setBusy('cannot');
    setProblem('');
    try {
      const result = await search.cannot();
      if (result.error) return setProblem(result.error);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  // ----- A witness's one action -----
  async function sendSeen() {
    if (busy) return undefined;
    if (!where || !Number.isFinite(Number(where.lat ?? where.latitude))) {
      return setProblem(`Mark where you saw ${name}: type the street or the corner.`);
    }
    setBusy('send');
    setProblem('');
    try {
      const result = await search.sendSighting({
        lat: Number(where.lat ?? where.latitude),
        lng: Number(where.lng ?? where.longitude),
        address: where.address || '',
        minutesAgo: minutes,
        sure: 'LIKELY',
      });
      if (result.error) return setProblem(result.error);
      setMySeen(result.sighting);
      return go('sent');
    } finally {
      setBusy(null);
    }
  }

  // ----- The owner's actions -----
  // "Directions" is a link the browser opens by itself. This runs beside it, so the witness hears at once
  // that the owner is coming. How far away the owner is follows where the phone already lets this page
  // read its position: opening directions never puts the phone's location question on the screen.
  function going() {
    if (!hot) return;
    // Told once. Opening directions again only brings the distance up to date.
    const told = hot.ownerGoingAt ? Promise.resolve() : search.answer(hot.id, 'going');
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
  // What is lit on this person's map: the area they are on, or else the one they were asked to search.
  const litId = mineRaw?.id || askedRaw?.id || null;
  // The ground of the search. On a phone an area carries no name: the one that is lit is the one the card names.
  // Who is on one is written on it for the people who may know.
  const mapAreas = useMemo(
    () =>
      unit === 'area'
        ? items.map((i) => ({ id: i.id, outline: i.outline, ring: i.ring, status: i.status, searchCount: i.searchCount, on: i.on, mine: i.id === litId, center: i.center, label: '', who: (i.who || []).map((w) => w.name).join(', ') || null }))
        : [],
    [unit, items, litId]
  );
  const mapStreets = useMemo(() => (unit === 'street' ? items.map((i) => ({ id: i.id, path: i.path, status: i.status, mine: i.id === litId, who: i.claimedByName || null })) : []), [unit, items, litId]);
  const mapCells = useMemo(() => (unit === 'block' ? items : []), [unit, items]);
  const lit = !sending && !isOwner ? mine || asked : null;
  // With a street lit, where the pet was lost keeps its mark and loses its words, which would sit on the street.
  // One object while nothing changes: the map is drawn again when this is a new one.
  const mapLastSeen = useMemo(() => (lit && lastSeenTag ? { ...lastSeenTag, label: '' } : lastSeenTag), [Boolean(lit), lastSeenTag]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapTags = useMemo(() => {
    if (!lit || unit !== 'street' || !lit.path?.length) return [];
    const first = lit.path[0];
    const last = lit.path[lit.path.length - 1];
    // The words sit beyond the end of the line, so they never cover the street.
    return [{ lat: last[0], lng: last[1], text: `End: ${lit.toName || 'the end'}`, tone: 'flash', side: first[0] >= last[0] ? 'below' : 'above' }];
  }, [lit, unit]);
  const hotNear = Boolean(hot && lit?.center && distanceMeters(lit.center, hot) <= SIGHTING_IN_VIEW_METERS);
  const fit = useMemo(() => {
    // The phone's own place is in view only when it is near what the map is for.
    const selfNear = (place) => (me && place && distanceMeters(me, place) <= SELF_IN_VIEW_METERS ? [[me.lat, me.lng]] : []);
    if (hot && isOwner) return [[hot.lat, hot.lng], ...around(hot.lat, hot.lng, 180), ...selfNear(hot)];
    // A helper keeps their street in view, with a fresh sighting beside it when it is near enough to share a map.
    if (lit) {
      const edge = pointsOf(lit, unit);
      const middle = lit.center || (edge.length ? { lat: edge[0][0], lng: edge[0][1] } : null);
      return [...edge, ...selfNear(middle), ...(hotNear ? [[hot.lat, hot.lng]] : [])];
    }
    // With nothing lit, the whole circle of the search, and where the pet was seen with it.
    if (unit === 'area' && search.circle?.center) return [...around(search.circle.center.lat, search.circle.center.lng, search.circle.radius), ...(hot ? [[hot.lat, hot.lng]] : []), ...mapSightings.slice(0, 3).map((s) => [s.lat, s.lng])];
    if (hot) return [[hot.lat, hot.lng], ...around(hot.lat, hot.lng, 220), ...(lastSeenTag ? [[lastSeenTag.lat, lastSeenTag.lng]] : [])];
    if (lastSeenTag) return [...around(lastSeenTag.lat, lastSeenTag.lng, 330), ...mapSightings.slice(0, 3).map((s) => [s.lat, s.lng])];
    return [];
  }, [hot, hotNear, isOwner, lit, unit, me, lastSeenTag, mapSightings, search.circle]);
  // The map is fitted above the card as it is when closed, so opening the card to read it leaves the map still.
  if (!sheetOpen) closedSheet.current = sheetHeight;
  const fitSheet = sheetOpen ? closedSheet.current : sheetHeight;
  const fitKey = `${lit ? `lit:${lit.id}:${hotNear ? hot.id : ''}` : hot ? `seen:${hot.id}` : `home:${search.circle?.radius || 0}`}|${lastSeenTag ? 1 : 0}|${Math.round(fitSheet / 40)}`;

  // The sheet's height, so the map keeps what matters above it.
  const sheetRef = useCallback((el) => {
    if (sheetWatch.current) sheetWatch.current.disconnect();
    sheetWatch.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    sheetWatch.current = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    sheetWatch.current.observe(el);
    setSheetHeight(el.offsetHeight);
  }, []);
  // The height of the map's key, so the map's credit sits above it and the two never share a line.
  const keyRef = useCallback((el) => {
    if (keyWatch.current) keyWatch.current.disconnect();
    keyWatch.current = null;
    if (!el) {
      setKeyHeight(0);
      return;
    }
    setKeyHeight(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    keyWatch.current = new ResizeObserver(() => setKeyHeight(el.offsetHeight));
    keyWatch.current.observe(el);
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
      <div className="mc-dark mc-screen flex h-[100dvh] flex-col overflow-y-auto bg-[var(--mc-surface)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <Home picture={picture} name={name} owner={owner} petHref={petHref} />
        </div>
      </div>
    );
  }

  // The owner reads who was alerted only while nobody has seen the pet: that line ends "you are told the moment
  // someone sees Max", which is not a thing to say above a sighting.
  const line = isOwner && !hot && !picture.sightings.length && picture.neighbors?.told ? { text: neighborsLine(picture.neighbors, name, picture.looking?.helpers || 0), tone: 'lost' } : situationLine(picture, now);

  // ----- The card: one for each person at any moment -----
  let step;
  let full = false; // a card that takes the whole phone screen, with no map behind it
  if (view === 'seen') {
    full = true;
    step = <Seen name={name} owner={owner} signedIn={Boolean(viewer?.signedIn)} where={where} onWhere={placeByHand} near={hot || picture.lastSeen} locating={locating} canLocate={!desk} mapPick={desk} minutes={minutes} onMinutes={chooseWhen} onSend={sendSeen} busy={busy === 'send'} problem={problem} />;
  } else if (view === 'sent' && mySeen) {
    full = true;
    step = <Sent picture={picture} name={name} owner={owner} mine={mySeen} signedIn={Boolean(viewer?.signedIn)} onAgain={openSeen} onDone={() => go('main')} />;
  } else if (isOwner && hot) {
    step = <OwnerSighting picture={picture} name={name} hot={hot} now={now} onGoing={going} onHome={() => setEndOpen(true)} problem={problem} heard={heard} onReply={answerHelper} onPutAway={gotIt} />;
  } else if (isOwner) {
    step = <OwnerNow picture={picture} name={name} now={now} unit={unit} counts={counts} onShare={share} onHome={() => setEndOpen(true)} problem={problem} heard={heard} onReply={answerHelper} onPutAway={gotIt} />;
  } else if (mine && ground) {
    step = <Area picture={picture} name={name} mine={mine} instrument={instrument} gps={gps} onSearched={walked} onOther={() => takeStreet(mineRaw.id)} onStop={stopWalking} onSeen={openSeen} busy={busy} problem={problem} canOther={!desk && candidates.length > 0} asked={asked} onAskShown={sawAsk} said={said} saidLine={saidLine} onPutAway={gotWords} onSay={canSay ? search.say : null} onShown={sawWord} now={now} />;
  } else if (mine) {
    step = <Street picture={picture} name={name} unit={unit} mine={mine} instrument={instrument} gps={gps} onWalked={walked} onOther={() => takeStreet(mineRaw.id)} onStop={stopWalking} onSeen={openSeen} busy={busy} problem={problem} canOther={!desk && candidates.length > 0} asked={asked} onAskShown={sawAsk} said={said} saidLine={saidLine} onPutAway={gotWords} onSay={canSay ? search.say : null} onShown={sawWord} now={now} />;
  } else if (view === 'join' && !desk) {
    step = <Join picture={picture} name={name} owner={owner} viewer={viewer} unit={unit} instrument={instrument} search={search} onJoined={() => takeStreet()} onBack={() => go('main')} />;
  } else {
    step = <Main picture={picture} name={name} owner={owner} unit={unit} items={items} counts={counts} minutes={minutesWords} done={done} doneAtSighting={doneAtSighting} onDebrief={doneId ? (covered, note) => search.debrief(doneId, covered, note) : null} trail={search.trail} ways={search.ways} instrument={instrument} onWalk={startWalk} onSeen={openSeen} onShare={share} busy={busy === 'walk'} problem={problem} qr={qr} asked={asked} onCannot={cannot} onAskShown={sawAsk} said={said} saidLine={saidLine} onPutAway={gotWords} onSay={canSay ? search.say : null} onShown={sawWord} now={now} />;
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
          {/* Inside this screen's own palette, day or night, so it brings none of its own. */}
          <MarkReunitedModal mission={{ petName: name }} onClose={() => setEndOpen(false)} onConfirm={confirmHome} isSaving={saving} error={modalError} palette="" />
        </div>
      )}
    </>
  );

  // ----- A desk -----
  // The whole search on one screen, and the controls to steer it (desktop/Command.js). It takes this person's
  // card as it is, so a desk and a phone never say different things about the same step. A desk has no position
  // of its own and records no walk, so it is handed neither.
  if (desk) {
    return (
      <Command
        picture={picture}
        items={items}
        unit={unit}
        circle={search.circle}
        now={now}
        line={line}
        petHref={petHref}
        onPhoto={() => setPhoto(true)}
        step={step}
        full={full}
        onBack={() => go('main')}
        onSeen={openSeen}
        onShare={share}
        picking={view === 'seen'}
        pin={view === 'seen' && where && Number.isFinite(Number(where.lat ?? where.latitude)) ? { lat: Number(where.lat ?? where.latitude), lng: Number(where.lng ?? where.longitude) } : null}
        onPick={placeOnMap}
        search={search}
        mapLabel={`Map of the search for ${name}`}
        overlays={overlays}
      />
    );
  }

  // ----- A phone, in a browser or in the app -----
  const brief = searcherBrief(picture);
  const showChip = !isOwner && view === 'main' && !mine;
  const keyBits = [
    counts.searched > 0 ? [ground ? 'fill' : 'bar', 'Already searched'] : null,
    // Their own area is one of those in progress only while the site counts them as on it.
    counts.inProgress > (mine?.status === 'IN_PROGRESS' ? 1 : 0) ? ['dots', ground ? 'Someone is searching it now' : 'Someone is on it now'] : null,
    track.length > 1 ? ['path', 'Your path'] : null,
  ].filter(Boolean);
  const map = (
    <SearchMap
      theme="dark"
      lastSeen={mapLastSeen}
      sightings={mapSightings}
      areas={mapAreas}
      streets={mapStreets}
      cells={mapCells}
      me={me}
      track={track}
      tags={mapTags}
      fit={fit}
      fitKey={fitKey}
      padding={{ top: showChip ? 60 : fitSheet > 460 ? 28 : 44, right: hotNear ? 128 : 64, bottom: fitSheet + (fitSheet > 460 ? 30 : 44), left: 64 }}
      creditBottom={sheetHeight + KEY_GAP + (keyHeight ? keyHeight + 6 : 0)}
      label={`Map of the search for ${name}`}
    />
  );
  const mapKey = keyBits.length > 0 && (
    <div className="pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-[var(--mc-soft)]">
      {keyBits.map(([kind, words]) => (
        <span key={words} className="flex items-center gap-1.5 rounded-md bg-[var(--mc-surface)]/85 px-1.5 py-0.5">
          {kind === 'fill' ? (
            <span className="h-3 w-5 rounded-[3px]" style={{ border: '1px solid var(--mc-done)', background: 'color-mix(in srgb, var(--mc-done) 45%, transparent)' }} aria-hidden="true" />
          ) : kind === 'bar' ? (
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

  // A phone screen is pinned to the window and never scrolls as a page: only the card scrolls, and reaching its end
  // does not drag the page. The page moving under it is what put the top bar under the phone's clock and showed the
  // site's pale background beneath the buttons (2026-11-14, iOS Safari). The insets keep the bar and the buttons
  // clear of the clock, the notch and the browser's own bars (viewportFit in page.js).
  const pinned = 'mc-dark mc-screen fixed inset-0 flex flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]';
  if (full) {
    return (
      <div className={`${pinned} bg-[var(--mc-surface)]`}>
        <header className="shrink-0 border-b border-[var(--mc-line)] px-2 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[60px] items-center gap-2">
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
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{step}</div>
        {overlays}
      </div>
    );
  }

  return (
    <div className={`${pinned} bg-[var(--mc-ground)]`}>
      <TopBar picture={picture} line={line} backHref={petHref} onPhoto={() => setPhoto(true)} />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 z-0">{map}</div>
        {showChip && (
          <p className="absolute left-3 top-3 z-[400] max-w-[calc(100%-24px)] rounded-full border border-[var(--mc-line)] bg-[var(--mc-surface)] px-3.5 py-2 text-[13px] font-bold leading-[18px] text-[var(--mc-ink)] shadow-lg">
            {brief.neverFirst}
          </p>
        )}
        {mapKey && !sheetOpen && (
          <div ref={keyRef} className="pointer-events-none absolute left-3 right-3 z-[400]" style={{ bottom: sheetHeight + KEY_GAP }}>
            {mapKey}
          </div>
        )}
        <section
          ref={sheetRef}
          aria-label="Your step"
          className="absolute inset-x-0 bottom-0 z-[450] flex flex-col rounded-t-3xl bg-[var(--mc-surface)] shadow-[0_-8px_30px_rgba(2,6,23,0.5)]"
          style={{ maxHeight: sheetOpen ? SHEET_OPEN : SHEET_CLOSED }}
        >
          {/* The handle: a tap, or a swipe up or down, opens or closes the card. */}
          <button
            type="button"
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Show the map' : 'Show all of the card'}
            onPointerDown={(e) => {
              handleFrom.current = e.clientY;
              // So the swipe ends here wherever the finger or the mouse is let go.
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerUp={(e) => {
              const moved = handleFrom.current === null ? 0 : e.clientY - handleFrom.current;
              handleFrom.current = null;
              setSheetOpen((open) => (moved < -16 ? true : moved > 16 ? false : !open));
            }}
            onClick={(e) => {
              // A key press. A finger or a mouse was answered on the way up.
              if (e.detail === 0) setSheetOpen((open) => !open);
            }}
            className="flex h-7 w-full shrink-0 touch-none items-center justify-center rounded-t-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flash-400"
          >
            <span className="h-1.5 w-10 rounded-full bg-[var(--mc-line-strong)]" aria-hidden="true" />
          </button>
          <div ref={sheetScroll} data-sheet={sheetHeight} className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-1">
            {step}
          </div>
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
        <div className="mc-dark mc-screen flex h-[100dvh] items-center justify-center bg-[var(--mc-ground)]">
          <Loader2 size={36} className="animate-spin text-flash-400" aria-hidden="true" />
        </div>
      }
    >
      <Screen mission={mission} />
    </Suspense>
  );
}
