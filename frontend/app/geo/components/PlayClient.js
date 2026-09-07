'use client';

/**
 * The game. Reads the settings from the URL, asks the server for a
 * round, shows the imagery, takes the guess, shows the result, repeats,
 * then records and offers the share links.
 *
 * Immersive route: no site chrome; the X in the top-right is the way out.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { MODES, configFromParams, configToParams } from '@/app/lib/geo/modes';
import { METER_CODES, refusalTitle, untilText } from '@/app/lib/geo/meter';
import { encodeShare } from '@/app/lib/geo/share';
import { reducer, createInitialState, isFinished, totalScore, streakLength, buildSummary } from '../lib/gameState';
import { loadGoogleMaps, onGoogleMapsAuthFailure } from '../lib/googleMaps';
import { ensureLookAround } from '../lib/lookAround';
import { recordGame, bestFor } from '../lib/storage';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { loadName } from '../lib/useRoom';
import GoogleStreetViewPane from './GoogleStreetViewPane';
import GoogleGuessMap from './GoogleGuessMap';
import AppleLookAroundPane from './AppleLookAroundPane';
import AppleGuessMap from './AppleGuessMap';
import GameHud from './GameHud';
import CountryPicker from './CountryPicker';
import LoadingSpot from './LoadingSpot';
import RoundResult from './RoundResult';
import GameSummary from './GameSummary';
import SetupNotice from './SetupNotice';

const MAP_SIZES = ['small', 'medium', 'large'];
const DESKTOP_SIZE = {
  small: 'sm:w-72 sm:h-56',
  medium: 'sm:w-[30rem] sm:h-80',
  large: 'sm:w-[44rem] sm:h-[32rem]',
};

/** "Tried 41 random points: 29 in water, 11 without imagery nearby." */
export function statsSentence(stats) {
  if (!stats) return '';
  const tried = (stats.probes || 0) + (stats.water || 0);
  if (!tried) return '';
  const details = [];
  if (stats.water) details.push(`${stats.water} in water`);
  if (stats.misses) details.push(`${stats.misses} without imagery nearby`);
  if (stats.unofficial) details.push(`${stats.unofficial} with only user photos`);
  const head = `Tried ${tried} random ${tried === 1 ? 'point' : 'points'}`;
  return details.length ? `${head}: ${details.join(', ')}.` : `${head}.`;
}

function Panel({ children }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight-950/95 p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function ErrorPanel({ title, message, stats, onRetry, retrying, appleHref, resetAt }) {
  return (
    <Panel>
      <div className="rounded-2xl border border-white/10 bg-midnight-900 p-5 text-white">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-flash-400" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-white/80">{message}</p>
            {resetAt ? <p className="mt-1 text-sm text-white/60">Free rounds come back {untilText(resetAt)}.</p> : null}
            {stats ? <p className="mt-2 text-xs text-white/50">{statsSentence(stats)}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {appleHref ? (
            <Link href={appleHref} className="rounded-xl bg-flash-400 px-4 py-2 text-sm font-bold text-midnight-900 hover:bg-flash-500">
              Play this on Apple imagery
            </Link>
          ) : null}
          {onRetry ? (
            <button type="button" onClick={onRetry} disabled={retrying} className="flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2 text-sm font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Trying again' : 'Try again'}
            </button>
          ) : null}
          <Link href="/geo" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
            Back to the lobby
          </Link>
        </div>
      </div>
    </Panel>
  );
}

export default function PlayClient() {
  const params = useSearchParams();
  const config = useMemo(() => configFromParams(params), [params]);
  const [state, dispatch] = useReducer(reducer, config, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [server, setServer] = useState(null);
  const [serverError, setServerError] = useState('');
  const [api, setApi] = useState(null);
  const [mapkit, setMapkit] = useState(null);
  const [sdkError, setSdkError] = useState('');
  const [heading, setHeading] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(config.time);
  const [mapSize, setMapSize] = useState('small');
  const [mapHover, setMapHover] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [appleAttempt, setAppleAttempt] = useState(0);
  const [share, setShare] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [daily, setDaily] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pointsByRound, setPointsByRound] = useState({});
  const paneRef = useRef(null);
  const requestRef = useRef(0);
  const recordedRef = useRef(false);
  const timerFiredRef = useRef(null);

  const isGoogle = config.provider === 'google';
  const isStreak = config.mode === 'streak';
  const providerInfo = server?.providers?.[config.provider];
  const configured = Boolean(providerInfo?.configured);

  // A new link is a new game.
  useEffect(() => {
    dispatch({ type: 'restart', config });
    recordedRef.current = false;
    setShare(null);
    setPointsByRound({});
    setSecondsLeft(config.time);
    setMobileMapOpen(false);
  }, [config]);

  // This browser's profile, so the play meter and the ratings know who
  // is playing. Created on the first game; a failure just plays unmetered
  // by profile (the address still counts).
  useEffect(() => {
    let alive = true;
    ensureProfile(loadName())
      .then((p) => alive && setProfile(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Server settings: which provider is set up, the browser key, the countries.
  useEffect(() => {
    let alive = true;
    fetch('/api/geo/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
      .then((data) => alive && setServer(data))
      .catch(() => alive && setServerError('Could not load the game settings from the server.'));
    return () => {
      alive = false;
    };
  }, []);

  // The imagery SDK.
  useEffect(() => {
    if (!server || !configured) return undefined;
    let alive = true;
    if (isGoogle) {
      loadGoogleMaps(providerInfo.browserKey)
        .then((loaded) => alive && setApi(loaded))
        .catch((error) => alive && setSdkError(error.message));
    } else {
      ensureLookAround()
        .then((loaded) => alive && setMapkit(loaded))
        .catch((error) => alive && setSdkError(error?.message || 'MapKit JS failed to load'));
    }
    return () => {
      alive = false;
    };
  }, [server, configured, isGoogle, providerInfo?.browserKey]);

  // A key rejected after load (referrer, API not enabled) is reported in
  // our words, with the exact line to add, instead of Google's overlay.
  useEffect(() => onGoogleMapsAuthFailure((message) => setSdkError(message)), []);

  const startRound = useCallback(async () => {
    const s = stateRef.current;
    const id = ++requestRef.current;
    dispatch({ type: 'load_start' });
    try {
      const res = await fetch('/api/geo/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ config: s.config, roundIndex: s.roundIndex, attempt: s.attempt }),
      });
      const data = await res.json().catch(() => ({}));
      if (id !== requestRef.current) return;
      if (!res.ok) {
        const error = new Error(data.error || 'Could not start the round');
        error.code = data.code;
        error.stats = data.stats;
        error.resetAt = data.resetAt || null;
        throw error;
      }
      dispatch({ type: 'load_success', round: data.round });
      setNotice(statsSentence(data.round.stats));
    } catch (error) {
      if (id !== requestRef.current) return;
      dispatch({ type: 'load_error', error: { message: error.message, code: error.code, stats: error.stats, resetAt: error.resetAt || null } });
    }
  }, []);

  useEffect(() => {
    if (!configured || state.status !== 'idle') return;
    startRound();
  }, [configured, state.status, state.roundIndex, state.attempt, startRound]);

  // "No imagery" twice in a row is bad luck; a third time we say so.
  const autoRetrying = state.status === 'error' && state.error?.code === 'no_imagery' && state.attempt < 2;

  // The play meter said no (docs/GEO.md): the same game on Apple imagery
  // is the way on when the mode has one and Google was the problem.
  const metered = state.status === 'error' && METER_CODES.includes(state.error?.code);
  const appleHref =
    metered && isGoogle && ['allowance', 'budget'].includes(state.error.code) && MODES[config.mode]?.providers?.includes('apple')
      ? `/geo/play?${configToParams({ ...config, provider: 'apple' }).toString()}`
      : null;
  useEffect(() => {
    if (!autoRetrying) return undefined;
    const id = setTimeout(() => dispatch({ type: 'retry' }), 400);
    return () => clearTimeout(id);
  }, [autoRetrying, state.attempt]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(id);
  }, [notice]);

  const submitGuess = useCallback(async (override, { timedOut = false } = {}) => {
    const s = stateRef.current;
    if (s.status !== 'playing' || !s.current?.token) return;
    let guess;
    if (override !== undefined) guess = override;
    else if (s.config.mode === 'streak') guess = s.pin?.countryCode ? { countryCode: s.pin.countryCode } : null;
    else guess = s.pin ? { lat: s.pin.lat, lng: s.pin.lng } : null;
    if (!guess && !timedOut) return;
    dispatch({ type: 'submit_start' });
    try {
      const res = await fetch('/api/geo/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ token: s.current.token, guess }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not score the guess');
      if (data.challenge) setChallenge(data.challenge);
      if (data.points) setPointsByRound((prev) => ({ ...prev, [s.roundIndex]: data.points }));
      dispatch({ type: 'submit_success', result: { ...data.result, timedOut: timedOut || !guess, roundIndex: s.roundIndex } });
      setMobileMapOpen(false);
    } catch (error) {
      dispatch({ type: 'submit_error', error: { message: error.message } });
    }
  }, []);

  const next = useCallback(() => dispatch({ type: 'next' }), []);

  // The round timer.
  useEffect(() => {
    if (state.status !== 'playing' || !config.time || !state.roundStartedAt) return undefined;
    const startedAt = state.roundStartedAt;
    const tick = () => {
      const left = config.time - (Date.now() - startedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(left)));
      if (left <= 0 && timerFiredRef.current !== startedAt) {
        timerFiredRef.current = startedAt;
        submitGuess(undefined, { timedOut: true });
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state.status, state.roundStartedAt, config.time, submitGuess]);

  // Record the finished game once.
  useEffect(() => {
    if (state.status !== 'summary' || recordedRef.current) return;
    recordedRef.current = true;
    const summary = buildSummary(state);
    const code = encodeShare(summary);
    const best = bestFor(state.config);
    recordGame(summary, code);
    setShare({ summary, code, best });
  }, [state]);

  // The daily's board, once today's five are in (docs/GEO.md).
  useEffect(() => {
    if (state.status !== 'summary' || config.mode !== 'daily') return undefined;
    let alive = true;
    fetch('/api/geo/daily', { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('daily'))))
      .then((data) => alive && setDaily(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [state.status, config.mode, challenge]);

  // Keyboard: Space/Enter guess or continue, R return to start, M map size, Esc closes the sheet.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const s = stateRef.current;
      if (event.key === ' ' || event.key === 'Enter') {
        if (s.status === 'playing' && s.pin) {
          event.preventDefault();
          submitGuess();
        } else if (s.status === 'result') {
          event.preventDefault();
          next();
        }
      } else if (event.key === 'r' || event.key === 'R') {
        paneRef.current?.returnToStart?.();
      } else if (event.key === 'm' || event.key === 'M') {
        setMapSize((size) => MAP_SIZES[(MAP_SIZES.indexOf(size) + 1) % MAP_SIZES.length]);
      } else if (event.key === 'Escape') {
        setMobileMapOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitGuess, next]);

  const countryName = useCallback(
    (code) => {
      if (!code) return '';
      const row = server?.countries?.find((c) => c.code === code);
      return row ? `${row.flag} ${row.name}` : code;
    },
    [server]
  );

  const regionLabel = config.mode === 'country' ? server?.countries?.find((c) => c.code === config.region)?.name : undefined;

  // What the map shows.
  const lastResult = state.rounds[state.rounds.length - 1];
  const mapMode = state.status === 'result' || state.status === 'summary' ? 'result' : 'guess';
  const mapResults = useMemo(() => {
    if (state.status === 'result' && lastResult) {
      return [{ guess: lastResult.guess, answer: lastResult.answer ? { lat: lastResult.answer.lat, lng: lastResult.answer.lng } : null, label: '' }];
    }
    if (state.status === 'summary') {
      return state.rounds.map((r, i) => ({ guess: r.guess, answer: r.answer ? { lat: r.answer.lat, lng: r.answer.lng } : null, label: String(i + 1) }));
    }
    return [];
  }, [state.status, state.rounds, lastResult]);

  const inRound = state.status === 'playing' || state.status === 'submitting';
  // Points this game earned so far, and the badges it found (docs/GEO.md).
  const gamePoints = useMemo(() => {
    const rounds = Object.values(pointsByRound);
    return {
      earned: rounds.reduce((sum, r) => sum + (r.earned || 0), 0),
      balance: rounds.length ? rounds[rounds.length - 1].balance : profile?.points || 0,
      badges: rounds.map((r) => r.badge).filter(Boolean),
      capped: rounds.some((r) => r.allowed === false),
    };
  }, [pointsByRound, profile]);
  const effectiveSize = mapHover && mapSize === 'small' ? 'medium' : mapSize;
  let mapClass;
  if (mapMode === 'result') {
    // flex-col so the map's flex-1 fills the frame; without it the map
    // collapses to zero height and the panorama shows through the border.
    mapClass = `absolute inset-x-2 top-16 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:top-20 ${state.status === 'summary' ? 'bottom-[63%] sm:bottom-[59%]' : 'bottom-[40%] sm:bottom-[30%]'}`;
  } else if (inRound && !isStreak) {
    mapClass = mobileMapOpen
      ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-midnight-900'
      : `hidden sm:flex absolute bottom-14 right-4 z-30 flex-col overflow-hidden rounded-2xl border border-white/10 bg-midnight-900 shadow-2xl transition-all duration-200 ${DESKTOP_SIZE[effectiveSize]}`;
  } else {
    mapClass = 'pointer-events-none absolute -left-[9999px] top-0 h-64 w-64 opacity-0';
  }

  const sdkReady = isGoogle ? Boolean(api) : Boolean(mapkit);
  const canZoom = config.zoom && isGoogle;
  const showLoading = state.status === 'loading' || state.status === 'locating' || (state.status === 'idle' && configured);
  const roundNumber = state.roundIndex + 1;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-midnight-950 text-white">
      {/* Imagery */}
      {sdkReady && isGoogle ? (
        <GoogleStreetViewPane
          ref={paneRef}
          api={api}
          panoId={state.current?.panoId || ''}
          heading={state.current?.heading || 0}
          allowMove={config.move}
          allowPan={config.pan}
          allowZoom={config.zoom}
          onHeading={setHeading}
        />
      ) : null}
      {sdkReady && !isGoogle && state.current?.candidates ? (
        <AppleLookAroundPane
          ref={paneRef}
          mapkit={mapkit}
          candidates={state.current.candidates}
          roundKey={state.roundIndex}
          allowMove={config.move}
          allowPan={config.pan}
          allowZoom={config.zoom}
          onAttempt={setAppleAttempt}
          onLocated={(index) => dispatch({ type: 'located', index })}
          onFailed={(error) => dispatch({ type: 'load_error', error: { message: error?.message || 'No Look Around imagery at any of the spots tried', code: 'no_imagery' } })}
        />
      ) : null}

      {/* Backdrop behind results */}
      {mapMode === 'result' ? <div className="absolute inset-0 z-20 bg-midnight-950/85" /> : null}

      {/* HUD */}
      {(inRound || mapMode === 'result') && state.status !== 'summary' ? (
        <GameHud
          config={config}
          roundNumber={roundNumber}
          roundsTotal={config.rounds}
          score={totalScore(state)}
          streak={streakLength(state)}
          secondsLeft={inRound ? secondsLeft : NaN}
          heading={isGoogle ? heading : 0}
          canZoom={canZoom && inRound}
          onReturn={() => paneRef.current?.returnToStart?.()}
          onZoom={(delta) => paneRef.current?.zoomBy?.(delta)}
          mapSize={mapSize}
          onMapSize={setMapSize}
          mobileMapOpen={mobileMapOpen}
          onToggleMobileMap={() => setMobileMapOpen((open) => !open)}
          notice={inRound ? notice : ''}
          showMapControls={inRound}
        />
      ) : null}

      {/* The one map, moved by class */}
      {sdkReady ? (
        <div className={mapClass} onMouseEnter={() => setMapHover(true)} onMouseLeave={() => setMapHover(false)}>
          <div className="min-h-0 flex-1">
            {isGoogle ? (
              <GoogleGuessMap api={api} pin={state.pin && !isStreak ? state.pin : null} onPin={(pin) => dispatch({ type: 'pin', pin })} results={mapResults} mode={mapMode} interactive={state.status === 'playing'} pinStyle={profile?.equipped?.pin || null} />
            ) : (
              <AppleGuessMap mapkit={mapkit} pin={state.pin && !isStreak ? state.pin : null} onPin={(pin) => dispatch({ type: 'pin', pin })} results={mapResults} mode={mapMode} interactive={state.status === 'playing'} />
            )}
          </div>
          {inRound && !isStreak ? (
            <button
              type="button"
              onClick={() => submitGuess()}
              disabled={!state.pin || state.status !== 'playing'}
              className="h-12 shrink-0 bg-flash-400 text-base font-bold text-midnight-900 transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:bg-midnight-800 disabled:text-white/50"
            >
              {state.status === 'submitting' ? 'Scoring' : state.pin ? 'Guess' : 'Place your pin on the map'}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Streak: the country picker instead of a map */}
      {inRound && isStreak ? (
        <div className={mobileMapOpen ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 rounded-t-2xl border-t border-white/10 bg-midnight-900/95 p-3 backdrop-blur' : 'absolute bottom-14 right-4 z-30 hidden h-[26rem] w-80 rounded-2xl border border-white/10 bg-midnight-900/90 p-3 shadow-2xl backdrop-blur sm:block'}>
          <CountryPicker countries={server?.countries || []} value={state.pin?.countryCode || ''} onChange={(code) => dispatch({ type: 'pin', pin: { countryCode: code } })} onSubmit={() => submitGuess()} disabled={state.status !== 'playing'} />
        </div>
      ) : null}

      {/* Round result */}
      {state.status === 'result' && lastResult ? (
        <RoundResult
          result={lastResult}
          roundNumber={roundNumber}
          roundsTotal={config.rounds}
          isLast={isFinished(state)}
          isStreak={isStreak}
          streak={streakLength(state)}
          countryName={countryName(lastResult.guessCountry)}
          points={pointsByRound[lastResult.roundIndex] || null}
          onNext={next}
        />
      ) : null}

      {/* Summary */}
      {state.status === 'summary' && share ? (
        <GameSummary
          summary={share.summary}
          code={share.code}
          config={config}
          regionLabel={regionLabel}
          best={share.best}
          daily={config.mode === 'daily' ? daily : null}
          points={gamePoints}
          onPlayAgain={() => {}}
        />
      ) : null}
      {state.status === 'summary' ? (
        <Link href="/geo" className="absolute right-4 top-4 z-50 rounded-full border border-white/20 bg-midnight-900/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-midnight-800">
          Leave
        </Link>
      ) : null}

      {/* Loading, setup and errors */}
      {showLoading && sdkReady ? (
        <LoadingSpot provider={config.provider} roundNumber={roundNumber} appleAttempt={appleAttempt} appleTotal={state.current?.candidates?.length || 0} />
      ) : null}
      {server && !configured ? (
        <Panel>
          <SetupNotice provider={config.provider} missing={providerInfo?.missing || []} />
        </Panel>
      ) : null}
      {!server && !serverError ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight-950 text-white/70">Loading</div>
      ) : null}
      {serverError ? <ErrorPanel title="The game cannot start" message={serverError} /> : null}
      {sdkError ? <ErrorPanel title={isGoogle ? 'Google Maps did not load' : 'Apple Look Around did not load'} message={sdkError} /> : null}
      {configured && !sdkReady && !sdkError && server ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight-950 text-white/70">Loading {isGoogle ? 'Street View' : 'Look Around'}</div>
      ) : null}
      {state.status === 'error' && !autoRetrying ? (
        <ErrorPanel
          title={metered ? refusalTitle(state.error.code) : state.error?.code === 'no_imagery' ? 'No imagery found' : 'Could not start the round'}
          message={state.error?.message || 'Something went wrong.'}
          stats={state.error?.stats}
          onRetry={metered && state.error.code !== 'speed' ? null : () => dispatch({ type: 'retry' })}
          appleHref={appleHref}
          resetAt={metered && state.error.code === 'allowance' ? state.error.resetAt : null}
        />
      ) : null}
      {state.status === 'playing' && state.error ? (
        <div className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg">
          {state.error.message} <button type="button" className="ml-2 underline" onClick={() => submitGuess(undefined, { timedOut: true })}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}
