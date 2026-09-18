'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Check, MapPin, RotateCcw, X } from 'lucide-react';
import { LADDERS, normalizeScriptConfig, scriptConfigToQuery } from '@/app/lib/geo/script';
import { randomSeedString } from '@/app/lib/geo/random';
import { formatScore } from '@/app/lib/geo/distance';
import { useSavedGame } from '../../lib/savedGame';
import { ignoreGameShortcut } from '../../lib/mapKeyboard';
import ScriptSample from './ScriptSample';
import KeepThis from '../KeepThis';
import SaveGameButton from '../SaveGameButton';
import './detective.css';

const Map = dynamic(() => import('./LeafletScriptMap'), { ssr: false,
  loading: () => <div className="pe-detective-map-loading">Loading map…</div>,
});
const queryFor = (config) => `${scriptConfigToQuery(config)}&experience=detective`;

export default function ScriptDetectiveClient({ params }) {
  const config = useMemo(() => {
    const normalized = normalizeScriptConfig(Object.fromEntries(params.entries()));
    return { ...normalized, seed: normalized.seed || randomSeedString() };
  }, [params]);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(null);
  const [choice, setChoice] = useState(null);
  const [pin, setPin] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [seconds, setSeconds] = useState(config.timer);
  const inFlight = useRef(false);
  const live = useRef(true);
  const submitRef = useRef(null);
  const fired = useRef(null);
  const resultTitle = useRef(null);
  const resumeUrl = `/geo/script/play?${queryFor(config)}&resume=1`;
  const { ready, saveError } = useSavedGame({ kind: 'script', url: resumeUrl,
    snapshot: { experience: 'detective', config, roundIndex: index, history, result },
    enabled: Boolean(result) || history.length >= config.rounds,
    resume: params.get('resume') === '1',
    restore: (saved) => {
      if (saved.experience !== 'detective' || !Array.isArray(saved.history)) return;
      const rows = saved.history.slice(0, config.rounds);
      const restoredIndex = Math.min(config.rounds, Math.max(0, saved.roundIndex || 0));
      setHistory(rows); setIndex(restoredIndex);
      setResult(restoredIndex < config.rounds ? saved.result || null : null);
      const last = rows.at(-1);
      if (last) setRound({ text: last.text, script: last.script });
      setLoading(false);
    },
  });
  const total = history.reduce((sum, entry) => sum + entry.score, 0);
  const done = index >= config.rounds;
  const correct = history.filter((entry) => entry.choice?.correct).length;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  useEffect(() => {
    if (!ready || done || history.length > index) return undefined;
    let current = true;
    setLoading(true); setError(''); setRound(null);
    fetch('/api/geo/script/detective/round', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, roundIndex: index }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load this round.');
      if (current) { setRound(data.round); setSeconds(config.timer); }
    }).catch((failure) => { if (current) setError(failure.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [config, index, done, history.length, ready, retry]);

  const submit = useCallback(async () => {
    if (!round?.token || inFlight.current || result || done || history.length > index) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/geo/script/detective/guess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: round.token, guess: { choice, pin } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check your answer.');
      if (!live.current) return;
      const scored = { ...data.result, text: round.text, script: round.script };
      setResult(scored); setHistory((rows) => [...rows, scored]); setMapOpen(false);
    } catch (failure) { if (live.current) setError(failure.message); }
    finally { inFlight.current = false; if (live.current) setBusy(false); }
  }, [round, result, done, history.length, index, choice, pin]);
  submitRef.current = submit;
  useEffect(() => {
    if (!round?.token || !config.timer || result || done || history.length > index) return undefined;
    const endsAt = Date.now() + config.timer * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining && fired.current !== round.token) {
        fired.current = round.token; clearInterval(interval); submitRef.current();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [round, config.timer, result, done, history.length, index]);
  useEffect(() => {
    if (result || done) resultTitle.current?.focus();
  }, [result, done]);
  useEffect(() => {
    const keyboard = (event) => {
      if (ignoreGameShortcut(event) || result || busy || loading || mapOpen || done) return;
      if (round?.choices?.some((entry) => entry.id === event.key)) { event.preventDefault(); setChoice(event.key); }
      if (event.key === 'Enter' && choice) { event.preventDefault(); submitRef.current(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [round, result, busy, loading, mapOpen, done, choice]);
  const next = () => {
    setRound(null); setResult(null); setChoice(null); setPin(null); setMapOpen(false);
    setIndex((value) => value + 1); setError('');
  };

  return <div className="pe-detective">
    <header className="pe-detective-header">
      <Link href="/geo/script" className="pe-detective-close" aria-label="Leave Script"><X size={21} /></Link>
      <div className="pe-detective-progress" aria-label={`Round ${Math.min(index + 1, config.rounds)} of ${config.rounds}`}>
        {Array.from({ length: config.rounds }, (_, position) => <span key={position} data-state={history[position] ? history[position].choice?.correct ? 'correct' : 'missed' : position === index ? 'current' : 'next'} aria-hidden="true">
          {history[position]?.choice?.correct ? <Check size={13} /> : position + 1}
        </span>)}
      </div>
      <div className="pe-detective-score"><span>Score</span><strong>{formatScore(total)}</strong></div>
      {config.timer && !result && !done ? <span className="pe-detective-clock" aria-label={`${seconds} seconds left`}>{seconds}s</span> : null}
      {history.length > 0 && !done ? <SaveGameButton returnTo={resumeUrl} className="pe-detective-close" /> : null}
    </header>

    {saveError ? <p className="pe-detective-error" role="status">{saveError}</p> : null}
    {error ? <div className="pe-detective-error" role="alert"><p>{error}</p>
      <button onClick={() => round?.token ? submit() : setRetry((value) => value + 1)}>Try again</button>
    </div> : null}

    {done ? <section className="pe-detective-finish" aria-label="Script results">
      <p className="pe-detective-eyebrow">Script · {LADDERS[config.ladder].label}</p>
      <h1 ref={resultTitle} tabIndex={-1}>{correct} <span>of {history.length} languages</span></h1>
      <p className="pe-detective-finish-score">{formatScore(total)} points</p>
      <div className="pe-detective-finish-actions">
        <Link className="pe-detective-primary" href={`/geo/script/play?${queryFor({ ...config, seed: randomSeedString() })}`}><RotateCcw size={18} /> Play again</Link>
        <Link className="pe-detective-secondary" href={`/geo/script/play?${queryFor(config)}&replay=${randomSeedString()}`}>Replay this set</Link>
      </div>
      <ol className="pe-detective-recap">{history.map((entry, position) => <li key={position}>
        <span className="pe-detective-recap-symbol" data-correct={Boolean(entry.choice?.correct)}>{entry.choice?.correct ? <Check size={19} /> : <X size={19} />}</span>
        <div><strong>{entry.answer.name}</strong><span>{entry.answer.endonym}</span></div>
        <b>{formatScore(entry.score)}</b>
      </li>)}</ol>
      <KeepThis returnTo={resumeUrl} />
      <Link className="pe-detective-back" href="/geo">All games</Link>
    </section> : result ? <section className="pe-detective-reveal" aria-label="Answer reveal">
      <div className="pe-detective-answer">
        <p className="pe-detective-eyebrow">{result.choice ? result.choice.correct ? 'Correct' : `You chose ${result.choice.name}` : 'Time’s up'}</p>
        <div className="pe-detective-answer-title"><h1 ref={resultTitle} tabIndex={-1}>{result.answer.name}<span>{result.answer.endonym}</span></h1><strong>+{formatScore(result.score)}</strong></div>
        <div className="pe-detective-breakdown"><span>Language <b>{formatScore(result.languagePoints)}</b></span><span>Map bonus <b>{formatScore(result.mapPoints)}</b></span></div>
      </div>
      <div className="pe-detective-reveal-grid">
        <div className="pe-detective-clue">
          <p className="pe-detective-eyebrow">The clue</p>
          <div className="pe-detective-clue-glyph"><ScriptSample text={result.answer.markers?.[0]?.text || result.answer.endonym} script={result.script} /></div>
          <p>{result.answer.markers?.[0]?.note || `Written in ${result.answer.scriptName}.`}</p>
          <details><summary>See the sentence</summary><ScriptSample text={result.text} script={result.script} size="sm" /></details>
        </div>
        <div className="pe-detective-place"><div className="pe-detective-answer-map"><Map mode="result" answer={result.answer} guess={result.guess} nearestPoint={result.nearestPoint} /></div><p>{result.answer.regions.map((region) => region.name).join(' · ')}</p></div>
      </div>
      <button className="pe-detective-primary pe-detective-next" onClick={next}>{index + 1 === config.rounds ? 'Results' : 'Next round'}<ArrowRight size={20} /></button>
    </section> : <div className="pe-detective-play">
      <section className="pe-detective-sentence" aria-label="Sentence to identify">
        <p className="pe-detective-eyebrow">Script · {LADDERS[config.ladder].label}</p>
        {loading ? <p role="status" className="pe-detective-loading">Finding a sentence…</p> : round ? <ScriptSample text={round.text} script={round.script} /> : null}
        <span className="pe-detective-round-label">{index + 1} / {config.rounds}</span>
      </section>
      <section className="pe-detective-decide" aria-labelledby="detective-question">
        <h1 id="detective-question">Which language?</h1>
        <div className="pe-detective-choices" role="group" aria-label="Language choices">
          {(round?.choices || []).map((entry) => <button key={entry.id} type="button" aria-pressed={choice === entry.id} disabled={busy} onClick={() => setChoice(entry.id)}><span>{entry.id}</span><strong>{entry.name}</strong>{choice === entry.id ? <Check size={20} /> : null}</button>)}
        </div>
        <button className="pe-detective-map-toggle" disabled={loading || busy || !round} aria-expanded={mapOpen} onClick={() => setMapOpen((open) => !open)}><MapPin size={18} />{pin ? 'Map pin added' : 'Add a map pin'}<span>+ up to 1,000</span></button>
        {mapOpen ? <div className="pe-detective-bonus-map"><Map onPin={setPin} pin={pin} mode="guess" /><button className="pe-detective-map-done" onClick={() => setMapOpen(false)}>{pin ? 'Keep pin' : 'Skip map'}</button></div> : null}
        <button className="pe-detective-primary" disabled={!choice || loading || busy} onClick={submit}>{busy ? 'Checking…' : 'Check answer'}<ArrowRight size={20} /></button>
        <p className="pe-detective-scoring">4,000 for the language. The map is optional.</p>
      </section>
    </div>}
  </div>;
}
