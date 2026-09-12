'use client';

/**
 * /geo/script/play: the script game.
 *
 * Read a sentence, pin where that language is spoken. Settings come
 * from the query string (app/lib/geo/script.js), so a link is a whole
 * game and a seed replays the same sentences in the same order.
 *
 * Immersive route (app/lib/navChrome.js): the screen is the game's, and
 * the X leads back to the lobby.
 *
 * The map is Leaflet rather than MapKit, and that is the difference
 * between this mode and the rest of the game: a script round shows no
 * provider's imagery, so it owes no provider a map, and the keyless
 * version means the mode runs on a clone of the repository with an
 * empty environment. See LeafletScriptMap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Clock, Loader2, MapPin, RotateCcw, X } from 'lucide-react';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { randomSeedString } from '@/app/lib/geo/random';
import { LADDERS, normalizeScriptConfig, scriptConfigToQuery } from '@/app/lib/geo/script';
import dynamic from 'next/dynamic';
import ScriptSample from './ScriptSample';
// The screen's own stylesheet: the light palette the map is drawn in,
// and the animations. Imported here rather than by the map, which is
// loaded late, so the sentence and the panels animate before the map's
// chunk has landed.
import './script-round.css';

// Leaflet touches window on import, so it cannot render on the server.
// Keyless on purpose: see LeafletScriptMap.
// The panorama round's chrome, so the two halves of the game look
// like one game (app/geo/components/GameHud.js).
// A script round is the one screen in the game with no imagery on it,
// so it is the one screen that is light: a map reads better as paper
// than as a hole in the dark, and the sentence is there to be read.
const PILL = 'rounded-full border border-midnight-200 bg-white/95 shadow-sm';
const ICON_BUTTON = `${PILL} flex h-11 w-11 items-center justify-center text-midnight-700 transition hover:bg-white hover:text-midnight-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400`;

/**
 * A number that arrives rather than appears. Short enough that nobody
 * waits for it, long enough that the eye follows it up.
 */
function useCountUp(value, duration = 650) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !Number.isFinite(value)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setShown(value);
      return undefined;
    }
    let frame = 0;
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / duration);
      // Fast then settling, so the last hundred points land softly.
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

const LeafletScriptMap = dynamic(() => import('./LeafletScriptMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#dce9f2]" />,
});

export default function ScriptPlayClient() {
  const params = useSearchParams();
  const config = useMemo(() => {
    const raw = Object.fromEntries(params?.entries?.() || []);
    const normal = normalizeScriptConfig(raw);
    return { ...normal, seed: normal.seed || randomSeedString() };
  }, [params]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pin, setPin] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(config.timer || 0);
  const [mapTrouble, setMapTrouble] = useState(false);

  const ladder = LADDERS[config.ladder] || LADDERS.world;
  const done = history.length >= config.rounds && !result;
  const total = history.reduce((sum, row) => sum + row.score, 0);

  // One round at a time, asked for by index: the server is stateless and
  // the seed decides the game, so this is replayable and cheap.
  useEffect(() => {
    if (roundIndex >= config.rounds) return undefined;
    let live = true;
    setLoading(true);
    setError('');
    setRound(null);
    setPin(null);
    setResult(null);
    fetch('/api/geo/script/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, roundIndex }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Could not start the round');
        if (live) {
          setRound(data.round);
          setSecondsLeft(config.timer || 0);
        }
      })
      .catch((roundError) => live && setError(roundError.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [config, roundIndex]);

  const submit = useCallback(
    async (guess) => {
      if (!round || sending || result) return;
      setSending(true);
      try {
        const response = await fetch('/api/geo/script/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: round.token, guess }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Could not score the guess');
        setResult(data.result);
        setHistory((rows) => [...rows, { ...data.result, text: round.text, script: round.script }]);
      } catch (guessError) {
        setError(guessError.message);
      } finally {
        setSending(false);
      }
    },
    [round, sending, result]
  );

  // The clock. Running out submits whatever pin is on the map, which
  // may be none: an empty guess scores zero and still reveals.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const pinRef = useRef(pin);
  pinRef.current = pin;
  // Once per round, and from a ref rather than from inside the
  // setSecondsLeft updater: an updater must be pure, and Strict Mode runs
  // it twice, which submitted and recorded the same round twice.
  const firedRef = useRef(null);
  useEffect(() => {
    if (!config.timer || !round || result) return undefined;
    const endsAt = Date.now() + config.timer * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0 || firedRef.current === round.token) return;
      firedRef.current = round.token;
      clearInterval(timer);
      submitRef.current(pinRef.current);
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [config.timer, round, result]);

  const next = () => {
    setResult(null);
    setRoundIndex((index) => index + 1);
  };

  if (done) {
    return <Summary config={config} ladder={ladder} history={history} total={total} />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f4efe4] text-midnight-900">
      {/* The sentence gets the top of the screen and the map gets the
          rest of it. It used to float over the map, which put the thing
          you are reading on top of the thing you answer on. */}
      <header className="relative z-30 shrink-0 border-b border-midnight-200 bg-[#fffdf8] shadow-sm">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-3 pt-3 sm:px-4">
          <div className={`flex items-center gap-3 px-4 py-2 ${PILL}`}>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] uppercase tracking-wide text-midnight-500">{ladder.short}</span>
              <span className="text-sm font-semibold">
                Round {Math.min(roundIndex + 1, config.rounds)} of {config.rounds}
              </span>
            </div>
            <div className="flex flex-col border-l border-midnight-200 pl-3 leading-tight">
              <span className="text-[11px] uppercase tracking-wide text-midnight-500">Score</span>
              <span className="text-sm font-semibold tabular-nums text-midnight-900">{formatScore(total)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.timer ? (
              <div className={`flex items-center gap-2 px-3 py-2 ${secondsLeft <= 10 ? 'rounded-full border border-red-300 bg-red-50 shadow-sm' : PILL}`}>
                <Clock className={`h-4 w-4 ${secondsLeft <= 10 ? 'text-red-500' : 'text-midnight-400'}`} />
                <span className={`min-w-[2ch] text-sm font-semibold tabular-nums ${secondsLeft <= 10 ? 'text-red-600' : ''}`}>{secondsLeft}</span>
              </div>
            ) : null}
            <Link href="/geo/script" className={ICON_BUTTON} aria-label="Leave the game" title="Leave the game">
              <X className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-3 pb-4 pt-3 text-center sm:px-4">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-3 text-midnight-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Finding a sentence
            </p>
          ) : error ? (
            <div className="py-2 text-sm">
              <p className="text-red-600">{error}</p>
              <Link href="/geo/script" className="mt-3 inline-block rounded-lg bg-midnight-900 px-3 py-1.5 font-semibold text-white hover:bg-midnight-800">
                Back to the lobby
              </Link>
            </div>
          ) : round ? (
            <div key={roundIndex} className="wg-sentence-in">
              <ScriptSample text={round.text} script={round.script} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative flex-1">
        <LeafletScriptMap
          pin={pin}
          onPin={setPin}
          mode={result ? 'result' : 'guess'}
          answer={result?.answer || null}
          guess={result?.guess || null}
          nearestPoint={result?.nearestPoint || null}
          onMapTrouble={() => setMapTrouble(true)}
        />

        {/* The world outline is one chunk of the game's own bundle; if a
            network drops it, say so rather than leaving an empty
            rectangle that looks like the game broke. */}
        {mapTrouble && !result ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-3">
            <p className="pointer-events-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 shadow-sm">
              The world outline did not load on this network, so you are placing a pin on a bare grid. The round still scores.
            </p>
          </div>
        ) : null}

        {result ? (
          <Reveal result={result} last={history.length >= config.rounds} onNext={next} />
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 sm:p-4">
            <div className="mx-auto max-w-md">
              {!pin && !loading && round ? (
                <p className="mb-2 text-center text-sm font-medium text-midnight-700">
                  <span className="rounded-full bg-[#fffdf8]/90 px-3 py-1 shadow-sm">Tap the map where that language is spoken</span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={!pin || sending || !round}
                onClick={() => submit(pin)}
                className="pointer-events-auto w-full rounded-xl bg-flash-500 px-4 py-3.5 text-base font-semibold text-midnight-950 shadow-lg transition enabled:hover:bg-flash-400 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-midnight-200 disabled:text-midnight-500 disabled:shadow-sm"
              >
                {sending ? 'Scoring' : 'Guess'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The answer, and how close the pin was to it. */
function Reveal({ result, last, onNext }) {
  const { answer } = result;
  const score = useCountUp(result.score);
  return (
    <div className="wg-panel-in absolute inset-x-0 bottom-0 z-30 max-h-[72%] overflow-y-auto border-t border-midnight-200 bg-[#fffdf8] p-4 shadow-[0_-12px_38px_rgba(43,38,32,0.18)]">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xl font-bold">
            {answer.name} <span className="font-normal text-midnight-500">{answer.endonym}</span>
          </h2>
          <p className="text-lg font-semibold tabular-nums text-midnight-900">{formatScore(score)} points</p>
        </div>
        <p className="mt-1 text-sm text-midnight-500">
          {answer.scriptName} script, {answer.branch}, {answer.family}. About {answer.speakers} million speakers.
        </p>
        <p className="mt-3 text-sm">
          {result.guess === null
            ? 'No pin, so no points. The clock ran out.'
            : result.inRegion
              ? `Your pin was inside ${plural(answer.regions)}.`
              : `Your pin was ${formatDistance(result.distanceKm)} from the nearest place ${answer.name} is spoken.`}
        </p>
        {result.alsoSpokenHere?.length ? (
          <p className="mt-2 text-sm text-midnight-500">
            Where you pinned, people speak {result.alsoSpokenHere.map((l) => l.name).join(', ')}.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-flash-500 px-4 py-3 font-semibold text-midnight-950 shadow-lg transition hover:bg-flash-400 active:scale-[0.99]"
        >
          {last ? 'See the results' : 'Next round'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function plural(regions) {
  if (!regions?.length) return 'the right area';
  if (regions.length === 1) return regions[0].name;
  return `${regions[0].name}, one of ${regions.length} places it is spoken`;
}

/** The end of a game. */
function Summary({ config, ladder, history, total }) {
  const replay = `/geo/script/play?${scriptConfigToQuery({ ...config, seed: randomSeedString() })}`;
  const same = `/geo/script/play?${scriptConfigToQuery(config)}`;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#f4efe4] text-midnight-900">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm uppercase tracking-wide text-midnight-500">{ladder.label}</p>
        <h1 className="mt-1 text-3xl font-bold">{formatScore(total)} points</h1>
        <p className="mt-1 text-midnight-500">
          out of {formatScore(history.length * 5000)} across {history.length} {history.length === 1 ? 'round' : 'rounds'}
        </p>

        <ol className="mt-6 space-y-3">
          {history.map((row, index) => (
            <li key={index} className="wg-panel-in rounded-xl border border-midnight-200 bg-[#fffdf8] p-4 shadow-sm" style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold">
                  {row.answer.name} <span className="font-normal text-midnight-500">{row.answer.endonym}</span>
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatScore(row.score)} <span className="font-normal text-midnight-400">pts</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-midnight-500">
                {row.answer.scriptName} script.{' '}
                {row.guess === null ? 'No pin.' : row.inRegion ? 'You pinned inside it.' : `You were ${formatDistance(row.distanceKm)} off.`}
              </p>
              <ScriptSample text={row.text} script={row.script} size="sm" />
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={replay} className="flex items-center gap-2 rounded-xl bg-flash-500 px-4 py-2.5 font-semibold text-midnight-950 hover:bg-flash-400">
            <RotateCcw className="h-4 w-4" /> New game
          </Link>
          <Link href={same} className="flex items-center gap-2 rounded-xl border border-midnight-200 bg-white px-4 py-2.5 font-semibold shadow-sm hover:bg-midnight-50">
            <MapPin className="h-4 w-4" /> Replay these
          </Link>
          <Link href="/geo/script" className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-midnight-600 hover:text-midnight-900">
            Change the pool
          </Link>
        </div>
      </div>
    </div>
  );
}
