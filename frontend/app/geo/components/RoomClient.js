'use client';

/**
 * A multiplayer room, start to finish: join, wait in the lobby, play
 * each round on the shared clock, see everyone's pins at the reveal,
 * then the standings and a rematch. State comes from the poll in
 * useRoom; the imagery and the map are the solo game's components.
 *
 * Immersive route: no site chrome; the X in the HUD leads to /geo/rooms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ScriptSample from './script/ScriptSample';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, RotateCcw, X, Map as MapIcon } from 'lucide-react';
import { DEFAULT_PLAYER_NAME, initials } from '@/app/lib/geo/rooms';
import { useRoom, useNow, loadName, saveIdentity } from '../lib/useRoom';
import { ensureProfile } from '../lib/profile';
import AppleLookAroundPane from './AppleLookAroundPane';
import AppleGuessMap from './AppleGuessMap';
import { ensureLookAround } from '../lib/lookAround';
import { useOpenFrom } from '../lib/motion';
import { mapKitAuth, mapKitRefusalMessage, onMapKitAuth } from '../lib/appleMapKit';
import { configErrorMessage, loadGeoConfig } from '../lib/serverConfig';
import MatchHud from './rooms/MatchHud';
import './round.css';
import SetupNotice from './SetupNotice';
import AccountDialog from './AccountDialog';
import { ignoreGameShortcut } from '../lib/mapKeyboard';
import { JoinPanel, LobbyPanel, LoadingPanel, Panel, ReactionToasts, ReactionsBar, RevealPanel, StandingsPanel, LocatingPanel } from './rooms/RoomPanels';

const MAP_SIZES = ['small', 'medium', 'large'];
const ScriptMap = dynamic(() => import('./script/LeafletScriptMap'), { ssr: false });
const DESKTOP_SIZE = {
  small: 'sm:w-72 sm:h-56',
  medium: 'sm:w-[30rem] sm:h-80',
  large: 'sm:w-[44rem] sm:h-[32rem]',
};
const pill = 'rounded-full border border-white/15 bg-pe-canvas/75 shadow-lg backdrop-blur';
// One empty result list for every render that has none, so the map is
// never handed a "new" one (see mapResults).
const NO_RESULTS = [];

/**
 * The same object for as long as `key` is the same. Each poll of the
 * room is a new state object, and a map that is handed a new answer
 * draws and frames it again.
 */
function useKeyed(value, key) {
  const ref = useRef({ key: null, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-pe-fg transition hover:bg-pe-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-pe-accent-fg disabled:opacity-40`;

function MessagePanel({ title, message, children }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-pe-warm" />
        <div>
          <h2 className="ui-h2">{title}</h2>
          <p className="mt-1 text-sm text-pe-muted">{message}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {children}
        <Link href="/geo/rooms" className="ui-btn ui-btn--secondary">
          Back to Multiplayer
        </Link>
      </div>
    </Panel>
  );
}

export default function RoomClient({ code }) {
  const params = useSearchParams();
  const presetName = params.get('name') || '';
  const { state, error, identity, ready, refresh, act, join, serverNow } = useRoom(code);
  useNow(250);

  const [server, setServer] = useState(null);
  const [mapkit, setMapkit] = useState(null);
  const [locateAttempt, setLocateAttempt] = useState(0);
  const [sdkError, setSdkError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pin, setPin] = useState(null);
  const [mapSize, setMapSize] = useState('small');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [defaultName, setDefaultName] = useState('');
  const [accountGate, setAccountGate] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const pendingJoinRef = useRef('');
  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const response = await fetch('/api/geo/auth/me', { cache: 'no-store' });
        if (!response.ok) return;
        const account = await response.json();
        if (!live) return;
        setSignedIn(Boolean(account.signedIn));
        if (account.signedIn) {
          const profile = await ensureProfile('').catch(() => null);
          if (live && profile?.name) setDefaultName(profile.name);
        }
      } catch { /* Room polling displays connection failures and retries. */ }
    };
    check();
    window.addEventListener('geo:session-changed', check);
    window.addEventListener('focus', check);
    return () => { live = false; window.removeEventListener('geo:session-changed', check); window.removeEventListener('focus', check); };
  }, []);
  const paneRef = useRef(null);
  const mapFrameRef = useRef(null);
  const lastRoundRef = useRef(null);
  const myLocateRef = useRef(null);
  const candidatesCacheRef = useRef({ key: '', value: null });
  const autoJoinedRef = useRef(false);
  const zeroRef = useRef('');
  const liveRef = useRef({ pin: null, busy: false, phase: '' });

  const room = state?.room;
  const phase = room?.phase || '';
  const status = room?.status || '';
  const me = state?.me || null;
  const isScript = room?.config?.game === 'script';
  // Every room is on Look Around; the provider on a room's config is
  // normalized to apple before it is stored (app/lib/geo/modes.js).
  const imageryConfigured = isScript || Boolean(server?.providers?.apple?.configured);
  if (state?.round) lastRoundRef.current = state.round;
  const shownRound = state?.round || lastRoundRef.current;
  const locating = state?.locating || null;

  // Apple rooms: the places the pane tries. Kept the same array across
  // polls (and, for the browser that found the place, across the change
  // to guessing), so the pane does not restart its search every poll.
  let appleCandidates = null;
  {
    let key = '';
    let fresh = null;
    if (phase === 'locating' && locating) {
      key = `locating:${locating.index}:${JSON.stringify(locating.candidates)}`;
      fresh = locating.candidates || [];
    } else if ((phase === 'guessing' || phase === 'reveal') && shownRound?.coordinate) {
      const mine = myLocateRef.current;
      if (mine && mine.index === shownRound.index && mine.candidates) {
        key = mine.key;
        fresh = mine.candidates;
      } else {
        key = `placed:${shownRound.index}:${shownRound.coordinate.lat},${shownRound.coordinate.lng}`;
        fresh = [shownRound.coordinate];
      }
    }
    if (key && candidatesCacheRef.current.key !== key) candidatesCacheRef.current = { key, value: fresh };
    appleCandidates = key ? candidatesCacheRef.current.value : null;
  }
  liveRef.current = { pin, busy, phase };

  useEffect(() => {
    setDefaultName(presetName || loadName());
  }, [presetName]);

  useEffect(() => {
    let alive = true;
    loadGeoConfig({ shouldStop: () => !alive })
      .then((data) => alive && data && setServer(data))
      .catch((error) => alive && setSdkError(configErrorMessage(error)));
    return () => {
      alive = false;
    };
  }, []);

  // The imagery SDK, once a game is on.
  useEffect(() => {
    if (status !== 'playing' || isScript) return undefined;
    let alive = true;
    ensureLookAround()
      .then((loaded) => alive && setMapkit(loaded))
      .catch((e) => alive && setSdkError(e?.message || 'MapKit JS failed to load'));
    return () => {
      alive = false;
    };
  }, [status, isScript]);

  // A refused token, which used to be silent. MapKit does not reject
  // one: it loads, the pane is built, and nothing is ever drawn in it.
  // A token is refused when its origin claim does not match the host
  // the page is served from, which is how Apple Maps went dark on www
  // while the apex worked (app/geo/lib/appleMapKit.js).
  useEffect(() => {
    if (isScript) return undefined;
    const settle = (state) => {
      if (state === 'failed') setSdkError(mapKitRefusalMessage());
    };
    settle(mapKitAuth());
    return onMapKitAuth(settle);
  }, [isScript]);


  // Resume the requested join after signup, or follow a rematch link. The
  // account's name wins; a query parameter must never rename its profile.
  useEffect(() => {
    const requestedName = pendingJoinRef.current || presetName;
    // Local storage may still hold another account's token after sign-out.
    // Only the server's account-bound seat proves that this player has joined.
    if (!signedIn || !ready || !state || state.me || !requestedName || autoJoinedRef.current) return;
    if (state.room.status === 'finished') return;
    autoJoinedRef.current = true;
    ensureProfile('')
      .catch(() => null)
      .then((profile) => join(profile?.name || requestedName))
      .catch((e) => setActionError(e.message));
  }, [ready, state, presetName, join, signedIn]);

  // A new round or phase clears the local guess.
  const roundIndex = state?.round?.index;
  useEffect(() => {
    setPin(null);
    setMobileMapOpen(false);
    setActionError('');
  }, [roundIndex, phase]);

  // Countdowns on the server's clock.
  const secondsLeft = phase === 'guessing' && state?.round?.deadline ? Math.max(0, Math.ceil((state.round.deadline - serverNow()) / 1000)) : null;
  const revealLeft = phase === 'reveal' && room?.phaseEndsAt ? Math.max(0, Math.ceil((room.phaseEndsAt - serverNow()) / 1000)) : null;
  useEffect(() => {
    const atZero = secondsLeft === 0 || revealLeft === 0;
    const key = `${phase}:${roundIndex}:${room?.version}`;
    if (!atZero || zeroRef.current === key) return undefined;
    zeroRef.current = key;
    const t = setTimeout(() => refresh().catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [secondsLeft, revealLeft, phase, roundIndex, room?.version, refresh]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e?.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  }, []);

  const submitGuess = useCallback(() => {
    const live = liveRef.current;
    if (!live.pin || live.busy || live.phase !== 'guessing') return;
    run(() => act('guess', live.pin));
  }, [run, act]);

  const onLeave = useCallback(() => {
    run(async () => {
      await act('leave').catch(() => {});
      window.location.href = '/geo/rooms';
    });
  }, [run, act]);

  const onRematch = useCallback(() => {
    run(async () => {
      const res = await act('rematch');
      const next = res?.rematch;
      if (!next?.code) throw new Error('No rematch room came back');
      if (next.token) saveIdentity(next.code, { token: next.token, playerId: next.playerId, name: state?.me?.name || '' });
      window.location.href = `/geo/room/${next.code}`;
    });
  }, [run, act, state?.me?.name]);

  // Keyboard: Space/Enter guess, R return to start, M map size, Esc closes the sheet.
  useEffect(() => {
    const onKey = (event) => {
      if (ignoreGameShortcut(event)) return;
      if (event.key === ' ' || event.key === 'Enter') {
        if (liveRef.current.phase === 'guessing' && liveRef.current.pin) {
          event.preventDefault();
          submitGuess();
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
  }, [submitGuess]);

  // Everyone's pins at the reveal.
  // The map redraws whenever this is a new array: in guess mode it goes
  // back to the whole world, and in the reveal the line plays again. The
  // room is polled every few seconds and every poll is a new state
  // object, so keyed on `state` this was a new array every poll: a
  // player who had zoomed in to place a pin was thrown back out to the
  // world every three seconds, and the reveal's line replayed. It is
  // keyed on what it shows instead.
  const revealKey = phase === 'reveal' && state?.reveal
    ? JSON.stringify([
        room?.roundIndex,
        state.reveal.answer,
        state.reveal.guesses,
        (state.players || []).map((p) => [p.id, p.name, p.color, p.cosmetics?.pin || null]),
      ])
    : '';
  const mapResults = useMemo(() => {
    const reveal = state?.reveal;
    if (!reveal || phase !== 'reveal') return NO_RESULTS;
    const byId = Object.fromEntries((state.players || []).map((p) => [p.id, p]));
    const answer = { lat: reveal.answer.lat, lng: reveal.answer.lng };
    const items = reveal.guesses
      .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng))
      .map((g, i) => {
        const p = byId[g.playerId];
        return { guess: { lat: g.lat, lng: g.lng }, answer, label: initials(p?.name || '?'), color: p?.color || '#facc15', pin: p?.cosmetics?.pin || null, title: p?.name || 'Guess', answerMarker: i === 0, answerLabel: '★', answerTitle: 'The place' };
      });
    if (!items.length) items.push({ answer, answerMarker: true, answerLabel: '★', answerTitle: 'The place' });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  const rawAnswer = state?.reveal?.scriptAnswer;
  const scriptAnswer = useKeyed(rawAnswer, rawAnswer ? `${room?.roundIndex}:${rawAnswer.name}:${rawAnswer.endonym}` : '');
  const rawGuess = state?.reveal?.guesses?.find((g) => g.playerId === me?.id && Number.isFinite(g.lat) && Number.isFinite(g.lng)) || null;
  const scriptGuess = useKeyed(rawGuess, rawGuess ? `${room?.roundIndex}:${rawGuess.lat},${rawGuess.lng}` : '');

  const mine = state?.players?.find((p) => p.you);
  const iGuessed = Boolean(mine?.guessed);
  const inRound = phase === 'guessing' && me && !me.eliminated;
  const mapMode = phase === 'reveal' ? 'result' : 'guess';
  // The reveal opens out of the card the guess was made on, as it does in
  // solo play. Here the server starts it, seconds after the guess, so the
  // card's resting place is tracked rather than read at a click.
  useOpenFrom(mapFrameRef, mapMode === 'result');
  const effectiveSize = mapSize;
  let mapClass;
  if (mapMode === 'result') {
    mapClass = 'pe-match-result-map absolute inset-x-2 top-16 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:top-24 bottom-[46%] sm:bottom-[40%]';
  } else if (isScript && phase === 'guessing') {
    // The clue and geographic choice belong on one screen. Script has no
    // panorama to uncover, so it never needs Street's mobile map drawer.
    mapClass = 'pe-room-script-map z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-pe-surface';
  } else if (inRound && !iGuessed) {
    mapClass = mobileMapOpen
      ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-pe-line bg-pe-surface'
      : `invisible pointer-events-none absolute -left-[9999px] top-0 z-30 flex h-56 w-72 flex-col overflow-hidden rounded-2xl border border-white/15 bg-pe-surface shadow-2xl transition-all duration-200 sm:visible sm:pointer-events-auto sm:left-auto sm:top-auto sm:bottom-14 sm:right-4 ${DESKTOP_SIZE[effectiveSize]}`;
  } else {
    mapClass = 'invisible pointer-events-none absolute -left-[9999px] top-0 flex h-64 w-64 flex-col';
  }

  const notFound = error?.status === 404;
  const joined = Boolean(identity && me);
  const imageryReady = isScript || Boolean(mapkit);
  // Players only: every panorama a browser opens is a billed load, and
  // the meter charges the room's players. The server withholds the
  // panorama id from anyone who has not joined; this keeps the pane from
  // mounting for them at all.
  const showApple = !isScript && mapkit && joined && status === 'playing' && appleCandidates?.length > 0;

  return (
    <div className={`fixed inset-0 z-[60] select-none overflow-hidden bg-pe-canvas text-pe-fg ${isScript && joined && phase === 'guessing' ? 'pe-room-script-round' : ''}`}>
      {isScript && joined && phase === 'guessing' && shownRound?.text ? (
        <section className="pe-room-sentence" aria-label="Language clue">
          <p>Where is this language spoken?</p>
          <ScriptSample text={shownRound.text} script={shownRound.script} />
        </section>
      ) : null}
      {showApple ? (
        <AppleLookAroundPane
          ref={paneRef}
          mapkit={mapkit}
          candidates={appleCandidates}
          roundKey={String(shownRound?.index ?? locating?.index ?? 0)}
          allowMove={room.config.move}
          allowPan={room.config.pan}
          allowZoom={room.config.zoom}
          onAttempt={(i) => setLocateAttempt(i + 1)}
          onLocated={(i) => {
            // The first browser to find imagery places the round for everyone.
            if (liveRef.current.phase === 'locating' && locating) {
              myLocateRef.current = { index: locating.index, candidates: appleCandidates, key: candidatesCacheRef.current.key };
              act('locate', { index: i }).catch(() => {});
            }
          }}
          onFailed={() => {}}
        />
      ) : null}

      {mapMode === 'result' ? <div className="absolute inset-0 z-20 bg-pe-canvas/85" /> : null}

      {/* HUD during a round and the reveal */}
      {joined && (phase === 'guessing' || phase === 'reveal') ? (
        <>
          <MatchHud state={state} secondsLeft={secondsLeft} onLeave={onLeave} />

          {phase === 'guessing' && !isScript ? (
            <div className="pointer-events-none absolute bottom-16 left-3 z-30 flex flex-col items-start gap-2 sm:left-4">
              <div className="pointer-events-auto flex items-center gap-2">
                <button type="button" onClick={() => paneRef.current?.returnToStart?.()} className={iconButton} aria-label="Return to start" title="Return to start (R)">
                  <RotateCcw className="h-5 w-5" />
                </button>
                {/* Look Around zooms by pinch and wheel only, so there
                    is nothing for a zoom button to do in a room. */}
              </div>
            </div>
          ) : null}

          {phase === 'guessing' ? (
            <div className={`pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 ${isScript ? 'bottom-3 sm:bottom-16 sm:left-[26%]' : 'bottom-32 sm:bottom-16'}`}>
              <ReactionsBar onReact={(emoji) => act('react', { emoji })} disabled={busy} emoji={state.me?.reactions || undefined} />
            </div>
          ) : null}
          <ReactionToasts reactions={state.reactions || []} players={state.players} />

          {inRound && !iGuessed && !isScript ? (
            <div className="pointer-events-auto absolute bottom-16 right-3 z-30 sm:hidden">
              <button type="button" onClick={() => setMobileMapOpen((o) => !o)} className={`${pill} flex h-12 items-center gap-2 px-4 text-sm font-semibold text-white`}>
                <MapIcon className="h-5 w-5" />
                {mobileMapOpen ? 'Hide map' : 'Map'}
              </button>
            </div>
          ) : null}

          {inRound && iGuessed && !isScript ? (
            <div className="pointer-events-none absolute bottom-28 right-4 z-30 pe-guess-locked rounded-2xl border border-white/15 bg-pe-canvas/85 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold text-pe-good">Guess locked in.</p>
              <p className="text-pe-fg/75">
                {state.players.filter((p) => !p.guessed && !p.eliminated).length
                  ? `Waiting for ${state.players.filter((p) => !p.guessed && !p.eliminated).map((p) => p.name).join(', ')}`
                  : 'Everyone is in. Revealing.'}
              </p>
            </div>
          ) : null}
          {phase === 'guessing' && me?.eliminated ? (
            <div className="pointer-events-none absolute bottom-28 right-4 z-30 rounded-2xl border border-pe-bad/40 bg-pe-canvas/85 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold text-pe-bad">You are out of this duel.</p>
              <p className="text-pe-fg/75">Watch the rest play out.</p>
            </div>
          ) : null}
          {actionError ? (
            <div role="alert" className="absolute left-1/2 top-28 z-40 max-w-[92vw] -translate-x-1/2 rounded-xl border border-pe-bad/40 bg-pe-canvas/95 px-4 py-2 text-sm text-pe-fg shadow-lg">{actionError}</div>
          ) : null}
        </>
      ) : null}

      {/* The one map, moved by class between guessing and the reveal.
          It lives for the whole match, off screen between rounds, as the
          solo game's does. Mounted only for guessing and the reveal, it
          was built again every round after that round's Look Around, and
          MapKit then painted the map's rectangle, flipped top to bottom,
          as a black box over the panorama. Keeping it also saves building
          a map every round. */}
      {imageryReady && joined && (status === 'playing' || phase === 'guessing' || phase === 'reveal') ? (
        <div ref={mapFrameRef} className={`geo-map-frame ${mapClass}`}>
          {inRound && !iGuessed ? <div className="pe-map-toolbar"><span>Place your guess</span>{!isScript ? <div className="hidden sm:flex" role="group" aria-label="Map size">{MAP_SIZES.map(size => <button key={size} type="button" onClick={() => setMapSize(size)} aria-pressed={mapSize === size} aria-label={`${size} map`}>{size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}</button>)}</div> : null}{mobileMapOpen ? <button type="button" onClick={() => setMobileMapOpen(false)} aria-label="Close map"><X size={18} /></button> : null}</div> : null}
          <div className="min-h-0 flex-1">
            {isScript ? (
              <ScriptMap pin={inRound ? pin : null} onPin={inRound && !iGuessed ? setPin : undefined}
                answer={scriptAnswer} mode={mapMode}
                guess={scriptGuess} />
            ) : (
              <AppleGuessMap mapkit={mapkit} pin={inRound ? pin : null} onPin={setPin} results={mapResults} mode={mapMode} interactive={inRound && !iGuessed} />
            )}
          </div>
          {/* The same footer as a solo round: what to do on the left,
              the one thing to press on the right. */}
          {inRound && !iGuessed ? (
            <div className="flex shrink-0 items-center gap-3 border-t border-pe-line bg-pe-surface px-4 py-3">
              <p className="min-w-0 flex-1 text-xs leading-snug text-pe-muted">
                {pin ? (
                  <>
                    <span className="sm:hidden">Tap Lock in guess when you are sure.</span>
                    <span className="hidden sm:inline">Space or Enter guesses too.</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Tap the map to drop your pin.</span>
                    <span className="hidden sm:inline">Click the map to drop your pin.</span>
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={submitGuess}
                disabled={!pin || busy}
                data-geo-guess
                className="ui-btn ui-btn--primary pe-button pe-button--primary shrink-0"
              >
                {busy ? 'Locking in…' : pin ? 'Lock in guess' : 'Place a pin'}
              </button>
            </div>
          ) : null}
          {isScript && inRound && iGuessed ? <div role="status" className="shrink-0 border-t border-pe-line px-4 py-3 text-sm text-pe-fg">Guess locked in. Waiting for the other player.</div> : null}
        </div>
      ) : null}

      {/* Screens */}
      {accountGate ? <AccountDialog name={defaultName} onNameChange={setDefaultName} returnTo={`/geo/room/${code}?name=${encodeURIComponent(defaultName)}`} onClose={() => { pendingJoinRef.current = ''; setAccountGate(false); }} onAuthenticated={() => { setSignedIn(true); setAccountGate(false); }} /> : null}
      {!ready || (!state && !error) ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-pe-canvas text-pe-muted">Loading the room</div> : null}
      {notFound ? <MessagePanel title="No room with that code" message="Codes are six letters and numbers. Check it with whoever sent it, or open a new room." /> : null}
      {error?.code === 'connection' && state ? <div role="status" className="absolute inset-x-3 top-16 z-[80] mx-auto max-w-lg rounded-xl border border-pe-warm/50 bg-pe-canvas/95 px-4 py-3 text-center text-sm text-pe-fg shadow-lg">{error.message}</div> : null}
      {error && !notFound && !(error.code === 'connection' && state) ? <MessagePanel title={error.code === 'connection' ? 'Reconnecting' : 'The room could not be loaded'} message={error.message} /> : null}
      {state && !joined && !error ? (
        <JoinPanel
          state={state}
          defaultName={defaultName}
          onJoin={() =>
            run(async () => {
              // The account's name, as the resumed join below uses. The
              // panel used to send whatever was in a name box, and a
              // profile takes any name it is sent: a player who cleared
              // the box and pressed Join had their account renamed
              // "Player".
              if (!signedIn) { pendingJoinRef.current = defaultName || DEFAULT_PLAYER_NAME; setAccountGate(true); return; }
              const profile = await ensureProfile('').catch(() => null);
              await join(profile?.name || defaultName || DEFAULT_PLAYER_NAME);
            })
          }
          busy={busy}
          error={actionError}
        />
      ) : null}
      {joined && phase === 'lobby' ? (
        <LobbyPanel state={state} onStart={() => run(() => act('start'))} onLeave={onLeave} busy={busy} error={actionError} />
      ) : null}
      {joined && phase === 'loading' ? <LoadingPanel state={state} /> : null}
      {joined && phase === 'locating' ? <LocatingPanel state={state} attempt={locateAttempt} /> : null}
      {joined && phase === 'reveal' ? (
        <RevealPanel state={state} secondsLeft={revealLeft ?? 0} onNext={() => run(() => act('next', { phase, roundIndex: room?.roundIndex }))} onReact={(emoji) => act('react', { emoji })} busy={busy} />
      ) : null}
      {joined && status === 'finished' ? <StandingsPanel state={state} onRematch={onRematch} onLeave={onLeave} busy={busy} error={actionError} /> : null}
      {server && !imageryConfigured && joined && status !== 'finished' ? (
        <Panel>
          <SetupNotice provider="apple" missing={server?.providers?.apple?.missing || []} />
        </Panel>
      ) : null}
      {sdkError && !isScript ? <MessagePanel title="Apple Look Around did not load" message={sdkError} /> : null}
      {joined && status === 'playing' && !imageryReady && !sdkError && imageryConfigured && (phase === 'guessing' || phase === 'reveal' || phase === 'locating') ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-pe-canvas text-pe-muted">Loading Look Around</div>
      ) : null}
    </div>
  );
}
