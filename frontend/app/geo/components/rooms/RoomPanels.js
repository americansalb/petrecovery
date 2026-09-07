'use client';

/**
 * The room's non-imagery screens: join, lobby, loading, reveal, standings,
 * plus the reactions bar. The imagery, map and HUD live in RoomClient.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Link2, LogOut, Play, RefreshCw, Share2, SkipForward, Users } from 'lucide-react';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { MODES, movementLabel, timeLabel } from '@/app/lib/geo/modes';
import { REACTION_EMOJI, VARIANTS, describeRoomMode, medal, sortStandings } from '@/app/lib/geo/rooms';
import PlayersPanel, { PlayerBadge, HpBar } from './PlayersPanel';
import PlayerName from '../PlayerName';

export function Panel({ children, wide = false }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-midnight-950/95 p-4">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-white/10 bg-midnight-900 p-5 text-white shadow-2xl sm:p-6`}>{children}</div>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  return [copied, copy];
}

export function RoomSummary({ room, countries }) {
  const regionLabel = room.config.mode === 'country' ? countries?.find((c) => c.code === room.config.region)?.name : undefined;
  const parts = [describeRoomMode(room.config, { regionLabel }), `${room.roundsTotal} rounds`, `${timeLabel(room.config.time)} each`];
  if (!(room.config.move && room.config.pan && room.config.zoom)) parts.push(movementLabel(room.config));
  if (room.config.provider === 'apple') parts.push('Apple Look Around');
  return (
    <p className="text-sm text-white/70">
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-flash-300">{VARIANTS[room.variant]?.label || room.variant}</span>{' '}
      {parts.join('. ')}.
    </p>
  );
}

export function JoinPanel({ state, defaultName, onJoin, busy, error }) {
  const [name, setName] = useState(defaultName || '');
  useEffect(() => {
    if (defaultName && !name) setName(defaultName);
  }, [defaultName, name]);
  const room = state.room;
  const finished = room.status === 'finished';
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Room {room.code}</p>
      <h1 className="mt-1 text-2xl font-bold">{room.name}</h1>
      <div className="mt-2">
        <RoomSummary room={room} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <Users className="h-4 w-4" />
        {state.players.length} {state.players.length === 1 ? 'player' : 'players'}
        {state.players.length ? `: ${state.players.map((p) => p.name).join(', ')}` : ''}
      </p>
      {finished ? (
        <div className="mt-4">
          <p className="text-white/80">This game is over.</p>
          {room.rematchCode ? (
            <Link href={`/geo/room/${room.rematchCode}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2 font-bold text-midnight-900 hover:bg-flash-500">
              <RefreshCw className="h-4 w-4" />
              Join the rematch
            </Link>
          ) : null}
          <Link href="/geo/rooms" className="mt-3 ml-2 inline-block rounded-xl border border-white/20 px-4 py-2 font-semibold hover:bg-white/10">
            All rooms
          </Link>
        </div>
      ) : (
        <form
          method="post"
          className="mt-5 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(name);
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Your name"
            aria-label="Your name"
            className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-flash-400 focus:outline-none"
            style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', color: '#ffffff' }}
            autoFocus
          />
          <button type="submit" disabled={busy || !name.trim()} className="rounded-xl bg-flash-400 px-5 py-2.5 font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
            {busy ? 'Joining' : room.status === 'playing' ? 'Jump in' : 'Join'}
          </button>
        </form>
      )}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <p className="mt-4 text-xs text-white/40">
        Not this room? <Link href="/geo/rooms" className="underline">Back to the room list</Link>
      </p>
    </Panel>
  );
}

export function LobbyPanel({ state, countries, onStart, onLeave, busy, error }) {
  const [copied, copy] = useCopy();
  const room = state.room;
  const me = state.me;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/geo/room/${room.code}` : `/geo/room/${room.code}`;
  return (
    <Panel wide>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Room</p>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <div className="mt-2">
            <RoomSummary room={room} countries={countries} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-midnight-950/60 p-3 text-center">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Join code</p>
          <p className="text-3xl font-bold tracking-[0.3em] text-flash-300">{room.code}</p>
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" onClick={() => copy('code', room.code)} className="flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10">
              {copied === 'code' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              Code
            </button>
            <button type="button" onClick={() => copy('link', link)} className="flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10">
              {copied === 'link' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Link2 className="h-3.5 w-3.5" />}
              Link
            </button>
          </div>
        </div>
      </div>

      <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-white/60">
        Players ({state.players.length})
      </h2>
      <PlayersPanel players={state.players} variant={room.variant} phase="lobby" />

      {room.lastError ? <p className="mt-3 rounded-xl border border-red-400/40 bg-red-950/60 px-3 py-2 text-sm text-red-100">{room.lastError}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {me?.isHost ? (
          <button type="button" onClick={onStart} disabled={busy} className="flex items-center gap-2 rounded-xl bg-flash-400 px-5 py-2.5 font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
            <Play className="h-4 w-4" />
            {busy ? 'Starting' : state.players.length < 2 ? 'Start anyway' : 'Start the game'}
          </button>
        ) : (
          <p className="text-sm text-white/70">Waiting for {state.players.find((p) => p.isHost)?.name || 'the host'} to start.</p>
        )}
        <button type="button" onClick={onLeave} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
          <LogOut className="h-4 w-4" />
          Leave
        </button>
      </div>
      {me?.isHost && state.players.length < 2 ? <p className="mt-2 text-xs text-white/50">Share the code first: the game is better with company.</p> : null}
    </Panel>
  );
}

export function LoadingPanel({ state }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-midnight-950/95 text-center text-white" role="status" aria-live="polite">
      <RefreshCw className="h-9 w-9 animate-spin text-flash-400" />
      <p className="mt-4 text-lg font-semibold">Round {state.room.roundIndex + 2 > state.room.roundsTotal ? state.room.roundsTotal : state.room.roundIndex + 2}</p>
      <p className="mt-1 text-sm text-white/70">Finding a place with imagery for everyone</p>
    </div>
  );
}

/** Apple rooms: a browser is trying the places offered; the screen waits with it. */
export function LocatingPanel({ state, attempt = 0 }) {
  const total = state.locating?.candidates?.length || 0;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-midnight-950/95 text-center text-white" role="status" aria-live="polite">
      <RefreshCw className="h-9 w-9 animate-spin text-flash-400" />
      <p className="mt-4 text-lg font-semibold">
        Round {state.room.roundIndex + 1} of {state.room.roundsTotal}
      </p>
      <p className="mt-1 text-sm text-white/70">
        Finding Look Around imagery for everyone
        {attempt ? `, place ${Math.min(attempt, total || attempt)} of ${total || '?'}` : ''}
      </p>
    </div>
  );
}

export function RevealPanel({ state, secondsLeft, onNext, onReact, busy }) {
  const { room, reveal, players, me } = state;
  const isDuel = room.variant === 'duel';
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const answer = reveal?.answer;
  const place = [answer?.city, answer?.country?.name].filter(Boolean).join(', ');
  const last = room.roundIndex + 1 >= room.roundsTotal;
  const mine = reveal?.guesses.find((g) => g.playerId === me?.id);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 max-h-[46%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-midnight-950/95 text-white shadow-2xl backdrop-blur sm:max-h-[40%]">
      <div className="mx-auto max-w-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Round {room.roundIndex + 1} of {room.roundsTotal}
              {isDuel && reveal?.multiplier > 1 ? ` · damage x${reveal.multiplier}` : ''}
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {answer?.country?.flag} {place || 'Somewhere unlisted'}
              {answer?.date ? <span className="text-sm font-normal text-white/50">, imagery from {answer.date}</span> : null}
            </p>
            {mine ? (
              <p className="text-sm text-white/80">
                You: {mine.timedOut ? 'no guess' : `${formatDistance(mine.distanceKm)} away`}, {formatScore(mine.score)} points{isDuel && mine.damage ? `, ${mine.damage} damage taken` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onReact ? <ReactionsBar onReact={onReact} disabled={busy} emoji={state.me?.reactions || REACTION_EMOJI} /> : null}
            <span className="text-sm text-white/60">{last ? 'Results' : 'Next round'} in {secondsLeft}s</span>
            {me?.isHost ? (
              <button type="button" onClick={onNext} disabled={busy} className="flex items-center gap-1 rounded-xl bg-flash-400 px-3 py-2 text-sm font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
                <SkipForward className="h-4 w-4" />
                Now
              </button>
            ) : null}
          </div>
        </div>
        <ol className="mt-3 space-y-1">
          {(reveal?.guesses || []).map((g) => {
            const p = byId[g.playerId];
            if (!p) return null;
            return (
              <li key={g.playerId} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${p.you ? 'bg-white/5' : ''}`}>
                <span className="w-6 text-center">{medal(g.rank) || g.rank}</span>
                <PlayerBadge player={p} size="sm" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="w-24 text-right text-white/70">{g.timedOut ? 'no guess' : formatDistance(g.distanceKm)}</span>
                <span className="w-16 text-right font-semibold tabular-nums text-flash-300">{formatScore(g.score)}</span>
                {isDuel ? <span className={`w-16 text-right text-xs ${g.damage ? 'text-red-300' : 'text-green-400'}`}>{g.damage ? `-${g.damage}` : 'safe'}</span> : null}
              </li>
            );
          })}
        </ol>
        {isDuel ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <PlayerBadge player={p} size="sm" />
                <span className="w-20 truncate">{p.name}</span>
                <div className="flex-1"><HpBar hp={p.hp} color={p.color} /></div>
                <span className="w-12 text-right tabular-nums">{p.hp}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StandingsPanel({ state, onRematch, onLeave, busy, error }) {
  const [copied, copy] = useCopy();
  const { room, players, me } = state;
  const isDuel = room.variant === 'duel';
  const standings = sortStandings(players, room.variant);
  const winner = standings[0];
  const text = [
    `Where on Earth, room ${room.name}: ${VARIANTS[room.variant]?.label || room.variant}, ${room.roundsTotal} rounds.`,
    ...standings.map((p, i) => `${i + 1}. ${p.name} ${isDuel ? `${p.hp} HP` : `${formatScore(p.score)} points`}`),
  ].join('\n');
  return (
    <Panel wide>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Final standings</p>
      <h1 className="mt-1 text-2xl font-bold">
        {winner ? `${winner.name} wins` : 'Nobody was left'}
        {winner?.you ? '. That is you.' : ''}
      </h1>
      {me && (players.find((p) => p.you)?.pointsEarned || 0) > 0 ? (
        <p className="mt-1 text-sm text-flash-300">+{players.find((p) => p.you).pointsEarned} points for you this game.</p>
      ) : null}
      <div className="mt-4 flex items-end justify-center gap-3">
        {standings.slice(0, 3).map((p, i) => (
          <div key={p.id} className={`flex flex-col items-center ${i === 0 ? 'order-2' : i === 1 ? 'order-1' : 'order-3'}`}>
            <span className="text-2xl">{medal(i + 1)}</span>
            <PlayerBadge player={p} size="lg" />
            <PlayerName name={p.name} cosmetics={p.cosmetics} className="mt-1 max-w-[7rem] text-sm font-semibold" />
            <span className="text-xs text-white/60">{isDuel ? `${p.hp} HP` : formatScore(p.score)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <PlayersPanel players={standings} variant={room.variant} phase="finished" />
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {me?.isHost && !room.rematchCode ? (
          <button type="button" onClick={onRematch} disabled={busy} className="flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2.5 font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" />
            Play again, same settings
          </button>
        ) : null}
        {room.rematchCode ? (
          <Link href={`/geo/room/${room.rematchCode}?name=${encodeURIComponent(me?.name || '')}`} className="flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2.5 font-bold text-midnight-900 hover:bg-flash-500">
            <RefreshCw className="h-4 w-4" />
            Join the rematch
          </Link>
        ) : null}
        <button type="button" onClick={() => copy('text', text)} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
          {copied === 'text' ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
          {copied === 'text' ? 'Copied' : 'Copy standings'}
        </button>
        <button type="button" onClick={onLeave} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
          <LogOut className="h-4 w-4" />
          Leave
        </button>
      </div>
      <p className="mt-3 text-xs text-white/40">
        {MODES[room.config.mode]?.label || room.config.mode}. {room.roundsTotal} rounds.{' '}
        {players.some((p) => Number.isFinite(p.ratingDelta)) ? (
          <>
            Ratings updated. <Link href="/geo/leaderboard" className="underline">See the rankings</Link>.
          </>
        ) : (
          'Games with two or more registered players are rated.'
        )}
      </p>
    </Panel>
  );
}

/** Quick emoji reactions, sent to everyone in the room. */
export function ReactionsBar({ onReact, disabled, emoji = REACTION_EMOJI }) {
  const [cooldown, setCooldown] = useState(false);
  const send = async (emoji) => {
    if (cooldown || disabled) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1200);
    try {
      await onReact(emoji);
    } catch {
      /* a lost reaction is no loss */
    }
  };
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-midnight-900/80 p-1 backdrop-blur">
      {emoji.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => send(e)}
          disabled={disabled || cooldown}
          className="h-9 w-9 rounded-full text-lg transition hover:bg-white/10 disabled:opacity-50"
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/** Floating reactions from everyone, gone after a few seconds. */
export function ReactionToasts({ reactions, players }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const [shown, setShown] = useState([]);
  // The newest reaction already shown, by its server timestamp. A ref,
  // not state: a state change here would re-run the effect and cancel
  // the timer that clears the toast.
  const seenRef = useRef(Date.now());
  useEffect(() => {
    const fresh = (reactions || []).filter((r) => r.at > seenRef.current);
    if (!fresh.length) return;
    seenRef.current = fresh[fresh.length - 1].at;
    const shownAt = Date.now();
    setShown((list) => [...list, ...fresh.map((r) => ({ ...r, shownAt }))].slice(-6));
    setTimeout(() => setShown((list) => list.filter((r) => Date.now() - r.shownAt < 4000)), 4200);
  }, [reactions]);
  if (!shown.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      {shown.map((r, i) => {
        const p = byId[r.p];
        return (
          <div key={`${r.at}-${i}`} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-midnight-900/85 px-3 py-1 text-sm shadow-lg backdrop-blur">
            <span className="text-lg">{r.e}</span>
            <span className="font-semibold" style={{ color: p?.color || '#fff' }}>{r.n}</span>
          </div>
        );
      })}
    </div>
  );
}
