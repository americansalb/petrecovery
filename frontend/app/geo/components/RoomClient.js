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
import { initials } from '@/app/lib/geo/rooms';
import { useRoom, useNow, loadName, saveIdentity } from '../lib/useRoom';
import { ensureProfile } from '../lib/profile';
import AppleLookAroundPane from './AppleLookAroundPane';
import AppleGuessMap from './AppleGuessMap';
import { ensureLookAround } from '../lib/lookAround';
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
const pill = 'rounded-full border border-white/20 bg-ocean-900/80 shadow-lg backdrop-blur';
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-white transition hover:bg-ocean-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 disabled:opacity-40`;

function MessagePanel({ title, message, children }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-clay-300" />
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-white/80">{message}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {children}
        <Link href="/geo/rooms" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
          All rooms
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
  const [heading, setHeading] = useState(0);
  const [mapSize, setMapSize] = useState('small');
  const [mapHover, setMapHover] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [defaultName, setDefaultName] = useState('');
  const [accountGate, setAccountGate] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => { if (live) setSignedIn(Boolean(d.signedIn)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const paneRef = useRef(null);
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


  // Arrived with ?name= (a rematch link): join without asking again.
  useEffect(() => {
    if (!signedIn || !ready || !state || identity || !presetName || autoJoinedRef.current) return;
    if (state.room.status === 'finished') return;
    autoJoinedRef.current = true;
    ensureProfile(presetName)
      .catch(() => null)
      .then(() => join(presetName))
      .catch((e) => setActionError(e.message));
  }, [ready, state, identity, presetName, join, signedIn]);

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
  const mapResults = useMemo(() => {
    const reveal = state?.reveal;
    if (!reveal || phase !== 'reveal') return [];
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
  }, [state, phase]);

  const mine = state?.players?.find((p) => p.you);
  const iGuessed = Boolean(mine?.guessed);
  const inRound = phase === 'guessing' && me && !me.eliminated;
  const mapMode = phase === 'reveal' ? 'result' : 'guess';
  const effectiveSize = mapHover && mapSize === 'small' ? 'medium' : mapSize;
  let mapClass;
  if (mapMode === 'result') {
    mapClass = 'pe-match-result-map absolute inset-x-2 top-16 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:top-24 bottom-[46%] sm:bottom-[40%]';
  } else if (inRound && !iGuessed) {
    mapClass = mobileMapOpen
      ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-ocean-900'
      : `hidden sm:flex absolute bottom-14 right-4 z-30 flex-col overflow-hidden rounded-2xl border border-white/10 bg-ocean-900 shadow-2xl transition-all duration-200 ${DESKTOP_SIZE[effectiveSize]}`;
    if (isScript && !mobileMapOpen) mapClass = 'hidden sm:flex absolute right-4 top-[24%] bottom-24 w-[48%] z-30 flex-col overflow-hidden rounded-2xl border border-white/10 bg-ocean-900';
  } else {
    mapClass = 'pointer-events-none absolute -left-[9999px] top-0 h-64 w-64 opacity-0';
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
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-ocean-950 text-white">
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

      {mapMode === 'result' ? <div className="absolute inset-0 z-20 bg-ocean-950/85" /> : null}

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
            <div className={`pointer-events-auto absolute bottom-32 sm:bottom-16 left-1/2 z-30 -translate-x-1/2 ${isScript ? 'sm:left-[26%]' : ''}`}>
              <ReactionsBar onReact={(emoji) => act('react', { emoji })} disabled={busy} emoji={state.me?.reactions || undefined} />
            </div>
          ) : null}
          <ReactionToasts reactions={state.reactions || []} players={state.players} />

          {inRound && !iGuessed ? (
            <div className="pointer-events-auto absolute bottom-16 right-3 z-30 sm:hidden">
              <button type="button" onClick={() => setMobileMapOpen((o) => !o)} className={`${pill} flex h-12 items-center gap-2 px-4 text-sm font-semibold text-white`}>
                <MapIcon className="h-5 w-5" />
                {mobileMapOpen ? 'Hide map' : 'Map'}
              </button>
            </div>
          ) : null}

          {inRound && iGuessed ? (
            <div className="pointer-events-none absolute bottom-28 right-4 z-30 pe-guess-locked rounded-2xl border border-white/15 bg-ocean-900/85 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold text-green-400">Guess locked in.</p>
              <p className="text-white/70">
                {state.players.filter((p) => !p.guessed && !p.eliminated).length
                  ? `Waiting for ${state.players.filter((p) => !p.guessed && !p.eliminated).map((p) => p.name).join(', ')}`
                  : 'Everyone is in. Revealing.'}
              </p>
            </div>
          ) : null}
          {phase === 'guessing' && me?.eliminated ? (
            <div className="pointer-events-none absolute bottom-28 right-4 z-30 rounded-2xl border border-red-400/30 bg-red-950/70 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold text-red-200">You are out of this duel.</p>
              <p className="text-white/70">Watch the rest play out.</p>
            </div>
          ) : null}
          {actionError ? (
            <div className="absolute left-1/2 top-28 z-40 -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg">{actionError}</div>
          ) : null}
        </>
      ) : null}

      {/* The one map, moved by class between guessing and the reveal. */}
      {imageryReady && joined && (phase === 'guessing' || phase === 'reveal') ? (
        <div className={`geo-map-frame ${mapClass}`} onMouseEnter={() => setMapHover(true)} onMouseLeave={() => setMapHover(false)}>
          {inRound && !iGuessed ? <div className="pe-map-toolbar"><span>Place your guess</span>{!isScript ? <div className="hidden sm:flex" role="group" aria-label="Map size">{MAP_SIZES.map(size => <button key={size} type="button" onClick={() => setMapSize(size)} aria-pressed={mapSize === size} aria-label={`${size} map`}>{size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}</button>)}</div> : null}{mobileMapOpen ? <button type="button" onClick={() => setMobileMapOpen(false)} aria-label="Close map"><X size={18} /></button> : null}</div> : null}
          <div className="min-h-0 flex-1">
            {isScript ? (
              <ScriptMap pin={inRound ? pin : null} onPin={inRound && !iGuessed ? setPin : undefined}
                answer={state?.reveal?.scriptAnswer} mode={mapMode}
                guess={state?.reveal?.guesses?.find((g) => g.playerId === me?.id && Number.isFinite(g.lat) && Number.isFinite(g.lng)) || null} />
            ) : (
              <AppleGuessMap mapkit={mapkit} pin={inRound ? pin : null} onPin={setPin} results={mapResults} mode={mapMode} interactive={inRound && !iGuessed} />
            )}
          </div>
          {/* The same footer as a solo round: what to do on the left,
              the one thing to press on the right. */}
          {inRound && !iGuessed ? (
            <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-ocean-900 px-4 py-3">
              <p className="min-w-0 flex-1 text-xs leading-snug text-sand-300/80">
                {pin ? 'Space or Enter guesses too.' : 'Tap the map to drop your pin.'}
              </p>
              <button
                type="button"
                onClick={submitGuess}
                disabled={!pin || busy}
                data-geo-guess
                className="pe-button pe-button--primary shrink-0 rounded-full bg-clay-400 px-8 py-2.5 text-sm font-bold text-ocean-950 transition hover:bg-clay-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-ocean-800 disabled:text-ocean-950/40"
              >
                {busy ? 'Locking in…' : pin ? 'Lock in guess' : 'Place a pin'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Screens */}
      {accountGate ? <AccountDialog name={defaultName} onNameChange={setDefaultName} returnTo={`/geo/room/${code}?name=${encodeURIComponent(defaultName)}`} onClose={() => setAccountGate(false)} onAuthenticated={() => { setSignedIn(true); setAccountGate(false); }} /> : null}
      {!ready || (!state && !error) ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-950 text-white/70">Loading the room</div> : null}
      {notFound ? <MessagePanel title="No room with that code" message="Codes are six letters and numbers. Check it with whoever sent it, or open a new room." /> : null}
      {error && !notFound ? <MessagePanel title="The room could not be loaded" message={error.message} /> : null}
      {state && !joined && !error ? (
        <JoinPanel
          state={state}
          defaultName={defaultName}
          onJoin={(name) =>
            run(async () => {
              if (!signedIn) { setDefaultName(name); setAccountGate(true); return; }
              await ensureProfile(name).catch(() => null);
              await join(name);
            })
          }
          busy={busy}
          error={actionError}
        />
      ) : null}
      {joined && phase === 'lobby' ? (
        <LobbyPanel state={state} countries={server?.countries} onStart={() => run(() => act('start'))} onLeave={onLeave} busy={busy} error={actionError} />
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
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-950 text-white/70">Loading Look Around</div>
      ) : null}
    </div>
  );
}
