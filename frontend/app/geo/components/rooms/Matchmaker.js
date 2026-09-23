'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Users } from 'lucide-react';
import AccountDialog from '../AccountDialog';
import Button from '../ui/Button';
import { ensureProfile, profileHeaders } from '../../lib/profile';
import { saveIdentity, saveName } from '../../lib/useRoom';

const KEY = 'geo:matchmaking:pending';
function remember(game) { try { if (game) sessionStorage.setItem(KEY, game); else sessionStorage.removeItem(KEY); } catch { /* Optional refresh recovery. */ } }

export default function Matchmaker({ game, name, onNameChange, onGameChange, onActiveChange }) {
  const router = useRouter();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [gate, setGate] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);
  const mounted = useRef(true);
  const pending = useRef(null);
  const searching = useRef(false);
  const runRef = useRef(null);

  const request = async (action, selectedGame = game) => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 10000);
    try {
      if (action === 'join' && name.trim()) await ensureProfile(name.trim(), { signal: controller.signal });
      const response = await fetch('/api/geo/matchmaking', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ action, game: selectedGame }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (response.status === 401) {
        remember(null); searching.current = false;
        if (mounted.current) { setStatus('idle'); setGate(true); }
        return null;
      }
      if (!response.ok) {
        const failure = new Error(data.error || 'Could not reach matchmaking. Try again.');
        failure.retryable = response.status >= 500;
        throw failure;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('Connection interrupted. Reconnecting to the queue…'), { retryable: true });
      if (error instanceof TypeError || error instanceof SyntaxError) error.retryable = true;
      throw error;
    } finally { clearTimeout(deadline); }
  };

  const accept = (data) => {
    if (!mounted.current || !data) return;
    if (data.status === 'matched') {
      searching.current = false; remember(null); clearTimeout(timer.current);
      saveIdentity(data.code, { token: data.token, playerId: data.playerId, name });
      setStatus('matched');
      router.push(`/geo/room/${data.code}`);
    } else if (data.status === 'waiting') {
      setError('');
      remember(data.game); onGameChange(data.game); setStatus('waiting');
      setElapsed(Math.max(0, Math.floor((Date.now() - data.joinedAt) / 1000)));
      timer.current = setTimeout(() => runRef.current('poll', data.game), 4000);
    } else {
      searching.current = false; remember(null); setStatus('idle');
      if (data.status === 'expired') setError('Search paused while you were away. Find a match to try again.');
    }
  };

  const run = async (action, selectedGame = game) => {
    clearTimeout(timer.current);
    searching.current = true;
    if (action === 'join') { setStatus('joining'); setError(''); }
    const task = request(action, selectedGame);
    pending.current = task;
    try { accept(await task); }
    catch (err) {
      // A lost response is not a cancelled ticket. Recover the existing ticket
      // rather than silently enqueueing again or leaving a stuck spinner.
      if (err.retryable && mounted.current) {
        remember(selectedGame); setStatus('waiting');
        setError('Connection interrupted. Reconnecting to the queue…');
        timer.current = setTimeout(() => runRef.current('poll', selectedGame), 4000);
        return;
      }
      searching.current = false; remember(null);
      if (mounted.current) { setStatus('idle'); setError(err.message); }
    } finally { if (pending.current === task) pending.current = null; }
  };
  runRef.current = run;

  useEffect(() => {
    mounted.current = true;
    let previous;
    try { previous = sessionStorage.getItem(KEY); } catch { /* Storage is optional. */ }
    if (previous === 'street' || previous === 'script') runRef.current('poll', previous);
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);

  const cancel = async () => {
    clearTimeout(timer.current);
    setStatus('cancelling');
    // A heartbeat already in flight must finish before cancellation, otherwise
    // a delayed response could accidentally re-enqueue a player who cancelled.
    try {
      if (pending.current) await pending.current.catch(() => null);
      clearTimeout(timer.current);
      if (!searching.current) return;
      accept(await request('cancel'));
    } catch (err) {
      if (!mounted.current) return;
      setStatus('waiting'); setError(err.message);
      // Cancellation may have reached the server even when its response was
      // lost. Poll the authoritative ticket; never silently create a new one.
      timer.current = setTimeout(() => runRef.current('poll'), 4000);
    }
  };
  const active = ['joining', 'waiting', 'cancelling', 'matched'].includes(status);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  const statusText = status === 'waiting'
    ? `Looking for a ${game === 'script' ? 'Script' : 'Street'} player… ${elapsed}s`
    : status === 'matched'
      ? 'Match found. Opening your game…'
      : status === 'cancelling'
        ? 'Cancelling…'
        : status === 'joining'
          ? 'Joining the queue…'
          : 'Starts as soon as another player joins.';

  // The game (Street or Script) is chosen once, for the whole page, by
  // RoomBrowser. This card had its own Street/Script switch, and so did
  // the room card beside it: two identical switches on one screen
  // (founder, 2026-09-23: "extremely confusing").
  return <section className="ui-card flex flex-col p-5 sm:p-6" aria-labelledby="matchmaker-title" data-matchmaker>
    {gate ? <AccountDialog name={name} onNameChange={onNameChange} returnTo={`/geo/rooms?game=${game}`} onClose={() => setGate(false)} onAuthenticated={() => { setGate(false); runRef.current('join'); }} /> : null}
    <h2 id="matchmaker-title" className="ui-h2">Quick match</h2>
    <p className="mt-1 text-sm text-pe-muted">Play one other person who is looking right now. Five rounds, one minute per guess.</p>
    <div className="pt-6">
      {active
        ? <Button variant="secondary" size="lg" block onClick={cancel} disabled={status !== 'waiting'}><LoaderCircle size={18} className="animate-spin" />{status === 'matched' ? 'Opening game' : 'Cancel search'}</Button>
        : <Button size="lg" block onClick={() => { if (name.trim()) saveName(name.trim()); run('join'); }}><Users size={18} /> Find match</Button>}
      <p role="status" aria-live="polite" className="mt-3 text-sm text-pe-muted">{statusText}</p>
      {status === 'waiting' && elapsed >= 20 ? <p className="ui-small mt-1">No opponent yet. Keep waiting, or play with friends instead.</p> : null}
      {error ? <p role="alert" className="ui-error mt-2">{error}</p> : null}
    </div>
  </section>;
}
