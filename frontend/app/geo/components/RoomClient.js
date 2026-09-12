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
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Minus, Plus, RotateCcw, X, Map as MapIcon } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { initials } from '@/app/lib/geo/rooms';
import { loadGoogleMaps, onGoogleMapsAuthFailure } from '../lib/googleMaps';
import { useRoom, useNow, loadName, saveIdentity } from '../lib/useRoom';
import { ensureProfile } from '../lib/profile';
import GoogleStreetViewPane from './GoogleStreetViewPane';
import AppleLookAroundPane from './AppleLookAroundPane';
import AppleGuessMap from './AppleGuessMap';
import { ensureLookAround } from '../lib/lookAround';
import GoogleGuessMap from './GoogleGuessMap';
import { Compass, TimerRing } from './GameHud';
import SetupNotice from './SetupNotice';
import PlayersPanel from './rooms/PlayersPanel';
import { JoinPanel, LobbyPanel, LoadingPanel, Panel, ReactionToasts, ReactionsBar, RevealPanel, StandingsPanel, LocatingPanel } from './rooms/RoomPanels';

const MAP_SIZES = ['small', 'medium', 'large'];
const DESKTOP_SIZE = {
  small: 'sm:w-72 sm:h-56',
  medium: 'sm:w-[30rem] sm:h-80',
  large: 'sm:w-[44rem] sm:h-[32rem]',
};
const pill = 'rounded-full border border-white/20 bg-midnight-900/80 shadow-lg backdrop-blur';
const iconButton = `${pill} flex h-11 w-11 items-center justify-center text-white transition hover:bg-midnight-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-40`;

function MessagePanel({ title, message, children }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-flash-400" />
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
  const [api, setApi] = useState(null);
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
  const browserKey = server?.providers?.google?.browserKey || '';
  const isApple = room?.config?.provider === 'apple';
  const googleConfigured = isApple || Boolean(server?.providers?.google?.configured);
  if (state?.round) lastRoundRef.current = state.round;
  const shownRound = state?.round || lastRoundRef.current;
  const locating = state?.locating || null;

  // Apple rooms: the places the pane tries. Kept the same array across
  // polls (and, for the browser that found the place, across the change
  // to guessing), so the pane does not restart its search every poll.
  let appleCandidates = null;
  if (isApple) {
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
    fetch('/api/geo/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
      .then((data) => alive && setServer(data))
      .catch(() => alive && setSdkError('Could not load the game settings from the server.'));
    return () => {
      alive = false;
    };
  }, []);

  // The imagery SDK, once a game is on: MapKit for Apple rooms, Maps for Google.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    let alive = true;
    if (isApple) {
      ensureLookAround()
        .then((loaded) => alive && setMapkit(loaded))
        .catch((e) => alive && setSdkError(e?.message || 'MapKit JS failed to load'));
    } else if (browserKey) {
      loadGoogleMaps(browserKey)
        .then((loaded) => alive && setApi(loaded))
        .catch((e) => alive && setSdkError(e.message));
    }
    return () => {
      alive = false;
    };
  }, [browserKey, status, isApple]);

  useEffect(() => onGoogleMapsAuthFailure((message) => setSdkError(message)), []);

  // Arrived with ?name= (a rematch link): join without asking again.
  useEffect(() => {
    if (!ready || !state || identity || !presetName || autoJoinedRef.current) return;
    if (state.room.status === 'finished') return;
    autoJoinedRef.current = true;
    ensureProfile(presetName)
      .catch(() => null)
      .then(() => join(presetName))
      .catch((e) => setActionError(e.message));
  }, [ready, state, identity, presetName, join]);

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
      if (event.target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName)) return;
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
    mapClass = 'absolute inset-x-2 top-16 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:top-24 bottom-[46%] sm:bottom-[40%]';
  } else if (inRound && !iGuessed) {
    mapClass = mobileMapOpen
      ? 'fixed inset-x-0 bottom-0 top-[26%] z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-midnight-900'
      : `hidden sm:flex absolute bottom-14 right-4 z-30 flex-col overflow-hidden rounded-2xl border border-white/10 bg-midnight-900 shadow-2xl transition-all duration-200 ${DESKTOP_SIZE[effectiveSize]}`;
  } else {
    mapClass = 'pointer-events-none absolute -left-[9999px] top-0 h-64 w-64 opacity-0';
  }

  const notFound = error?.status === 404;
  const joined = Boolean(identity && me);
  const imageryReady = isApple ? Boolean(mapkit) : Boolean(api);
  const showImagery = !isApple && api && status === 'playing' && shownRound;
  const showApple = isApple && mapkit && status === 'playing' && appleCandidates?.length > 0;

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-midnight-950 text-white">
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
      {showImagery ? (
        <GoogleStreetViewPane
          ref={paneRef}
          api={api}
          panoId={shownRound.panoId}
          heading={shownRound.heading || 0}
          allowMove={room.config.move}
          allowPan={room.config.pan}
          allowZoom={room.config.zoom}
          onHeading={setHeading}
        />
      ) : null}

      {mapMode === 'result' ? <div className="absolute inset-0 z-20 bg-midnight-950/85" /> : null}

      {/* HUD during a round and the reveal */}
      {joined && (phase === 'guessing' || phase === 'reveal') ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2 ${pill}`}>
              <div className="flex flex-col leading-tight">
                <span className="max-w-[10rem] truncate text-[11px] uppercase tracking-wide text-white/60">{room.name}</span>
                <span className="text-sm font-semibold">Round {room.roundIndex + 1} of {room.roundsTotal}</span>
              </div>
              <div className="flex flex-col border-l border-white/15 pl-3 leading-tight">
                <span className="text-[11px] uppercase tracking-wide text-white/60">{room.variant === 'duel' ? 'Your HP' : 'Your score'}</span>
                <span className="text-sm font-semibold tabular-nums text-flash-300">{room.variant === 'duel' ? mine?.hp : formatScore(mine?.score || 0)}</span>
              </div>
            </div>
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {phase === 'guessing' && secondsLeft !== null ? <TimerRing secondsLeft={secondsLeft} total={room.config.time} /> : null}
                <button type="button" onClick={onLeave} className={iconButton} aria-label="Leave the room" title="Leave the room">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <PlayersPanel players={state.players} variant={room.variant} phase={phase} compact />
              {inRound && !iGuessed ? (
                <div className="hidden items-center gap-1 sm:flex">
                  {MAP_SIZES.map((size) => (
                    <button key={size} type="button" onClick={() => setMapSize(size)} aria-pressed={mapSize === size} className={`rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur transition ${mapSize === size ? 'border-flash-400 bg-flash-400 text-midnight-900' : 'border-white/20 bg-midnight-900/80 text-white hover:bg-midnight-800'}`}>
                      {size[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {phase === 'guessing' ? (
            <div className="pointer-events-none absolute bottom-16 left-3 z-30 flex flex-col items-start gap-2 sm:left-4">
              {!isApple ? (
                <div className="pointer-events-auto">
                  <Compass heading={heading} />
                </div>
              ) : null}
              <div className="pointer-events-auto flex items-center gap-2">
                <button type="button" onClick={() => paneRef.current?.returnToStart?.()} className={iconButton} aria-label="Return to start" title="Return to start (R)">
                  <RotateCcw className="h-5 w-5" />
                </button>
                {room.config.zoom && !isApple ? (
                  <>
                    <button type="button" onClick={() => paneRef.current?.zoomBy?.(1)} className={iconButton} aria-label="Zoom in">
                      <Plus className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => paneRef.current?.zoomBy?.(-1)} className={iconButton} aria-label="Zoom out">
                      <Minus className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {phase === 'guessing' ? (
            <div className="pointer-events-auto absolute bottom-16 left-1/2 z-30 -translate-x-1/2">
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
            <div className="pointer-events-none absolute bottom-28 right-4 z-30 rounded-2xl border border-white/15 bg-midnight-900/85 px-4 py-3 text-sm shadow-lg backdrop-blur">
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

      {/* The one map: MapKit backs it in an Apple room, Maps in a Google one. */}
      {imageryReady && joined ? (
        <div className={mapClass} onMouseEnter={() => setMapHover(true)} onMouseLeave={() => setMapHover(false)}>
          <div className="min-h-0 flex-1">
            {isApple ? (
              <AppleGuessMap mapkit={mapkit} pin={inRound ? pin : null} onPin={setPin} results={mapResults} mode={mapMode} interactive={inRound && !iGuessed} />
            ) : (
              <GoogleGuessMap api={api} pin={inRound ? pin : null} onPin={setPin} results={mapResults} mode={mapMode} interactive={inRound && !iGuessed} pinStyle={mine?.cosmetics?.pin ? { style: mine.cosmetics.pin.style, fill: mine.color } : null} />
            )}
          </div>
          {inRound && !iGuessed ? (
            <button
              type="button"
              onClick={submitGuess}
              disabled={!pin || busy}
              className="h-12 shrink-0 bg-flash-400 text-base font-bold text-midnight-900 transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:bg-midnight-800 disabled:text-white/50"
            >
              {busy ? 'Sending' : pin ? 'Guess' : 'Place your pin on the map'}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Screens */}
      {!ready || (!state && !error) ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight-950 text-white/70">Loading the room</div> : null}
      {notFound ? <MessagePanel title="No room with that code" message="Codes are six letters and numbers. Check it with whoever sent it, or open a new room." /> : null}
      {error && !notFound ? <MessagePanel title="The room could not be loaded" message={error.message} /> : null}
      {state && !joined && !error ? (
        <JoinPanel
          state={state}
          defaultName={defaultName}
          onJoin={(name) =>
            run(async () => {
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
        <RevealPanel state={state} secondsLeft={revealLeft ?? 0} onNext={() => run(() => act('next'))} onReact={(emoji) => act('react', { emoji })} busy={busy} />
      ) : null}
      {joined && status === 'finished' ? <StandingsPanel state={state} onRematch={onRematch} onLeave={onLeave} busy={busy} error={actionError} /> : null}
      {server && !googleConfigured && joined && status !== 'finished' ? (
        <Panel>
          <SetupNotice provider="google" missing={server?.providers?.google?.missing || []} />
        </Panel>
      ) : null}
      {sdkError ? <MessagePanel title={isApple ? 'Apple Look Around did not load' : 'Google Maps did not load'} message={sdkError} /> : null}
      {joined && status === 'playing' && !imageryReady && !sdkError && googleConfigured && (phase === 'guessing' || phase === 'reveal' || phase === 'locating') ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-midnight-950 text-white/70">{isApple ? 'Loading Look Around' : 'Loading Street View'}</div>
      ) : null}
    </div>
  );
}
