'use client';

import { useEffect, useRef, useState } from 'react';
import { isSignedIn } from './session';

const KEY = 'geo:saved-game:v1';
export function localSavedGame() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export async function latestSavedGame() {
  if (isSignedIn()) {
    try {
      const response = await fetch('/api/geo/save', { cache: 'no-store' });
      if (response.ok) {
        const { savedGame } = await response.json();
        if (savedGame) return savedGame;
      }
    } catch { /* Local copy remains usable while offline. */ }
  }
  return localSavedGame();
}

export function useSavedGame({ kind, url, snapshot, enabled, resume, restore }) {
  const [ready, setReady] = useState(!resume);
  const [saveError, setSaveError] = useState('');
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const serialized = enabled ? JSON.stringify(snapshot) : '';

  useEffect(() => {
    let alive = true;
    if (!resume) { setReady(true); return undefined; }
    setReady(false);
    // A just-created account has not received the browser checkpoint yet.
    const local = localSavedGame();
    const localMatch = local?.kind === kind && local?.url === url ? local : null;
    Promise.resolve(localMatch || latestSavedGame()).then((saved) => {
      if (!alive) return;
      if (saved?.kind === kind && saved?.url === url) restoreRef.current(saved.snapshot);
      setReady(true);
    }).catch(() => alive && setReady(true));
    return () => { alive = false; };
  }, [kind, url, resume]);

  useEffect(() => {
    if (!ready || !serialized) return undefined;
    const saved = { kind, url, snapshot: JSON.parse(serialized), at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* Storage can be unavailable. */ }
    let alive = true;
    const sync = async () => {
      if (!isSignedIn()) return;
      try {
        const response = await fetch('/api/geo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) });
        if (alive) setSaveError(response.ok ? '' : 'Could not sync your game. The copy on this device is still available.');
      } catch { if (alive) setSaveError('Offline. Your game is kept on this device.'); }
    };
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('geo:authenticated', sync);
    return () => { alive = false; window.removeEventListener('focus', sync); window.removeEventListener('geo:authenticated', sync); };
  }, [ready, serialized, kind, url]);
  return { ready, saveError };
}
