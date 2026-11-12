'use client';

/**
 * useSearch - everything the search screen knows and can do, for one pet.
 *
 * Two reads, both open to anyone holding the pet's link: the picture
 * (the pet, where it was lost, the sightings, how many people are out)
 * and the board (the streets and whether each is free, being walked or
 * searched). The picture is asked again every thirty seconds, and every
 * ten while a sighting is fresh; the board every thirty, and at once
 * after this person's own tap. Both reads are limited per network
 * address, and a whole search party can sit behind one address, so the
 * polls are kept few and stop for half a minute when the server says to
 * slow down. No account is needed to read either.
 *
 * Who this person is comes from the session, or from the volunteer this
 * browser joined as (lib/identity.js). The position is one reading of
 * the phone's location, taken when the person asks for a street or sends
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
/** After a "too many requests" answer, nothing is asked for this long. */
const SLOW_DOWN_MS = 30000;

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/**
 * A request that answers null instead of throwing. People use this
 * outdoors, where a dropped signal is ordinary: every call below turns
 * that into words on the card, and nothing is left spinning.
 */
function send(url, init) {
  return fetch(url, init).catch(() => null);
}
const NO_SIGNAL = 'No connection just now. Check your signal and try again.';

export default function useSearch(missionParam) {
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

  const headers = useCallback((extra = {}) => ({ ...volunteerHeaders(volunteerRef.current), ...extra }), []);

  const loadPicture = useCallback(async () => {
    if (!missionParam) return null;
    const res = await fetch(`/api/mission/${encodeURIComponent(missionParam)}/picture`, { headers: headers(), cache: 'no-store' });
    if (res.status === 404) {
      setFailure('gone');
      return null;
    }
    if (res.status === 429) pausedUntil.current = Date.now() + SLOW_DOWN_MS;
    if (!res.ok) throw new Error('picture');
    const data = await res.json();
    setPicture(data);
    setFailure(null);
    return data;
  }, [missionParam, headers]);

  const loadBoard = useCallback(async () => {
    if (!missionParam) return null;
    const res = await fetch(`/api/mission/${encodeURIComponent(missionParam)}/board`, { headers: headers(), cache: 'no-store' });
    if (res.status === 429) pausedUntil.current = Date.now() + SLOW_DOWN_MS;
    if (!res.ok) return null;
    const data = await res.json();
    boardAt.current = Date.now();
    setBoard(data);
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
  const interval = hot || mySightings.length ? POLL_HOT_MS : POLL_MS;
  useEffect(() => {
    if (!picture?.id) return undefined;
    const tick = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState !== 'visible' || Date.now() < pausedUntil.current) return;
      // The sightings are what changes fast. The streets change slowly, and this person's own tap reloads them at once.
      loadPicture().catch(() => null);
      // A little slack, so a tick that lands a moment short of the half minute still reads the board.
      if (Date.now() - boardAt.current >= BOARD_POLL_MS - 2000) loadBoard().catch(() => null);
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
  }, [picture?.id, interval, reload, loadPicture, loadBoard]);

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
        body: JSON.stringify({ action: 'JOIN', deviceId: deviceKey(), name: String(name || '').trim() || undefined, waiverAccepted: true, waiverVersion }),
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

  /** Someone signed in accepts the safety rules and the waiver. */
  const acceptWaiver = useCallback(async () => {
    const res = await send('/api/legal/accept-waiver', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res) return { error: NO_SIGNAL };
    if (!res.ok) return { error: 'That did not go through. Try again in a moment.' };
    await reload();
    return { ok: true };
  }, [reload]);

  /** Take a street, give it back, or mark it searched. */
  const act = useCallback(
    async (unit, id, action) => {
      const res = await send(`/api/mission/${encodeURIComponent(missionParam)}/board`, {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ unit, id, action }),
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

  const items = board ? (board.unit === 'street' ? board.streets : board.cells) : [];
  const mine = items.find((i) => i.mine) || null;

  return {
    loading: loading || authStatus === 'loading',
    failure,
    picture,
    board,
    unit: board?.unit || 'street',
    items,
    // Named streets just past the board's edge, for naming a place or a direction.
    around: board?.around || [],
    mine,
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
    act,
    sendSighting,
    answer,
  };
}
