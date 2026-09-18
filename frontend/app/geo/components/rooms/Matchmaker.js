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

export default function Matchmaker({ game, name, onNameChange, onGameChange }) {
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
    if (action === 'join' && name.trim()) await ensureProfile(name.trim());
    const response = await fetch('/api/geo/matchmaking', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...profileHeaders() },
      body: JSON.stringify({ action, game: selectedGame }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      remember(null); searching.current = false;
      if (mounted.current) { setStatus('idle'); setGate(true); }
      return null;
    }
    if (!response.ok) throw new Error(data.error || 'Could not reach matchmaking. Try again.');
    return data;
  };

  const accept = (data) => {
    if (!mounted.current || !data) return;
    if (data.status === 'matched') {
      searching.current = false; remember(null); clearTimeout(timer.current);
      saveIdentity(data.code, { token: data.token, playerId: data.playerId, name });
      setStatus('matched');
      router.push(`/geo/room/${data.code}`);
    } else if (data.status === 'waiting') {
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
    } catch (err) { setStatus('waiting'); setError(err.message); }
  };
  const active = ['joining', 'waiting', 'cancelling', 'matched'].includes(status);

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
