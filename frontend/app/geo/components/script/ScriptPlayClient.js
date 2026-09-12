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

// Leaflet touches window on import, so it cannot render on the server.
// Keyless on purpose: see LeafletScriptMap.
// The panorama round's chrome, so the two halves of the game look
// like one game (app/geo/components/GameHud.js).
const PILL = 'rounded-full border border-white/20 bg-midnight-900/80 shadow-lg backdrop-blur';
const ICON_BUTTON = `${PILL} flex h-11 w-11 items-center justify-center text-white transition hover:bg-midnight-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400`;

const LeafletScriptMap = dynamic(() => import('./LeafletScriptMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-midnight-900" />,
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
    <div className="fixed inset-0 z-[60] bg-midnight-950 text-white">
      {/* The map is the screen. A sentence needs a panel, not half a
          display, and the panorama game already set this shape. */}
      <div className="absolute inset-0">
        <LeafletScriptMap
          pin={pin}
          onPin={setPin}
          mode={result ? 'result' : 'guess'}
          answer={result?.answer || null}
          guess={result?.guess || null}
          onMapTrouble={() => setMapTrouble(true)}
        />
      </div>

      {/* Top row: the same pill and icon button the panorama round uses. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2 ${PILL}`}>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-wide text-white/60">{ladder.short}</span>
            <span className="text-sm font-semibold text-white">
              Round {Math.min(roundIndex + 1, config.rounds)} of {config.rounds}
            </span>
          </div>
          <div className="flex flex-col border-l border-white/15 pl-3 leading-tight">
            <span className="text-[11px] uppercase tracking-wide text-white/60">Score</span>
            <span className="text-sm font-semibold tabular-nums text-flash-300">{formatScore(total)}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {config.timer ? (
            <div className={`flex items-center gap-2 px-3 py-1.5 ${secondsLeft <= 10 ? 'rounded-full border border-red-400/60 bg-red-950/70 shadow-lg backdrop-blur' : PILL}`}>
              <Clock className="h-4 w-4 text-white/60" />
              <span className={`min-w-[2ch] text-sm font-semibold tabular-nums ${secondsLeft <= 10 ? 'text-red-200' : 'text-white'}`}>{secondsLeft}</span>
            </div>
          ) : null}
          <Link href="/geo/script" className={ICON_BUTTON} aria-label="Leave the game" title="Leave the game">
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* The sentence. Sized to its content and centred near the top, so
          a long Devanagari line and a short Thai one both look composed. */}
      {!result ? (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-3 sm:top-24">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-midnight-950/85 p-4 shadow-2xl backdrop-blur sm:p-6">
            {loading ? (
              <p className="flex items-center gap-2 py-2 text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Finding a sentence
              </p>
            ) : error ? (
              <div className="text-sm">
                <p className="text-red-300">{error}</p>
                <Link href="/geo/script" className="mt-3 inline-block rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">
                  Back to the lobby
                </Link>
              </div>
            ) : round ? (
              <ScriptSample text={round.text} script={round.script} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The world outline is one chunk of the game's own bundle; if a
          network drops it, say so rather than leaving an empty rectangle
          that looks like the game broke. */}
      {mapTrouble && !result ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-3">
          <p className="pointer-events-auto max-w-md rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
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
              <p className="mb-2 text-center text-sm text-white/70 drop-shadow">Tap the map where that language is spoken</p>
            ) : null}
            <button
              type="button"
              disabled={!pin || sending || !round}
              onClick={() => submit(pin)}
              className="pointer-events-auto w-full rounded-xl bg-flash-500 px-4 py-3.5 text-base font-semibold text-midnight-950 shadow-xl transition enabled:hover:bg-flash-400 disabled:cursor-not-allowed disabled:bg-midnight-900/80 disabled:text-white/40 disabled:shadow-lg disabled:backdrop-blur"
            >
              {sending ? 'Scoring' : 'Guess'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The reveal: what the language was, and what the pin was near. */
function Reveal({ result, last, onNext }) {
  const { answer } = result;
  return (
    <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto border-t border-white/10 bg-midnight-950/95 p-4 backdrop-blur">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xl font-bold">
            {answer.name} <span className="font-normal text-white/60">{answer.endonym}</span>
          </h2>
          <p className="text-lg font-semibold text-flash-400">{formatScore(result.score)} points</p>
        </div>
        <p className="mt-1 text-sm text-white/60">
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
          <p className="mt-2 text-sm text-white/60">
            Where you pinned, people speak {result.alsoSpokenHere.map((l) => l.name).join(', ')}.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-flash-500 px-4 py-3 font-semibold text-midnight-950 transition hover:bg-flash-400"
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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-midnight-950 text-white">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm uppercase tracking-wide text-white/40">{ladder.label}</p>
        <h1 className="mt-1 text-3xl font-bold">{formatScore(total)} points</h1>
        <p className="mt-1 text-white/60">
          out of {formatScore(history.length * 5000)} across {history.length} {history.length === 1 ? 'round' : 'rounds'}
        </p>

        <ol className="mt-6 space-y-3">
          {history.map((row, index) => (
            <li key={index} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold">
                  {row.answer.name} <span className="font-normal text-white/50">{row.answer.endonym}</span>
                </p>
                <p className="text-sm font-semibold text-flash-400">
                  {formatScore(row.score)} <span className="font-normal text-white/40">pts</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-white/50">
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
          <Link href={same} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 font-semibold hover:bg-white/20">
            <MapPin className="h-4 w-4" /> Replay these
          </Link>
          <Link href="/geo/script" className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white/70 hover:text-white">
            Change the pool
          </Link>
        </div>
      </div>
    </div>
  );
}
