'use client';

/**
 * useSearch - everything the search screen knows and can do, for one pet.
 *
 * Two reads, both open to anyone holding the pet's link: the picture
 * (the pet, where it was lost, the sightings, how many people are out)
 * and the board (the ground of the search in areas, and whether each has
 * been searched or has someone on it). The picture is asked again every thirty seconds, and every
 * ten while a sighting is fresh; the board every thirty, and at once
 * after this person's own tap. Both reads are limited per network
 * address, and a whole search party can sit behind one address, so the
 * polls are kept few and stop for half a minute when the server says to
 * slow down. No account is needed to read either.
 *
 * One exception: a desk steering the search (`steers`: the person running
 * it, at a computer, while it is open) reads both every five seconds.
 * That is one desk per search, it is where the whole search is watched
 * from, and a board half a minute old is not a view of it. A read that
 * comes back the same as the last one changes nothing on the screen, so
 * the map is redrawn only when the search really changed. A search that
 * has ended is read every two minutes by everyone, a read that fails
 * holds the next ones back, and an answer that arrives after a newer one
 * has been shown is dropped.
 *
 * Someone on the search (on an area, joined from the link, asked to
 * search one or written to), and the owner on a phone, read the picture
 * every ten seconds, the pace already kept while a sighting is fresh. The picture is the small read,
 * and it says when this person was asked to search an area, which is when
 * the board is read again: so an ask or a word from the desk is on their
 * card within seconds, and the board itself is still read only twice a
 * minute.
 *
 * Who this person is comes from the session, or from the volunteer this
 * browser joined as (lib/identity.js). The position is one reading of
 * the phone's location, taken when the person asks for ground or sends
 * a sighting and never watched: walking with GPS belongs to the app
 * (app/hooks/useInstrument.js), and a browser cannot do it with the
 * screen off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { deviceKey, readVolunteer, saveVolunteer, volunteerHeaders, readMySightings, saveMySighting } from '../lib/identity';
import { hotSighting } from '../lib/words';

const POLL_MS = 30000;
const POLL_HOT_MS = 10000;
const BOARD_POLL_MS = 30000;
/** How often a desk steering the search reads the picture and the board. */
const STEER_POLL_MS = 5000;
/** A search that has ended changes only if it is opened again: it is read this often. */
const CLOSED_POLL_MS = 120000;
/** After a "too many requests" answer, nothing is asked for this long. */
const SLOW_DOWN_MS = 30000;
/** After a read the server could not answer, nothing is asked for this long. */
const ERROR_PAUSE_MS = 20000;
/** After a link that matches no pet, for this long: it will not start matching one. */
const GONE_PAUSE_MS = 5 * 60 * 1000;

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/**
 * A request that answers null instead of throwing. People use this
 * outdoors, where a dropped signal is ordinary: every call below turns
 * that into words on the card, and nothing is left spinning.
 */
function send(url, init) {
  // A request that stalls on a weak signal never fails by itself: it is given up on, so the card can say so.
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), SEND_TIMEOUT_MS);
  return fetch(url, { ...init, signal: stop.signal })
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}
const SEND_TIMEOUT_MS = 20000;
const NO_SIGNAL = 'No connection just now. Check your signal and try again.';
// One empty list each, so a screen that has none does not see a new one on every read.
const NO_PEOPLE = [];
const NO_WORDS = [];
const NO_ITEMS = [];

export default function useSearch(missionParam, { desk = false } = {}) {
  const { status: authStatus } = useSession();
  const [picture, setPicture] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(null); // 'gone' | 'error'
  const [volunteer, setVolunteer] = useState(null);
  const [position, setPosition] = useState(null); // { lat, lng, accuracy, at }
  const [mySightings, setMySightings] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const volunteerRef = useRef(null);
  volunteerRef.current = volunteer;
  const caseIdRef = useRef(null);
  const boardAt = useRef(0);
  const pausedUntil = useRef(0);
  // The last answer of each read, as text: one that comes back the same is not set again.
  const lastText = useRef({ picture: '', board: '' });
  // The area the board says this person was asked to search, so the picture can tell when that has changed.
  const askedOnBoard = useRef(null);
  // What the board is in: areas of ground, or the streets or squares of a search from before it was on areas.
  const unitNow = useRef('area');
  const everMine = useRef(false);
  // What this screen has already said it showed (a word, the ask), so each is said once.
  const told = useRef(new Set());
  // Reads are numbered as they are sent. One that answers after a later one has been shown is out of date and is dropped.
  const sent = useRef({ picture: 0, board: 0 });
  const shown = useRef({ picture: 0, board: 0 });

  const headers = useCallback((extra = {}) => ({ ...volunteerHeaders(volunteerRef.current), ...extra }), []);

  const loadPicture = useCallback(async () => {
    if (!missionParam) return null;
    sent.current.picture += 1;
    const turn = sent.current.picture;
    const res = await fetch(`/api/mission/${encodeURIComponent(missionParam)}/picture`, { headers: headers(), cache: 'no-store' });
    if (res.status === 404) {
      pausedUntil.current = Date.now() + GONE_PAUSE_MS;
      setFailure('gone');
      return null;
    }
    if (!res.ok) pausedUntil.current = Date.now() + (res.status === 429 ? SLOW_DOWN_MS : ERROR_PAUSE_MS);
    if (!res.ok) throw new Error('picture');
    const data = await res.json();
    if (turn < shown.current.picture) return data;
    shown.current.picture = turn;
    const text = JSON.stringify(data);
    if (text !== lastText.current.picture) {
      lastText.current.picture = text;
      setPicture(data);
    }
    setFailure(null);
    return data;
  }, [missionParam, headers]);

  const loadBoard = useCallback(async () => {
    if (!missionParam) return null;
    sent.current.board += 1;
    const turn = sent.current.board;
    const res = await fetch(`/api/mission/${encodeURIComponent(missionParam)}/board`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) {
      pausedUntil.current = Date.now() + (res.status === 429 ? SLOW_DOWN_MS : ERROR_PAUSE_MS);
      return null;
    }
    const data = await res.json();
    if (turn < shown.current.board) return data;
    shown.current.board = turn;
    boardAt.current = Date.now();
    unitNow.current = data.unit || 'area';
    const all = [...(data.areas || []), ...(data.streets || []), ...(data.cells || [])];
    const askedOfMe = all.find((s) => s.askedOfMe) || null;
    const askedNow = askedOfMe?.id || null;
    // A new ask is a new thing to show, and to say it was shown. So is one the search has not heard was shown:
    // taken back and made again for the same street between two reads, it is the same street and a new ask.
    if (askedNow !== askedOnBoard.current || askedOfMe?.askedSeen === false) told.current.delete('ask');
    askedOnBoard.current = askedNow;
    if (all.some((i) => i.mine)) everMine.current = true;
    const text = JSON.stringify(data);
    if (text !== lastText.current.board) {
      lastText.current.board = text;
      setBoard(data);
    }
    return data;
  }, [missionParam, headers]);

  const reload = useCallback(async () => {
    try {
      await Promise.all([loadPicture(), loadBoard()]);
    } catch {
      // A missed poll keeps the last picture; only a first load that fails says so.
      setFailure((f) => f || (caseIdRef.current ? null : 'error'));
    } finally {
      setLoading(false);
    }
  }, [loadPicture, loadBoard]);

  // First load. The picture comes first so the volunteer this browser
  // joined as (stored under the pet's id) rides on the board read.
  useEffect(() => {
    if (!missionParam || authStatus === 'loading') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const first = await loadPicture();
        if (cancelled || !first) return;
        caseIdRef.current = first.id;
        const joined = readVolunteer({ caseId: first.id, caseNumber: first.caseNumber });
        if (joined) {
          volunteerRef.current = joined;
          setVolunteer(joined);
        }
        setMySightings(readMySightings(first.id));
        await Promise.all([joined ? loadPicture() : null, loadBoard()]);
      } catch {
        if (!cancelled) setFailure('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionParam, authStatus, loadPicture, loadBoard]);

  // Keep it current: sooner while a sighting is fresh or this phone sent one.
  const hot = useMemo(() => hotSighting(picture?.sightings, now), [picture, now]);
  // A desk steering the search watches all of it, so it reads both often (see the note at the top).
  const closed = picture ? !picture.open : false;
  const steers = Boolean(desk && picture?.viewer?.leads && !closed);
  // Someone on the search hears from the desk within seconds (see the note at the top), and so does the owner
  // on a phone, where a helper's word is on their own card.
  const onSearch = Boolean(picture?.viewer && (picture.viewer.isOwner || volunteer || everMine.current || picture.asked || picture.words?.length));
  const interval = closed ? CLOSED_POLL_MS : steers ? STEER_POLL_MS : hot || mySightings.length || onSearch ? POLL_HOT_MS : POLL_MS;
  const boardEvery = closed ? CLOSED_POLL_MS : steers ? STEER_POLL_MS : BOARD_POLL_MS;
  useEffect(() => {
    if (!picture?.id) return undefined;
    const tick = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState !== 'visible' || Date.now() < pausedUntil.current) return;
      // The sightings are what changes fast. The streets change slowly, and this person's own tap reloads them at once.
      loadPicture()
        .then((read) => {
          // Asked to walk a street, or an ask taken back, since the board was last read: read it now.
          if (read && 'asked' in read && (read.asked || null) !== askedOnBoard.current) loadBoard().catch(() => null);
        })
        .catch(() => null);
      // A little slack, so a tick that lands a moment short of its turn still reads the board.
      if (Date.now() - boardAt.current >= boardEvery - 2000) loadBoard().catch(() => null);
    }, interval);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [picture?.id, interval, boardEvery, reload, loadPicture, loadBoard]);

  /**
   * One reading of where the phone is. Resolves to the position, or null
   * when it is refused or unavailable. `fresh` refuses an answer the phone
   * had saved and waits a little for a new one: a saved answer can be a
   * rough one from before its GPS woke up. `ifAllowed` reads only where
   * the phone has already said this page may: it is for a reading that
   * rides along with something else the person pressed, and it never
   * puts the phone's own question on the screen.
   */
  const locate = useCallback(
    async ({ fresh = false, ifAllowed = false } = {}) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
      if (ifAllowed) {
        let allowed = false;
        try {
          const status = await navigator.permissions?.query({ name: 'geolocation' });
          allowed = status?.state === 'granted';
        } catch {
          // A browser that cannot say is treated as one that has not said yes.
        }
        if (!allowed) return null;
      }
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() };
            setPosition(here);
            resolve(here);
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: fresh ? 5000 : 10000, maximumAge: fresh ? 0 : 30000 }
        );
      });
    },
    []
  );

  /** Join this pet's search without an account: a first name and the safety tick. */
  const join = useCallback(
    async ({ name, waiverVersion = null }) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'JOIN', deviceId: deviceKey(), name: String(name || '').trim() || undefined, waiverAccepted: true, waiverVersion, adult: true }),
      });
      if (!res) return { error: NO_SIGNAL };
      const data = await readJson(res);
      if (!res.ok || !data.success) return { error: data.error || 'That did not go through. Try again in a moment.' };
      const joined = { id: data.volunteerId, name: String(name || '').trim() };
      if (caseIdRef.current) saveVolunteer(caseIdRef.current, joined);
      volunteerRef.current = joined;
      setVolunteer(joined);
      await reload();
      return { ok: true };
    },
    [missionParam, reload]
  );

  /** Someone signed in accepts the safety rules and the waiver: the version their screen showed, as an adult. */
  const acceptWaiver = useCallback(
    async ({ waiverVersion = null } = {}) => {
      const res = await send('/api/legal/accept-waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: waiverVersion || undefined, adult: true, caseId: caseIdRef.current || undefined }),
      });
      if (!res) return { error: NO_SIGNAL };
      if (!res.ok) {
        const data = await readJson(res);
        return { error: data.code === 'WAIVER_CHANGED' ? data.error : 'That did not go through. Try again in a moment.' };
      }
      await reload();
      return { ok: true };
    },
    [reload]
  );

  /** They have read "Before you go out". Recorded if it can be; nothing waits on it. */
  const trained = useCallback(
    () => send(`/api/mission/${encodeURIComponent(missionParam)}/trained`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }) }).then(() => undefined),
    [missionParam, headers]
  );

  /** The plan of the search and its tasks other than searching ground (app/lib/searchPlan.js), for the desk's Tasks tab. */
  const readPlan = useCallback(async () => {
    const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/plan`, { cache: 'no-store' });
    if (!res) return { error: NO_SIGNAL };
    const data = await readJson(res);
    return res.ok ? data : { error: data.error || 'The tasks did not load. Try again in a moment.' };
  }, [missionParam]);

  /** Set a task up (POST), or keep one: looked at, done, removed (PATCH). */
  const writePlan = useCallback(
    async (method, body) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/plan`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res) return { error: NO_SIGNAL };
      const data = await readJson(res);
      return res.ok ? { ok: true } : { error: data.error || 'That did not go through. Try again in a moment.' };
    },
    [missionParam]
  );

  /** One change to the board, and the board read again after it. */
  const change = useCallback(
    async (body) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/board`, {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      if (!res) return { error: NO_SIGNAL, code: 'NO_SIGNAL' };
      const data = await readJson(res);
      await loadBoard().catch(() => null);
      if (!res.ok) return { error: data.error || 'That did not go through. Try again in a moment.', code: data.code || null };
      loadPicture().catch(() => null);
      return { ok: true, item: data.item };
    },
    [missionParam, headers, loadBoard, loadPicture]
  );

  /** Start an area, stop, or say it is searched. From the desk of whoever runs the search, also the steering actions. */
  const act = useCallback((unit, id, action) => change({ unit, id, action }), [change]);
  /** The debrief on an area just searched: how much of it was covered and, in their own words, what could not be reached. */
  const debrief = useCallback((id, covered, note = '') => change({ unit: 'area', id, action: 'debrief', covered, note }), [change]);
  /** Whoever runs the search asks one person (a handle from `people`) to search an area, with a note if they have one. */
  const ask = useCallback((person, id, note = '') => change({ unit: unitNow.current, id, action: 'ask', person, note }), [change]);
  /** Take back what a person was asked to search. */
  const unask = useCallback((person) => change({ unit: unitNow.current, action: 'unask', person }), [change]);
  /** The person asked says they cannot. */
  const cannot = useCallback(() => change({ unit: unitNow.current, action: 'cannot' }), [change]);
  /** Whoever runs the search adds the outer ring to it. */
  const widen = useCallback(() => change({ unit: 'area', action: 'widen' }), [change]);
  /** Whoever runs the search puts every searched area up for another look. */
  const againAll = useCallback(() => change({ unit: 'area', action: 'againAll' }), [change]);

  /**
   * A word through the search screen. With `to` (a handle from `people`)
   * whoever runs the search writes to that person; without it, someone on
   * the search writes back to the people running it.
   */
  const say = useCallback(
    async (text, to = null) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/message`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: String(text || '').trim(), ...(to ? { to } : {}) }),
      });
      if (!res) return { error: NO_SIGNAL };
      const data = await readJson(res);
      if (!res.ok) return { error: data.error || 'That did not send. Try again in a moment.' };
      await loadPicture().catch(() => null);
      return { ok: true };
    },
    [missionParam, headers, loadPicture]
  );

  /** Send a sighting: a place and a time. This phone remembers which one it sent, so coming back shows what the owner did about it. */
  const sendSighting = useCallback(
    async (body) => {
      const res = await send(`/api/public/missions/${encodeURIComponent(missionParam)}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res) return { error: NO_SIGNAL };
      const data = await readJson(res);
      if (!res.ok) return { error: data.error || 'That did not send. Check your connection and try again.' };
      // `at` is when the pet was seen, which can be yesterday. `sentAt` is now, and is what "Sent at" on the next card means.
      const mine = { id: data.sighting.id, at: data.sighting.sightedAt, sentAt: new Date().toISOString(), place: data.place || null };
      if (caseIdRef.current) {
        saveMySighting(caseIdRef.current, mine);
        setMySightings(readMySightings(caseIdRef.current));
      }
      await loadPicture().catch(() => null);
      return { ok: true, sighting: mine, told: data.told, ownerName: data.ownerName };
    },
    [missionParam, loadPicture]
  );

  /** The owner's answer to a sighting: seen, or going. Sent so that it still lands if the tap also opens the maps app. */
  const answer = useCallback(
    async (sightingId, action, extra = {}) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sightingId, action, ...extra }),
        keepalive: true,
      });
      if (!res) return { error: NO_SIGNAL };
      const data = await readJson(res);
      if (!res.ok) return { error: data.error || 'That did not go through. Try again in a moment.' };
      await loadPicture().catch(() => null);
      return { ok: true };
    },
    [missionParam, loadPicture]
  );

  /** The owner tells everyone helping something. It goes on the pet's page and in the desk's log. */
  const tell = useCallback(
    async (text) => {
      const res = await send(`/api/missions/${encodeURIComponent(caseIdRef.current || missionParam)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: String(text || '').trim() }),
      });
      if (!res) return { error: NO_SIGNAL };
      if (!res.ok) {
        const data = await readJson(res);
        return { error: data.message || data.error || 'That did not post. Try again in a moment.' };
      }
      await loadPicture().catch(() => null);
      return { ok: true };
    },
    [missionParam, loadPicture]
  );

  // One empty list while there is no board, so what is drawn from it is not drawn again on every render.
  /**
   * This person's screen has shown a word written to them, or the street they were asked to walk. It is what
   * the desk reads as "seen", so it is said once per thing, when the card that shows it is in front of them.
   */
  const saw = useCallback(
    async ({ words = [], ask = false } = {}) => {
      const fresh = words.filter((id) => id && !told.current.has(`w:${id}`));
      const askNew = ask && !told.current.has('ask');
      if (!fresh.length && !askNew) return { ok: true };
      fresh.forEach((id) => told.current.add(`w:${id}`));
      if (askNew) told.current.add('ask');
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/message`, {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...(fresh.length ? { words: fresh } : {}), ...(askNew ? { ask: true } : {}) }),
      });
      if (!res || !res.ok) {
        // Not heard: it is said again the next time the card shows it.
        fresh.forEach((id) => told.current.delete(`w:${id}`));
        if (askNew) told.current.delete('ask');
        if (!res) return { error: NO_SIGNAL };
        return { error: 'not recorded' };
      }
      return { ok: true };
    },
    [missionParam, headers]
  );

  const items = board ? (board.unit === 'area' ? board.areas : board.unit === 'street' ? board.streets : board.cells) || NO_ITEMS : NO_ITEMS;
  const mine = items.find((i) => i.mine) || null;

  return {
    loading: loading || authStatus === 'loading',
    failure,
    picture,
    board,
    unit: board?.unit || 'area',
    items,
    // The circle the areas are cut from: { center, inner, edge, wide, radius, widened }.
    circle: board?.circle || null,
    // Named streets near the search, for naming a place or a direction. Nobody is sent to walk one.
    around: board?.around || NO_ITEMS,
    mine,
    // Everyone on the search and what each is doing: sent only to the owner and the forces looking.
    people: board?.people || NO_PEOPLE,
    // Every message of the search, for the people running it; and the ones between this person and them.
    talk: picture?.talk || NO_WORDS,
    words: picture?.words || NO_WORDS,
    viewer: picture?.viewer || null,
    volunteer,
    position,
    mySightings,
    hot,
    now,
    reload,
    locate,
    join,
    acceptWaiver,
    trained,
    act,
    debrief,
    readPlan,
    writePlan,
    sendSighting,
    answer,
    tell,
    ask,
    unask,
    cannot,
    widen,
    againAll,
    say,
    saw,
  };
}
