'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, Users } from 'lucide-react';
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

  return <section className="pe-matchmaker" aria-labelledby="matchmaker-title">
    {gate ? <AccountDialog name={name} onNameChange={onNameChange} returnTo={`/geo/rooms?game=${game}`} onClose={() => setGate(false)} onAuthenticated={() => { setGate(false); runRef.current('join'); }} /> : null}
    <div>
      <h2 id="matchmaker-title">Find an opponent</h2>
      <p>One against one. Five rounds. One minute per guess.</p>
      <div className="pe-rule-choice" role="group" aria-label="Match game">
        {['street', 'script'].map((choice) => <button key={choice} type="button" disabled={active} aria-pressed={choice === game} onClick={() => onGameChange(choice)}>{choice === 'street' ? 'Street' : 'Script'}</button>)}
      </div>
      <p role="status" aria-live="polite">{status === 'waiting' ? `Looking for a ${game === 'script' ? 'Script' : 'Street'} player… ${elapsed}s` : status === 'matched' ? 'Match found. Opening your game…' : status === 'cancelling' ? 'Cancelling…' : status === 'joining' ? 'Joining the queue…' : 'Starts automatically when another player joins.'}</p>
      {status === 'waiting' && elapsed >= 20 ? <p>No opponent yet. Keep waiting, or cancel and invite a friend below.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    {active ? <Button onClick={cancel} disabled={status !== 'waiting'}><LoaderCircle size={18} className="animate-spin" />{status === 'matched' ? 'Opening game' : 'Cancel search'}</Button>
      : <Button size="lg" onClick={() => { if (name.trim()) saveName(name.trim()); run('join'); }}><Users size={19} /> Find match <ArrowRight size={19} /></Button>}
  </section>;
}
