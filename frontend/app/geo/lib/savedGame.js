'use client';

import { useEffect, useRef, useState } from 'react';
import { isSignedIn } from './session';
import { selectSavedGame } from './saveSelection';

const KEY = 'geo:saved-game:v2';
export function localSavedGame() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

function writeLocal(saved) { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Storage is optional. */ } }

async function saveContext() {
  if (!isSignedIn()) return { accountId: null, revision: 0, savedGame: null };
  const response = await fetch('/api/geo/save', { cache: 'no-store' });
  if (response.status === 401) return { accountId: null, revision: 0, savedGame: null };
  if (!response.ok) throw new Error('Could not load saved progress. Your game can still be played on this device.');
  return response.json();
}

async function contextAndLocal() {
  let context = await saveContext();
  let local = localSavedGame();
  // Another tab may acknowledge a write after this GET took its snapshot.
  // Re-read once rather than treating the just-synced local game as absent.
  if (context.accountId && local?.owner === context.accountId && local.baseRevision > context.revision) {
    context = await saveContext();
    local = localSavedGame();
  }
  return { context, local };
}

export async function latestSavedGame() {
  try {
    const { context, local } = await contextAndLocal();
    return selectSavedGame(local, context.savedGame, context.accountId, context.revision);
  } catch {
    // An unreadable session is not permission to show another account's local save.
    return isSignedIn() ? null : selectSavedGame(localSavedGame(), null, null, 0);
  }
}

export function useSavedGame({ kind, url, snapshot, enabled, resume, restore }) {
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sessionVersion, setSessionVersion] = useState(0);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const contextRef = useRef(null);
  const ownerRef = useRef(undefined);
  const chainRef = useRef(Promise.resolve());
  const acknowledgedRef = useRef('');
  const serialized = enabled ? JSON.stringify(snapshot) : '';

  useEffect(() => {
    const changed = () => setSessionVersion((version) => version + 1);
    window.addEventListener('geo:authenticated', changed);
    window.addEventListener('geo:session-changed', changed);
    return () => { window.removeEventListener('geo:authenticated', changed); window.removeEventListener('geo:session-changed', changed); };
  }, []);

  useEffect(() => {
    let alive = true;
    setReady(false);
    const previousContext = contextRef.current;
    contextRef.current = null;
    contextAndLocal().then(({ context, local }) => {
      if (!alive) return;
      const owner = context.accountId;
      // Switching accounts while a game remains open must not copy the old
      // account's progress into the new one.
      if (ownerRef.current && ownerRef.current !== owner) {
        setSaveError('Your account changed. Start or reopen a game from Play before saving.');
        setReady(true);
        return;
      }
      // Re-authenticating the same account does not grant an old game a new
      // revision with which to overwrite a newer save from another device.
      contextRef.current = previousContext?.accountId === owner ? previousContext : context;
      ownerRef.current = owner;
      if (resume && sessionVersion === 0) {
        const saved = selectSavedGame(local, context.savedGame, owner, context.revision, { adoptGuest: new URLSearchParams(window.location.search).get('signed-in') === '1' });
        if (saved?.kind === kind && saved?.url === url) restoreRef.current(saved.snapshot);
      }
      setReady(true);
    }).catch((error) => { if (alive) { setSaveError(error.message); setReady(true); } });
    return () => { alive = false; };
  }, [kind, url, resume, sessionVersion]);

  useEffect(() => {
    if (!ready || !serialized) return undefined;
    const context = contextRef.current;
    if (!context) return undefined;
    const signature = JSON.stringify([context.accountId, kind, url, serialized]);
    const saved = { kind, url, snapshot: JSON.parse(serialized), at: Date.now(), owner: context.accountId, baseRevision: context.revision, pending: Boolean(context.accountId) && acknowledgedRef.current !== signature };
    writeLocal(saved);
    if (!context.accountId) return undefined;
    let alive = true;
    const sync = () => {
      chainRef.current = chainRef.current.catch(() => {}).then(async () => {
        if (!alive || contextRef.current !== context || acknowledgedRef.current === signature) return;
        const requestRevision = context.revision;
        writeLocal({ ...saved, baseRevision: requestRevision, pending: true });
        try {
          const response = await fetch('/api/geo/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...saved, accountId: context.accountId, expectedRevision: requestRevision }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            if (alive) setSaveError(data.error || 'Could not sync. Your copy is kept on this device.');
            return;
          }
          // Advance even if the next round is already waiting in this chain.
          context.revision = data.revision;
          acknowledgedRef.current = signature;
          if (alive) {
            writeLocal({ ...saved, ...data.savedGame, baseRevision: data.revision, pending: false });
            setSaveError('');
          }
        } catch { if (alive) setSaveError('Offline. Your game is kept on this device.'); }
      });
    };
    sync();
    window.addEventListener('focus', sync);
    return () => { alive = false; window.removeEventListener('focus', sync); };
  }, [ready, serialized, kind, url, sessionVersion]);
  return { ready, saveError };
}
