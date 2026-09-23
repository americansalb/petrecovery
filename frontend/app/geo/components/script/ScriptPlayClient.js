'use client';

/**
 * /geo/script/play: the script game.
 *
 * Read a sentence, pin where that language is used. Settings come
 * from the query string (app/lib/geo/script.js), so a link is a whole
 * game and a seed replays the same sentences in the same order.
 *
 * Immersive route (app/lib/navChrome.js): the screen is the game's, and
 * the X leads back to the lobby.
 *
 * The map is Apple's, like the rest of the game (AppleScriptMap), and
 * behind it is the game's own keyless map (LeafletScriptMap), drawn
 * from polygons already in the bundle. No key, no quota, no account,
 * and no bill: a clone with an empty environment still plays, and a
 * fallback that cost money would be a worse problem than the one it
 * solves.
 *
 * The round only falls to it when MapKit says no in as many words, or
 * never arrives. Apple answering slowly is not Apple refusing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Clock, Loader2, MapPin, RotateCcw, X } from 'lucide-react';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { randomSeedString } from '@/app/lib/geo/random';
import {
  LADDERS,
  highlightMarkers,
  normalizeScriptConfig,
  scriptConfigToQuery,
} from '@/app/lib/geo/script';
import dynamic from 'next/dynamic';
import {
  initializeMapKit,
  mapKitAuth,
  onMapKitAuth,
} from '../../lib/appleMapKit';
import AppleScriptMap from './AppleScriptMap';
import ScriptSample from './ScriptSample';
import KeepThis from '../KeepThis';
import SaveGameButton from '../SaveGameButton';
import { useSavedGame } from '../../lib/savedGame';
// The screen's own stylesheet: the light palette the map is drawn in,
// and the animations. Imported here rather than by the map, which is
// loaded late, so the sentence and the panels animate before the map's
// chunk has landed.
import './script-round.css';

// Leaflet touches window on import, so it cannot render on the server.
// Keyless on purpose: see LeafletScriptMap.
// How long MapKit gets to arrive at all. It is 800 KB and a bad enough
// network never delivers it, which is the one case with no error event
// to wait for. Once it HAS arrived there is no second clock: Apple
// answering slowly is not Apple refusing, and treating it as a refusal
// is what put the keyless map in front of players on a site where Apple
// works.
const MAPKIT_LOAD_MS = 12000;
// The panorama round's chrome, so the two halves of the game look
// like one game (app/geo/components/GameHud.js).
// A script round is the one screen in the game with no imagery on it,
// so it is the one screen that is light: a map reads better as paper
// than as a hole in the dark, and the sentence is there to be read.
const PILL = 'rounded-full border border-sand-200 bg-white/95 shadow-sm';
const ICON_BUTTON = `${PILL} flex h-11 w-11 items-center justify-center text-sand-700 transition hover:bg-white hover:text-sand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-pe-accent`;

/**
 * A number that arrives rather than appears. Short enough that nobody
 * waits for it, long enough that the eye follows it up.
 */
function useCountUp(value, duration = 650) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !Number.isFinite(value))
      return undefined;
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
  const seed = normalizeScriptConfig({ seed: params.get('seed') }).seed;
  useEffect(() => {
    if (seed) return;
    // Old/homepage links may omit the seed. Give the URL a stable game ID
    // BEFORE mounting the player, otherwise refresh invents another game
    // and cannot match the saved checkpoint. Next observes native history.
    const canonical = new URLSearchParams(params.toString());
    canonical.set('seed', randomSeedString());
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${canonical}${window.location.hash}`);
  }, [params, seed]);
  if (!seed) return <div role="status" className="fixed inset-0 z-[60] flex items-center justify-center bg-[#f4efe4] text-sand-900">Opening game…</div>;
  return <ScriptPlayGame key={params.toString()} params={params} />;
}

function ScriptPlayGame({ params }) {
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
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const submittingRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(config.timer || 0);
  const [mapTrouble, setMapTrouble] = useState(false);
  const [mapkit, setMapkit] = useState(null);
  const [provider, setProvider] = useState('pending');
  const playthrough = params.get('replay');
  const resumeUrl = `/geo/script/play?${scriptConfigToQuery(config)}${playthrough ? `&replay=${encodeURIComponent(playthrough)}` : ''}&resume=1`;
  const { ready: saveReady, saveError } = useSavedGame({
    kind: 'script', url: resumeUrl,
    snapshot: { config, roundIndex, history, result },
    enabled: Boolean(result) || history.length >= config.rounds,
    // A refresh is still this playthrough. A deliberate replay has a fresh
    // key in its URL, so it cannot accidentally restore the finished set.
    resume: true,
    restore: (saved) => {
      if (!Array.isArray(saved.history)) return;
      // Older clients could let the last timer score again after the summary.
      // Keep a private checkpoint inside the configured round count.
      const restoredHistory = saved.history.slice(0, config.rounds);
      const restoredIndex = Math.min(config.rounds, Math.max(0, Number.isInteger(saved.roundIndex) ? saved.roundIndex : restoredHistory.length));
      setHistory(restoredHistory);
      setRoundIndex(restoredIndex);
      setResult(restoredIndex < config.rounds ? saved.result || null : null);
      const last = restoredHistory[restoredHistory.length - 1];
      if (last) setRound({ text: last.text, script: last.script });
      setLoading(false);
    },
  });

  // Which map the round is played on. Apple, unless Apple says no.
  //
  // "Says no" has to mean an error and nothing else. This used to give
  // MapKit three seconds to confirm the token after the script landed
  // and treat the silence as a refusal, which meant any page where the
  // Initialized event had already fired before this screen mounted, or
  // any connection slow enough to miss the window, drew the keyless map
  // on a site where Apple works perfectly well. Apple is what the rest
  // of the game runs on and what the pet site has always run on, so the
  // benefit of the doubt belongs to Apple: the round starts on it as
  // soon as MapKit loads, and only an actual error moves it.
  //
  // The one clock left is for the script never arriving at all, which
  // is a dead map rather than a slow one.
  //
  // A refusal is latched, so a token that recovers mid-game does not
  // swap the map out from under a pin.
  useEffect(() => {
    let live = true;
    let unwatch = null;
    let timer = 0;
    const settle = (state) => {
      if (!live) return;
      // A refusal always moves the round off Apple, including one that
      // arrives mid-game when the day's quota runs out. Anything else,
      // 'pending' included, leaves the round where it is: once it has
      // landed on the keyless map it stays there, because a provider
      // that changed under a placed pin would lose the pin.
      if (state === 'failed') setProvider('leaflet');
    };
    // The script itself not arriving. Nothing to authorize, nothing to
    // draw, and no error event to wait for, because MapKit never ran.
    timer = setTimeout(() => {
      if (live)
        setProvider((current) => (current === 'pending' ? 'leaflet' : current));
    }, MAPKIT_LOAD_MS);
    initializeMapKit()
      .then((sdk) => {
        if (!live) return;
        clearTimeout(timer);
        setMapkit(sdk);
        setProvider((current) => (current === 'pending' ? 'apple' : current));
        settle(mapKitAuth());
        unwatch = onMapKitAuth(settle);
      })
      .catch(() => settle('failed'));
    return () => {
      live = false;
      clearTimeout(timer);
      unwatch?.();
    };
  }, []);

  const ladder = LADDERS[config.ladder] || LADDERS.world;
  const done = history.length >= config.rounds && !result;
  const total = history.reduce((sum, row) => sum + row.score, 0);

  // One round at a time, asked for by index: the server is stateless and
  // the seed decides the game, so this is replayable and cheap.
  useEffect(() => {
    if (!saveReady || roundIndex >= config.rounds || history.length > roundIndex) return undefined;
    let live = true;
    setLoading(true);
    setError('');
    setRound(null);
    setPin(null);
    setResult(null);
    setSelectedRegion(null);
    fetch('/api/geo/script/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, roundIndex }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data?.error || 'Could not start the round');
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
  }, [config, roundIndex, saveReady, history.length]);

  const submit = useCallback(
    async (guess) => {
      if (!round?.token || sending || submittingRef.current || result || roundIndex >= config.rounds || history.length > roundIndex) return;
      submittingRef.current = true;
      setSending(true);
      try {
        const response = await fetch('/api/geo/script/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: round.token, guess }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data?.error || 'Could not score the guess');
        setResult(data.result);
        setHistory((rows) => [
          ...rows,
          { ...data.result, text: round.text, script: round.script },
        ]);
      } catch (guessError) {
        setError(guessError.message);
      } finally {
        submittingRef.current = false;
        setSending(false);
      }
    },
    [round, sending, result, roundIndex, config.rounds, history.length],
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
    if (!config.timer || !round?.token || result || roundIndex >= config.rounds || history.length > roundIndex) return undefined;
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
  }, [config.timer, config.rounds, round, result, roundIndex, history.length]);

  const next = () => {
    setRound(null);
    setPin(null);
    setResult(null);
    setRoundIndex((index) => index + 1);
  };

  if (done) {
    return (
      <Summary
        config={config}
        ladder={ladder}
        history={history}
        total={total}
        resumeUrl={resumeUrl}
        saveError={saveError}
      />
    );
  }

  return (
    <div className="pe-script-round pe-paper fixed inset-0 z-[60] flex flex-col bg-[#f4efe4] text-sand-900">
      {/* The sentence gets the top of the screen and the map gets the
          rest of it. It used to float over the map, which put the thing
          you are reading on top of the thing you answer on. */}
      <header className="pe-sentence-stage relative z-30 shrink-0 border-b border-sand-200 bg-[#fffdf8] shadow-sm" data-revealed={Boolean(result)}>
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-3 pt-3 sm:px-4">
          <div className={`flex items-center gap-3 px-4 py-2 ${PILL}`}>
            <div className="flex flex-col leading-tight">
              {/* "Script - World", not "World": the street game has a
                  World mode too, and a header that says only the pool
                  does not say which game you are in. */}
              <span className="text-[11px] uppercase tracking-wide text-sand-500">
                Script &middot; {ladder.short}
              </span>
              <span className="text-sm font-semibold">
                {saveReady ? <>Round {Math.min(roundIndex + 1, config.rounds)} of {config.rounds}</> : 'Opening game…'}
              </span>
            </div>
            <div className="flex flex-col border-l border-sand-200 pl-3 leading-tight">
              <span className="text-[11px] uppercase tracking-wide text-sand-500">
                Score
              </span>
              <span className="text-sm font-semibold tabular-nums text-sand-900">
                {saveReady ? formatScore(total) : '…'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 ? <SaveGameButton returnTo={resumeUrl} className={ICON_BUTTON} /> : null}
            {config.timer ? (
              <div
                className={`flex items-center gap-2 px-3 py-2 ${secondsLeft <= 10 ? 'rounded-full border border-red-300 bg-red-50 shadow-sm' : PILL}`}
              >
                <Clock
                  className={`h-4 w-4 ${secondsLeft <= 10 ? 'text-red-500' : 'text-sand-400'}`}
                />
                <span
                  className={`min-w-[2ch] text-sm font-semibold tabular-nums ${secondsLeft <= 10 ? 'text-red-600' : ''}`}
                >
                  {secondsLeft}
                </span>
              </div>
            ) : null}
            <Link
              href="/geo/script"
              className={ICON_BUTTON}
              aria-label="Leave the game"
              title="Leave the game"
            >
              <X className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="wg-round-track" aria-label={`${history.length} of ${config.rounds} rounds played`}>
          {Array.from({ length: config.rounds }, (_, index) => <span key={index} data-complete={index < history.length} data-current={index === roundIndex} />)}
        </div>

        {saveError ? <p role="status" className="mx-auto max-w-4xl px-4 text-sm text-red-700">{saveError}</p> : null}
        <div className="mx-auto max-w-4xl px-3 pb-4 pt-3 text-center sm:px-4">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-3 text-sand-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {saveReady ? 'Finding a sentence' : 'Loading your progress'}
            </p>
          ) : error ? (
            <div className="py-2 text-sm">
              <p className="text-red-600">{error}</p>
              <Link href="/geo/script" className="ui-btn ui-btn--primary mt-3">
                Back to Script
              </Link>
            </div>
          ) : round ? (
            <div key={roundIndex} className="wg-sentence-in">
              <ScriptSample text={round.text} script={round.script} size={result ? 'sm' : 'lg'} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {provider === 'apple' && mapkit ? (
          <AppleScriptMap
            mapkit={mapkit}
            pin={pin}
            onPin={setPin}
            mode={result ? 'result' : 'guess'}
            answer={result?.answer || null}
            guess={result?.guess || null}
            nearestPoint={result?.nearestPoint || null}
            selectedRegion={selectedRegion}
            onUnavailable={() => setProvider('leaflet')}
          />
        ) : provider === 'leaflet' ? (
          <LeafletScriptMap
            pin={pin}
            onPin={setPin}
            mode={result ? 'result' : 'guess'}
            answer={result?.answer || null}
            guess={result?.guess || null}
            nearestPoint={result?.nearestPoint || null}
            selectedRegion={selectedRegion}
            onMapTrouble={() => setMapTrouble(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#dce9f2]">
            <Loader2 className="h-5 w-5 animate-spin text-sand-400" />
          </div>
        )}

        {/* The world outline is one chunk of the game's own bundle; if a
            network drops it, say so rather than leaving an empty
            rectangle that looks like the game broke. */}
        {mapTrouble && !result ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-3">
            <p className="pointer-events-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 shadow-sm">
              The world outline did not load on this network, so you are placing
              a pin on a bare grid. The round still scores.
            </p>
          </div>
        ) : null}

        {!result ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 sm:p-4">
            <div className="mx-auto max-w-md">
              {!pin && !loading && round ? (
                <p className="mb-2 text-center text-sm font-medium text-sand-700">
                  <span className="rounded-full bg-[#fffdf8]/90 px-3 py-1 shadow-sm">
                    Tap the map where that language is used
                  </span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={!pin || sending || !round}
                onClick={() => submit(pin)}
                data-geo-guess
                className="ui-btn ui-btn--primary ui-btn--lg pe-button pe-button--primary pointer-events-auto w-full"
              >
                {sending
                  ? 'Finding out…'
                  : pin
                    ? 'Lock in your guess'
                    : 'Place your pin to guess'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {result ? (
        <Reveal
          result={result}
          round={round}
          last={history.length >= config.rounds}
          onNext={next}
          selectedRegion={selectedRegion}
          onRegion={setSelectedRegion}
        />
      ) : null}
    </div>
  );
}

/**
 * A language's own name, when it is not the name above it. Tok Pisin is
 * Tok Pisin either way, and printing it twice read as a glitch.
 */
function endonymOf(answer) {
  const own = String(answer?.endonym || '').trim();
  return own && own.toLowerCase() !== String(answer?.name || '').trim().toLowerCase() ? own : '';
}

/** The answer, and how close the pin was to it. */
function Reveal({ result, round, last, onNext, selectedRegion, onRegion }) {
  const { answer } = result;
  const score = useCountUp(result.score);
  return (
    <div className="pe-script-reveal wg-panel-in relative z-30 flex max-h-[50svh] shrink-0 flex-col overflow-hidden border-t border-sand-200 bg-[#fffdf8] p-4 shadow-[0_-12px_38px_rgba(43,38,32,0.18)]">
      <div className="mx-auto min-h-0 w-full max-w-2xl overflow-y-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xl font-bold">
            {answer.name}
            {endonymOf(answer) ? (
              <span className="font-normal text-sand-500"> {endonymOf(answer)}</span>
            ) : null}
          </h2>
          <p className="text-lg font-semibold tabular-nums text-sand-900">
            {formatScore(score)} {Math.round(result.score) === 1 ? 'point' : 'points'}
          </p>
        </div>
        <div className="wg-region-explorer">
          <p className="text-sm font-semibold">Where {answer.name} is spoken <span className="wg-region-key" aria-hidden="true" /></p>
          <div className="wg-region-choices" aria-label="Explore language regions">
            <button type="button" aria-pressed={selectedRegion === null} onClick={() => onRegion(null)}>All regions</button>
            {(answer.regions || []).map((region, index) => <button key={`${region.name}-${index}`} type="button" aria-pressed={selectedRegion === index} onClick={() => onRegion(index)}>{region.name}</button>)}
          </div>
          <p className="wg-region-caption">Select a region to explore its outline. These areas show usage, not exclusive language borders.</p>
        </div>
        <p className="mt-3 text-sm">
          {result.guess === null
            ? 'No pin, so no points. The clock ran out.'
            : result.inRegion
              ? 'Your pin was inside a region where this language is used.'
              : `Your pin was ${formatDistance(result.distanceKm)} from the nearest place ${answer.name} is used.`}
        </p>
        {result.alsoSpokenHere?.length ? (
          <p className="mt-2 text-sm text-sand-500">
            Where you pinned, people speak{' '}
            {result.alsoSpokenHere.map((l) => l.name).join(', ')}.
          </p>
        ) : null}
        <details className="wg-clue-details">
          <summary>Recognize it next time</summary>
          <p className="mt-2 text-sm text-sand-600">{answer.scriptName} script · {answer.branch} · {answer.family}. About {answer.speakers} million speakers.</p>
          <Tells answer={answer} text={round?.text} script={round?.script} />
        </details>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="ui-btn ui-btn--primary ui-btn--lg pe-button pe-button--primary mx-auto mt-4 w-full max-w-2xl shrink-0"
      >
        {last ? 'See the results' : 'Next round'}{' '}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * What gave it away.
 *
 * The half of the round that makes it a game you get better at rather
 * than a quiz you pass or fail. Somebody who knows the answer knows it
 * from two or three concrete things, and being shown the letter that
 * would have settled it is worth more than being told the name.
 *
 * Only the features actually in the sentence just read are listed, and
 * they are marked in the sentence itself, so there is no hunting.
 */
function Tells({ answer, text, script }) {
  const markers = answer.markers || [];
  if (!markers.length && !answer.onlyOneInScript) return null;
  const runs = highlightMarkers(text, markers);
  return (
    <div className="pe-script-tells mt-4 rounded-xl border border-sand-200 bg-white/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-500">
        What gave it away
      </p>
      {answer.onlyOneInScript ? (
        <p className="mt-2 text-sm text-sand-700">
          In this pool, {answer.scriptName} is written for {answer.name} and
          nothing else. Recognizing its letters helps you find its regions.
        </p>
      ) : null}
      {runs.length ? (
        <p className="mt-2 break-words text-lg leading-relaxed" lang={script}>
          {runs.map((run, index) =>
            run.marker ? (
              <mark key={index} className="wg-tell">
                {run.text}
              </mark>
            ) : (
              <span key={index}>{run.text}</span>
            ),
          )}
        </p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {markers.map((marker) => (
          <li key={marker.text} className="text-sm text-sand-600">
            <span className="wg-tell rounded px-1 font-semibold" lang={script}>
              {marker.text}
            </span>{' '}
            {marker.note}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The end of a game. */
function Summary({ config, ladder, history, total, resumeUrl, saveError }) {
  const replay = `/geo/script/play?${scriptConfigToQuery({ ...config, seed: randomSeedString() })}`;
  // A same-URL Link leaves the completed component mounted. Change only the
  // playthrough key, not the seed/rules, so replay starts at round one.
  const same = `/geo/script/play?${scriptConfigToQuery(config)}&replay=${randomSeedString()}`;
  return (
    <div className="pe-script-summary pe-paper fixed inset-0 z-[60] overflow-y-auto bg-[#f4efe4] text-sand-900">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm uppercase tracking-wide text-sand-500">
          Script &middot; {ladder.label}
        </p>
        <h1 className="pe-script-total mt-1 text-3xl font-bold">
          {formatScore(total)}
          <span> points</span>
        </h1>
        <p className="mt-1 text-sand-500">
          out of {formatScore(history.length * 5000)} across {history.length}{' '}
          {history.length === 1 ? 'round' : 'rounds'}
        </p>

        {/* The way on, before the recap rather than under it. Five
            sentences used to sit between the score and these, which put
            the next game off the bottom of a desktop viewport. */}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={replay}
            className="ui-btn ui-btn--primary ui-btn--lg pe-button pe-button--primary"
          >
            <RotateCcw className="h-4 w-4" /> Play again
          </Link>
          <Link href={same} className="ui-btn ui-btn--secondary ui-btn--lg">
            <MapPin className="h-4 w-4" aria-hidden="true" /> Replay this set
          </Link>
          <Link href="/geo/script" className="ui-btn ui-btn--ghost ui-btn--lg">
            Choose other languages
          </Link>
        </div>

        {/* The account ask, after the way on and before the recap. It sat
            between "Your rounds" and the rounds, as a dark box on paper. */}
        <KeepThis returnTo={resumeUrl} />
        {saveError ? <p role="status" className="mt-3 text-sm text-pe-bad">{saveError}</p> : null}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-sand-500">
          Your rounds
        </h2>
        <ol className="mt-3 space-y-3">
          {history.map((row, index) => (
            /* Three blocks, each with its own space. The name, the
               numbers and the sentence used to share one flow, and a
               script with tall marks - Dzongkha, Devanagari - grew up
               into the metadata above it. */
            <li
              key={index}
              className="wg-panel-in rounded-xl border border-sand-200 bg-[#fffdf8] p-4 shadow-sm"
              style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold">
                  {row.answer.name}
                  {endonymOf(row.answer) ? (
                    <span className="font-normal text-sand-500"> {endonymOf(row.answer)}</span>
                  ) : null}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatScore(row.score)}{' '}
                  <span className="font-normal text-sand-400">{row.score === 1 ? 'point' : 'points'}</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-sand-500">
                {row.answer.scriptName} script.{' '}
                {row.guess === null
                  ? 'No pin.'
                  : row.inRegion
                    ? 'You pinned inside it.'
                    : `You were ${formatDistance(row.distanceKm)} off.`}
              </p>
              <div className="mt-3 border-t border-sand-200 pt-3">
                <ScriptSample text={row.text} script={row.script} size="sm" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
