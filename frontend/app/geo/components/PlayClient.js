'use client';

/**
 * The game. Reads the settings from the URL, asks the server for a
 * round, shows the imagery, takes the guess, shows the result, repeats,
 * then records and offers the share links.
 *
 * Immersive route: no site chrome; the X in the top-right is the way out.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Card from './ui/Card';
import './round.css';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { MODES, configFromParams, configToParams, isChallengeMode } from '@/app/lib/geo/modes';
import { METER_CODES, refusalTitle, untilText } from '@/app/lib/geo/meter';
import { encodeShare } from '@/app/lib/geo/share';
import { reducer, createInitialState, isFinished, totalScore, streakLength, buildSummary } from '../lib/gameState';
import { ensureLookAround } from '../lib/lookAround';
import { mapKitAuth, mapKitRefusalMessage, onMapKitAuth } from '../lib/appleMapKit';
import { recordGame, bestFor } from '../lib/storage';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { loadName } from '../lib/useRoom';
import { configErrorMessage, loadGeoConfig } from '../lib/serverConfig';
import AppleLookAroundPane from './AppleLookAroundPane';
import AppleGuessMap from './AppleGuessMap';
import NotEarthPane from './NotEarthPane';
import NotEarthButton from './NotEarthButton';
import GameHud from './GameHud';
import CountryPicker from './CountryPicker';
import LoadingSpot from './LoadingSpot';
import RoundResult from './RoundResult';
import GameSummary from './GameSummary';
import SetupNotice from './SetupNotice';
import { useSavedGame } from '../lib/savedGame';
import { ignoreGameShortcut } from '../lib/mapKeyboard';
import { useOpenFrom, usePresence } from '../lib/motion';

const MAP_SIZES = ['small', 'medium', 'large'];
const DESKTOP_SIZE = {
  small: 'sm:w-72 sm:h-56',
  medium: 'sm:w-[30rem] sm:h-80',
  large: 'sm:w-[44rem] sm:h-[32rem]',
};

function Panel({ children }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-950/95 p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function ErrorPanel({ title, message, onRetry, retrying, resetAt }) {
  return (
    <Panel>
      <Card tone="panel" className="bg-ocean-900 text-white">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-clay-300" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-white/80">{message}</p>
            {resetAt ? <p className="mt-1 text-sm text-white/60">Rounds come back {untilText(resetAt)}.</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} disabled={retrying} className="flex items-center gap-2 rounded-xl bg-clay-400 px-4 py-2 text-sm font-bold text-ocean-950 hover:bg-clay-300 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Trying again' : 'Try again'}
            </button>
          ) : null}
          <Link href="/geo" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
            Back to Probably Earth
          </Link>
        </div>
      </Card>
    </Panel>
  );
}

export default function PlayClient() {
  const params = useSearchParams();
  return <StreetPlayGame key={params.toString()} params={params} />;
}

function StreetPlayGame({ params }) {
  const config = useMemo(() => configFromParams(params), [params]);
  const [state, dispatch] = useReducer(reducer, config, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [server, setServer] = useState(null);
  const [serverError, setServerError] = useState('');
  const [mapkit, setMapkit] = useState(null);
  const [sdkError, setSdkError] = useState('');
  const [heading, setHeading] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(config.time);
  const [mapSize, setMapSize] = useState('small');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [appleAttempt, setAppleAttempt] = useState(0);
  const [share, setShare] = useState(null);
  const [challenge, setChallenge] = useState(null);
  // What the last round of a ranked set did to the solo rating.
  const [rated, setRated] = useState(null);
  const [daily, setDaily] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileSettled, setProfileSettled] = useState(false);
  const paneRef = useRef(null);
  // The map's frame, which the reveal opens out of (lib/motion.js).
  const mapFrameRef = useRef(null);
  const requestRef = useRef(0);
  const recordedRef = useRef(false);
  const timerFiredRef = useRef(null);

  const isStreak = config.mode === 'streak';
  // A Not Earth round is a NASA panorama and no coordinates at all
  // (app/lib/geo/notEarth.js). The guess map stays exactly where it
  // always is: a round that hid its own map would announce itself.
  const notEarth = state.current?.place || null;
  const configured = Boolean(server?.providers?.apple?.configured);
  const playthrough = params.get('replay');
  const resumeUrl = `/geo/play?${configToParams(config)}${playthrough ? `&replay=${encodeURIComponent(playthrough)}` : ''}&resume=1`;
  const { ready: saveReady, saveError } = useSavedGame({
    kind: 'street', url: resumeUrl, snapshot: state,
    enabled: state.status === 'result' || state.status === 'summary',
    resume: true,
    restore: (snapshot) => dispatch({ type: 'restore', snapshot }),
  });

  // A new link is a new game.
  useEffect(() => {
    dispatch({ type: 'restart', config });
    recordedRef.current = false;
    setShare(null);
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
      .catch(() => {})
      .finally(() => alive && setProfileSettled(true));
    return () => {
      alive = false;
    };
  }, []);

  // Server settings: which provider is set up, the browser key, the countries.
  useEffect(() => {
    let alive = true;
    loadGeoConfig({ shouldStop: () => !alive })
      .then((data) => alive && data && setServer(data))
      .catch((error) => alive && setServerError(configErrorMessage(error)));
    return () => {
      alive = false;
    };
  }, []);

  // The imagery SDK.
  useEffect(() => {
    if (!server || !configured) return undefined;
    let alive = true;
    ensureLookAround()
      .then((loaded) => alive && setMapkit(loaded))
      .catch((error) => alive && setSdkError(error?.message || 'MapKit JS failed to load'));
    return () => {
      alive = false;
    };
  }, [server, configured]);

  // A refused token, which used to be silent. MapKit does not reject
  // one: it loads, the pane is built, and nothing is ever drawn in it.
  // A token is refused when its origin claim does not match the host
  // the page is served from, which is how Apple Maps went dark on www
  // while the apex worked (app/geo/lib/appleMapKit.js).
  useEffect(() => {
    const settle = (state) => {
      if (state === 'failed') setSdkError(mapKitRefusalMessage());
    };
    settle(mapKitAuth());
    return onMapKitAuth(settle);
  }, []);

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
        error.resetAt = data.resetAt || null;
        throw error;
      }
      dispatch({ type: 'load_success', round: data.round });
    } catch (error) {
      if (id !== requestRef.current) return;
      dispatch({ type: 'load_error', error: { message: error.message, code: error.code, resetAt: error.resetAt || null } });
    }
  }, []);

  // A challenge is scored on a board, so the server plays it as
  // somebody: wait for this browser's profile before asking for the
  // first round, rather than racing it and being refused. The list is
  // shared with the guess route (app/lib/geo/modes.js); written out
  // here it said daily and cup, while the server also meant ranked, so
  // a ranked round opened from anywhere that had not already made a
  // profile was handed over and then refused a score.
  const needsProfile = isChallengeMode(config.mode);
  useEffect(() => {
    if (!saveReady || !configured || sdkError || state.status !== 'idle') return;
    if (needsProfile && !profileSettled) return;
    startRound();
  }, [saveReady, configured, sdkError, state.status, state.roundIndex, state.attempt, startRound, needsProfile, profileSettled]);

  // "No imagery" twice in a row is bad luck; a third time we say so.
  // An unresponsive provider is not bad luck and is never retried: it
  // already went silent on every spot in the round, and retrying is how
  // one dead round became five minutes of a loading label.
  const autoRetrying = state.status === 'error' && state.error?.code === 'no_imagery' && state.attempt < 2;

  // The play meter said no (docs/GEO.md, "The play meter"). There is
  // no other imagery to send them to now, so a refusal is the end of
  // the round rather than a fork.
  const metered = state.status === 'error' && METER_CODES.includes(state.error?.code);
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

  /**
   * `allowEmpty` lets the clock (and the retry after a failed send) submit a
   * round with no pin. It does NOT decide how the round is labelled: the
   * server already answers timedOut for a pin round, and stamping it here
   * marked a guess that was placed, sent and scored as "time ran out".
   */
  const submitGuess = useCallback(async (override, { allowEmpty = false } = {}) => {
    const s = stateRef.current;
    if (s.status !== 'playing' || !s.current?.token) return;
    let guess;
    if (override !== undefined) guess = override;
    else if (s.config.mode === 'streak') guess = s.pin?.countryCode ? { countryCode: s.pin.countryCode } : null;
    else guess = s.pin ? { lat: s.pin.lat, lng: s.pin.lng } : null;
    if (!guess && !allowEmpty) return;
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
      if (data.rated) setRated(data.rated);
      dispatch({ type: 'submit_success', result: { ...data.result, points: data.points || null, timedOut: data.result?.timedOut ?? !guess, roundIndex: s.roundIndex } });
      setMobileMapOpen(false);
    } catch (error) {
      dispatch({ type: 'submit_error', error: { message: error.message } });
    }
  }, []);

  const next = useCallback(() => dispatch({ type: 'next' }), []);

  /** The Not Earth button, on every round. */
  const callNotEarth = useCallback(() => submitGuess({ notEarth: true }), [submitGuess]);

  // The round timer.
  useEffect(() => {
    if (state.status !== 'playing' || !config.time || !state.roundStartedAt) return undefined;
    const startedAt = state.roundStartedAt;
    const tick = () => {
      const left = config.time - (Date.now() - startedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(left)));
      if (left <= 0 && timerFiredRef.current !== startedAt) {
        timerFiredRef.current = startedAt;
        submitGuess(undefined, { allowEmpty: true });
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

  // The shared board, once the daily's five or the cup's ten are in (docs/GEO.md).
  useEffect(() => {
    if (state.status !== 'summary' || (config.mode !== 'daily' && config.mode !== 'cup')) return undefined;
    let alive = true;
    fetch(config.mode === 'cup' ? '/api/geo/cup' : '/api/geo/daily', { headers: profileHeaders(), cache: 'no-store' })
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
      if (ignoreGameShortcut(event)) return;
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
        // Same rule as the button: a format with one view has no start
        // to return to. The old guard named a mode ('kidnapped') the
        // game has not had for months, so it never stopped anything.
        if (s.config.pan || s.config.move) paneRef.current?.returnToStart?.();
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
  // The reveal frame opens out of the card the guess was made on. It
  // used to snap: the card is anchored bottom-right and the frame spans
  // the top, and `left: auto` does not interpolate, so the transition
  // round.css declared for it could never run.
  useOpenFrom(mapFrameRef, mapMode === 'result');
  const mapResults = useMemo(() => {
    // A Not Earth round has no answer on this map, so it plots none.
    const answerOf = (r) => (Number.isFinite(r?.answer?.lat) && Number.isFinite(r?.answer?.lng) ? { lat: r.answer.lat, lng: r.answer.lng } : null);
    if (state.status === 'result' && lastResult) {
      return [{ guess: lastResult.guess, answer: answerOf(lastResult), label: '' }];
    }
    if (state.status === 'summary') {
      return state.rounds.map((r, i) => ({ guess: r.guess, answer: answerOf(r), label: String(i + 1) }));
    }
    return [];
  }, [state.status, state.rounds, lastResult]);

  const inRound = state.status === 'playing' || state.status === 'submitting';
  // Points this game earned so far, and the badges it found (docs/GEO.md).
  const gamePoints = useMemo(() => {
    const rounds = state.rounds.map((round) => round.points).filter(Boolean);
    return {
      earned: rounds.reduce((sum, r) => sum + (r.earned || 0), 0),
      balance: rounds.length ? rounds[rounds.length - 1].balance : profile?.points || 0,
      badges: rounds.map((r) => r.badge).filter(Boolean),
      capped: rounds.some((r) => r.allowed === false),
    };
  }, [state.rounds, profile]);
  // Hover expansion moved the Guess button before the player's click landed.
  // Keep the chosen size stable; S/M/L and the keyboard shortcut resize it.
  const effectiveSize = mapSize;
  // A Not Earth round has no answer to plot, so its reveal keeps the
  // picture on screen instead of a map with one pin and nothing to
  // compare it to.
  const notEarthResult = state.status === 'result' && lastResult?.kind === 'not-earth';
  let mapClass;
  if (notEarthResult) {
    mapClass = 'invisible pointer-events-none absolute -left-[9999px] top-0 flex h-64 w-64 flex-col';
  } else if (mapMode === 'result') {
    // flex-col so the map's flex-1 fills the frame; without it the map
    // collapses to zero height and the panorama shows through the border.
    // geo-map-frame: the desktop card already eased between its three
    // sizes and this one snapped, so the same element moved smoothly
    // one way and jumped the other.
    mapClass = `geo-map-frame absolute inset-x-2 top-16 z-30 flex flex-col overflow-hidden rounded-2xl border border-ocean-400/30 bg-ocean-900 shadow-2xl sm:top-24 ${state.status === 'summary' ? 'geo-map-frame--summary bottom-[63%] sm:bottom-[59%]' : 'bottom-[40%] sm:bottom-[30%]'}`;
  } else if (inRound && !isStreak) {
    mapClass = mobileMapOpen
      ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-ocean-900'
      // Keep a real size while the mobile drawer is closed. display:none
      // makes MapKit's renderer resize to zero and can leave its tiles blank.
      : `invisible pointer-events-none absolute -left-[9999px] top-0 z-30 flex h-56 w-72 flex-col overflow-hidden rounded-2xl border border-ocean-400/30 bg-ocean-900 shadow-2xl transition-all duration-200 sm:visible sm:pointer-events-auto sm:left-auto sm:top-auto sm:bottom-14 sm:right-4 ${DESKTOP_SIZE[effectiveSize]}`;
  } else {
    mapClass = 'invisible pointer-events-none absolute -left-[9999px] top-0 flex h-64 w-64 flex-col';
  }

  const sdkReady = Boolean(mapkit);
  // Look Around zooms by pinch and wheel only, so there is nothing for
  // a button to do there. A Not Earth panorama is ours, and it zooms.
  const canZoom = config.zoom && Boolean(notEarth);
  // Nothing to go back to when the view cannot leave where it started.
  // The button was always drawn, so NMPZ shipped a "return to start"
  // above a line that says you get one view.
  const canReturn = config.pan || config.move;
  const showLoading = state.status === 'loading' || state.status === 'locating' || (state.status === 'idle' && configured);
  const curtain = usePresence(showLoading && sdkReady);
  const roundNumber = state.roundIndex + 1;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-ocean-950 text-white">
      {saveError ? <p role="status" className="absolute left-4 top-20 z-[70] max-w-sm rounded-lg bg-ocean-900 p-3 text-sm">{saveError}</p> : null}
      {/* Imagery */}
      {notEarth ? (
        <NotEarthPane ref={paneRef} place={notEarth} roundKey={state.roundIndex} allowPan={config.pan} allowZoom={config.zoom} />
      ) : null}
      {sdkReady && state.current?.candidates ? (
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
          onFailed={(error) => {
            if (stateRef.current.status !== 'locating') return;
            dispatch({
              type: 'load_error',
              error: {
                message: error?.message || 'No Look Around imagery at any of the spots tried',
                // 'unresponsive' means the service never answered, so a
                // retry asks the same silent thing again. Only a real
                // "nothing here" is worth another draw.
                code: error?.kind === 'unresponsive' ? 'imagery_unresponsive' : 'no_imagery',
              },
            });
          }}
        />
      ) : null}

      {/* Backdrop behind results. Lighter over a Not Earth reveal, which
          has the place itself behind it rather than a map. */}
      {mapMode === 'result' ? <div className={`pe-fade-in absolute inset-0 z-20 ${notEarthResult ? 'bg-ocean-950/45' : 'bg-ocean-950/85'}`} /> : null}

      {/* HUD */}
      {(inRound || mapMode === 'result') && state.status !== 'summary' ? (
        <GameHud
          config={config}
          roundNumber={roundNumber}
          roundsTotal={config.rounds}
          score={totalScore(state)}
          streak={streakLength(state)}
          secondsLeft={inRound ? secondsLeft : NaN}
          heading={heading}
          canZoom={canZoom && inRound}
          canReturn={canReturn}
          canPan={config.pan}
          regionLabel={regionLabel}
          onReturn={() => paneRef.current?.returnToStart?.()}
          onZoom={(delta) => paneRef.current?.zoomBy?.(delta)}
          mobileMapOpen={mobileMapOpen}
          onToggleMobileMap={() => setMobileMapOpen((open) => !open)}
          notice={inRound ? notice : ''}
          showMapControls={inRound}
          saveUrl={state.rounds.length > 0 ? resumeUrl : null}
        />
      ) : null}

      {/* The one map, moved by class */}
      {sdkReady ? (
        <div ref={mapFrameRef} className={mapClass}>
          <div className="relative min-h-0 flex-1">
            <AppleGuessMap mapkit={mapkit} pin={state.pin && !isStreak ? state.pin : null} onPin={(pin) => dispatch({ type: 'pin', pin })} results={mapResults} mode={mapMode} interactive={state.status === 'playing'} />
            {/* On the card, next to what they change. Under the score
                they read as part of it. */}
            {inRound && !isStreak ? (
              <div className="absolute right-2 top-2 z-10 hidden items-center gap-1 sm:flex">
                {MAP_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setMapSize(size)}
                    className={`h-7 w-7 rounded-full border text-xs font-semibold shadow backdrop-blur transition ${mapSize === size ? 'border-clay-500 bg-clay-400 text-ocean-950' : 'border-white/20 bg-ocean-900/85 text-white/80 hover:bg-ocean-800'}`}
                    aria-pressed={mapSize === size}
                    title={`${size} map (M cycles)`}
                  >
                    {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {/* The card's own footer: what to do on the left, the one
              thing to press on the right. The instruction used to BE
              the button's label, which made the only call to action on
              the screen change its words under the cursor. */}
          {inRound && !isStreak ? (
            <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-ocean-900 px-4 py-3">
              {/* The smallest card is a peek, and two lines of hint
                  there squeeze the only button on it. */}
              <p className={`min-w-0 flex-1 text-xs leading-snug text-sand-300/80 ${effectiveSize === 'small' ? 'hidden' : ''}`}>
                {state.pin ? 'Space or Enter guesses too.' : 'Tap the map to drop your pin.'}
              </p>
              <button
                type="button"
                onClick={() => submitGuess()}
                disabled={!state.pin || state.status !== 'playing'}
                data-geo-guess
                className={`rounded-full bg-clay-400 px-8 py-2.5 text-sm font-bold text-ocean-950 transition hover:bg-clay-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-ocean-800 disabled:text-sand-300 ${effectiveSize === 'small' ? 'w-full' : 'shrink-0'}`}
              >
                {state.status === 'submitting' ? 'Scoring' : 'Guess'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Streak: the country picker instead of a map */}
      {inRound && isStreak ? (
        <div className={mobileMapOpen ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 rounded-t-2xl border-t border-white/10 bg-ocean-900/95 p-3 backdrop-blur' : 'absolute bottom-14 right-4 z-30 hidden h-[26rem] w-80 rounded-2xl border border-white/10 bg-ocean-900/90 p-3 shadow-2xl backdrop-blur sm:block'}>
          <CountryPicker countries={server?.countries || []} provider={config.provider} value={state.pin?.countryCode || ''} onChange={(code) => dispatch({ type: 'pin', pin: { countryCode: code } })} onSubmit={() => submitGuess()} disabled={state.status !== 'playing'} />
        </div>
      ) : null}

      {/* The Not Earth button, on every round */}
      {inRound ? (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 justify-center">
          <NotEarthButton onCall={callNotEarth} disabled={state.status !== 'playing'} roundKey={state.roundIndex} />
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
          points={lastResult.points || null}
          onNext={next}
        />
      ) : null}

      {/* Summary */}
      {state.status === 'summary' && share ? (
        <GameSummary
          summary={share.summary}
          resumeUrl={resumeUrl}
          code={share.code}
          config={config}
          regionLabel={regionLabel}
          best={share.best}
          /* Not isChallengeMode: a finished daily or cup shows the board
             it was played against, and a finished ranked set shows the
             rating it moved instead. Different question, different two
             modes. */
          daily={config.mode === 'daily' || config.mode === 'cup' ? daily : null}
          rated={rated}
          points={gamePoints}
          onPlayAgain={() => {}}
        />
      ) : null}
      {state.status === 'summary' ? (
        <Link href="/geo" className="absolute right-4 top-4 z-50 rounded-full border border-white/20 bg-ocean-900/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-ocean-800">
          Leave
        </Link>
      ) : null}

      {/* Loading, setup and errors */}
      {curtain.mounted ? (
        /* The key restarts the "taking too long" clock for each new
           round and each retry, rather than letting it run from the
           first one. It fades out over the panorama once the spot is
           found, instead of vanishing and letting the picture pop in. */
        <LoadingSpot
          key={`${state.roundIndex}:${state.attempt}`}
          roundNumber={roundNumber}
          appleAttempt={appleAttempt}
          appleTotal={state.current?.candidates?.length || 0}
          leaving={curtain.leaving}
        />
      ) : null}
      {server && !configured ? (
        <Panel>
          <SetupNotice provider="apple" missing={server?.providers?.apple?.missing || []} />
        </Panel>
      ) : null}
      {!server && !serverError ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-950 text-white/70">Loading</div>
      ) : null}
      {serverError ? <ErrorPanel title="The game cannot start" message={serverError} /> : null}
      {sdkError ? <ErrorPanel title="Apple Look Around did not load" message={sdkError} /> : null}
      {configured && !sdkReady && !sdkError && server ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-950 text-white/70">Loading Look Around</div>
      ) : null}
      {state.status === 'error' && !autoRetrying && !sdkError && !serverError ? (
        <ErrorPanel
          title={
            metered
              ? refusalTitle(state.error.code)
              : state.error?.code === 'imagery_unresponsive'
                ? 'Look Around is not answering'
                : state.error?.code === 'no_imagery'
                  ? 'No imagery found'
                  : 'Could not start the round'
          }
          message={state.error?.message || 'Something went wrong.'}
          onRetry={metered && state.error.code !== 'speed' ? null : () => dispatch({ type: 'retry' })}
          resetAt={metered ? state.error.resetAt : null}
        />
      ) : null}
      {state.status === 'playing' && state.error ? (
        <div className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg">
          {state.error.message} <button type="button" className="ml-2 underline" onClick={() => submitGuess(undefined, { allowEmpty: true })}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}
