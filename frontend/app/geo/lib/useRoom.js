'use client';

/**
 * A multiplayer room from the browser's side: who you are in it, the
 * latest state, and the actions. The room is polled every 1.5 seconds
 * while a game is on (3 seconds in the lobby) and pauses in hidden tabs.
 * Every action returns fresh state, so the screen never waits for the
 * next poll to show what you just did.
 *
 * Identity is the player token the server handed out on join, kept in
 * localStorage per room code.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { profileHeaders } from './profile';

const IDENTITY_KEY = 'geo:rooms:v1';
const NAME_KEY = 'geo:name';
const KEEP_ROOMS = 20;

function readAll() {
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadIdentity(code) {
  const entry = readAll()[code];
  return entry && entry.token ? entry : null;
}

export function saveIdentity(code, identity) {
  try {
    const all = readAll();
    all[code] = { ...identity, at: Date.now() };
    const codes = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0)).slice(0, KEEP_ROOMS);
    const trimmed = {};
    for (const c of codes) trimmed[c] = all[c];
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable */
  }
}

export function loadName() {
  try {
    return window.localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    window.localStorage.setItem(NAME_KEY, String(name || '').slice(0, 20));
  } catch {
    /* ignore */
  }
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

export function useRoom(code) {
  const [identity, setIdentity] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const identityRef = useRef(null);
  const stateRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const id = loadIdentity(code);
    identityRef.current = id;
    setIdentity(id);
    setReady(true);
  }, [code]);

  const apply = useCallback((json) => {
    if (json && json.state) {
      stateRef.current = json.state;
      offsetRef.current = (json.state.serverNow || Date.now()) - Date.now();
      setState(json.state);
    }
  }, []);

  const headersFor = useCallback((extra = {}) => {
    const headers = { ...extra, ...profileHeaders() };
    if (identityRef.current?.token) headers['x-geo-player'] = identityRef.current.token;
    return headers;
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/geo/rooms/${code}`, { headers: headersFor(), cache: 'no-store' });
    const json = await readJson(res);
    if (!res.ok) {
      setError({ code: json.code || 'error', message: json.error || 'Could not load the room', status: res.status });
      return null;
    }
    setError(null);
    apply(json);
    return json.state;
  }, [code, headersFor, apply]);

  // The poll.
  useEffect(() => {
    if (!ready) return undefined;
    let stopped = false;
    let timer = 0;
    const loop = async () => {
      if (stopped) return;
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        try {
          await refresh();
        } catch {
          /* network hiccup; try again next tick */
        }
      }
      if (stopped) return;
      const phase = stateRef.current?.room?.phase;
      const busy = phase === 'guessing' || phase === 'reveal' || phase === 'loading';
      timer = setTimeout(loop, busy ? 1500 : 3000);
    };
    loop();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, refresh]);

  const act = useCallback(
    async (action, body = {}) => {
      const res = await fetch(`/api/geo/rooms/${code}`, {
        method: 'POST',
        headers: headersFor({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, ...body }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        const err = new Error(json.error || 'That did not work');
        err.code = json.code;
        err.status = res.status;
        throw err;
      }
      apply(json);
      return json;
    },
    [code, headersFor, apply]
  );

  const adopt = useCallback(
    (id) => {
      identityRef.current = id;
      setIdentity(id);
      saveIdentity(code, id);
      if (id?.name) saveName(id.name);
    },
    [code]
  );

  const join = useCallback(
    async (name) => {
      const json = await act('join', { name });
      adopt({ token: json.token, playerId: json.playerId, name: json.state?.me?.name || name });
      return json;
    },
    [act, adopt]
  );

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { state, error, identity, ready, refresh, act, join, adopt, serverNow };
}

/** A clock that re-renders on an interval, for countdowns. */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
