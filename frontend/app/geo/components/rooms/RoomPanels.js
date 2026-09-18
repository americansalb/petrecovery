"use client";

/**
 * The room's non-imagery screens: join, lobby, loading, reveal, standings,
 * plus the reactions bar. The imagery, map and HUD live in RoomClient.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../ui/Card";
import Link from "next/link";
import {
  Check,
  Copy,
  Link2,
  LogOut,
  Play,
  RefreshCw,
  Share2,
  SkipForward,
  Users,
} from "lucide-react";
import { formatDistance, formatScore } from "@/app/lib/geo/distance";
import {
  MODES,
  PRIMARY_PROVIDER,
  PROVIDERS,
  movementLabel,
  timeLabel,
} from "@/app/lib/geo/modes";
import {
  REACTION_EMOJI,
  VARIANTS,
  describeRoomMode,
  medal,
} from "@/app/lib/geo/rooms";
import PlayersPanel, { PlayerBadge, HpBar } from "./PlayersPanel";
import PlayerName from "../PlayerName";
import RankEmblem, { VictoryCrest } from "../RankEmblem";
import { useCountUp } from "../../lib/countUp";
import {
  roundOutcome,
  placedLeague,
  matchStandings,
} from "../../lib/matchPresentation";
import { PROVISIONAL_GAMES } from "@/app/lib/geo/rating";

export function Panel({ children, wide = false }) {
  return (
    <div className="pe-room-stage absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-ocean-950/95 p-4">
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-white/10 bg-ocean-900 p-5 text-white shadow-2xl sm:p-6`}
      >
        {children}
      </div>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  };
  return [copied, copy];
}

export function RoomSummary({ room, countries }) {
  const regionLabel =
    room.config.mode === "country"
      ? countries?.find((c) => c.code === room.config.region)?.name
      : undefined;
  const parts = [
    describeRoomMode(room.config, { regionLabel }),
    `${room.roundsTotal} rounds`,
    `${timeLabel(room.config.time)} each`,
  ];
  if (room.config.game !== 'script' && !(room.config.move && room.config.pan && room.config.zoom))
    parts.push(movementLabel(room.config));
  if (room.config.provider && room.config.provider !== PRIMARY_PROVIDER)
    parts.push(PROVIDERS[room.config.provider]?.label || room.config.provider);
  return (
    <p className="text-sm text-white/70">
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-clay-300">
        {VARIANTS[room.variant]?.label || room.variant}
      </span>{" "}
      {parts.join(". ")}.
    </p>
  );
}

export function JoinPanel({ state, defaultName, onJoin, busy, error }) {
  const [name, setName] = useState(defaultName || "");
  useEffect(() => {
    if (defaultName && !name) setName(defaultName);
  }, [defaultName, name]);
  const room = state.room;
  const finished = room.status === "finished";
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
        Room {room.code}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{room.name}</h1>
      <div className="mt-2">
        <RoomSummary room={room} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <Users className="h-4 w-4" />
        {state.players.length}{" "}
        {state.players.length === 1 ? "player" : "players"}
        {state.players.length
          ? `: ${state.players.map((p) => p.name).join(", ")}`
          : ""}
      </p>
      {finished ? (
        <div className="mt-4">
          <p className="text-white/80">This game is over.</p>
          {room.rematchCode ? (
            <Link
              href={`/geo/room/${room.rematchCode}`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-clay-400 px-4 py-2 font-bold text-ocean-950 hover:bg-clay-300"
            >
              <RefreshCw className="h-4 w-4" />
              Join the rematch
            </Link>
          ) : null}
          <Link
            href="/geo/rooms"
            className="mt-3 ml-2 inline-block rounded-xl border border-white/20 px-4 py-2 font-semibold hover:bg-white/10"
          >
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
            className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-clay-500 focus:outline-none"
            style={{
              backgroundColor: "rgba(2, 6, 23, 0.85)",
              color: "#ffffff",
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-xl bg-clay-400 px-5 py-2.5 font-bold text-ocean-950 hover:bg-clay-300 disabled:opacity-50"
          >
            {busy ? "Joining" : room.status === "playing" ? "Rejoin" : "Join"}
          </button>
        </form>
      )}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {!finished && room.status === "playing" ? <p className="mt-3 text-sm text-white/70">Already playing? Use the same account to rejoin. New players can join the next game.</p> : null}
      <p className="mt-4 text-xs text-white/40">
        Not this room?{" "}
        <Link href="/geo/rooms" className="underline">
          Back to the room list
        </Link>
      </p>
    </Panel>
  );
}

export function LobbyPanel({
  state,
  countries,
  onStart,
  onLeave,
  busy,
  error,
}) {
  const [copied, copy] = useCopy();
  const room = state.room;
  const me = state.me;
  const ready = state.players.length >= 2;
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/geo/room/${room.code}`
      : `/geo/room/${room.code}`;
  return (
    <Panel wide>
      <div className="pe-party-heading">
        <p className="pe-eyebrow">
          {room.config?.game === 'script' ? 'Script multiplayer' : 'Street multiplayer'}
        </p>
        <h1>{ready ? "Ready to play" : "Invite a friend"}</h1>
        <p>
          {ready
            ? `${state.players.length} players have joined. ${me?.isHost ? "Start whenever you’re ready." : "Your host will start the game."}`
            : "Send an invite to a friend. Start when they join."}
        </p>
      </div>
      <div className="pe-party-invite">
        <div>
          <span>Share this room code</span>
          <strong>{room.code}</strong>
        </div>
        <button
          type="button"
          onClick={() => copy("link", link)}
          className="pe-button pe-button--primary inline-flex min-h-[48px] items-center gap-2 rounded-lg px-5 font-bold"
        >
          {copied === "link" ? <Check size={18} /> : <Link2 size={18} />}
          {copied === "link" ? "Invite link copied" : "Copy invite link"}
        </button>
        <button
          type="button"
          onClick={() => copy("code", room.code)}
          className="pe-copy-code"
        >
          {copied === "code" ? "Code copied" : "Copy code"}
        </button>
      </div>
      <div className="pe-party-roster">
        <h2>Who’s playing</h2>
        <PlayersPanel
          players={state.players}
          variant={room.variant}
          phase="lobby"
        />
        {!ready ? (
          <p className="pe-party-wait">
            <Users size={18} /> Waiting for someone to join your room
          </p>
        ) : null}
      </div>
      <div className="pe-party-rules">
        <strong>{VARIANTS[room.variant]?.label}</strong>
        <p>
          {room.variant === "duel"
            ? "Better guesses damage your rivals. Last player standing wins."
            : "Everyone guesses the same places. Highest total score wins."}
        </p>
        <RoomSummary room={room} countries={countries} />
      </div>
      {room.lastError || error ? (
        <p role="alert" className="mt-4 text-sm text-red-200">
          {error || room.lastError}
        </p>
      ) : null}
      <div className="pe-party-actions">
        {me?.isHost ? (
          <button
            type="button"
            disabled={busy || !ready}
            onClick={onStart}
            className="pe-button pe-button--primary inline-flex min-h-[50px] items-center gap-2 rounded-lg px-6 font-bold"
          >
            <Play size={18} />
            {busy ? "Starting…" : ready ? "Start game" : "Waiting for a player"}
          </button>
        ) : (
          <p>
            Waiting for{" "}
            {state.players.find((p) => p.isHost)?.name || "your host"} to start.
          </p>
        )}
        <button type="button" onClick={onLeave} className="pe-leave-room">
          Leave room
        </button>
      </div>
    </Panel>
  );
}

export function LoadingPanel({ state }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ocean-950/95 text-center text-white"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-9 w-9 animate-spin text-clay-300" />
      <p className="mt-4 text-lg font-semibold">
        Round{" "}
        {state.room.roundIndex + 2 > state.room.roundsTotal
          ? state.room.roundsTotal
          : state.room.roundIndex + 2}
      </p>
      <p className="mt-1 text-sm text-white/70">
        Finding a place with imagery for everyone
      </p>
    </div>
  );
}

/** Apple rooms: a browser is trying the places offered; the screen waits with it. */
export function LocatingPanel({ state, attempt = 0 }) {
  const total = state.locating?.candidates?.length || 0;
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ocean-950/95 text-center text-white"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-9 w-9 animate-spin text-clay-300" />
      <p className="mt-4 text-lg font-semibold">
        Round {state.room.roundIndex + 1} of {state.room.roundsTotal}
      </p>
      <p className="mt-1 text-sm text-white/70">
        Finding Look Around imagery for everyone
        {attempt
          ? `, place ${Math.min(attempt, total || attempt)} of ${total || "?"}`
          : ""}
      </p>
    </div>
  );
}

export function RevealPanel({ state, secondsLeft, onNext, onReact, busy }) {
  const { room, reveal, players, me } = state;
  const duel = room.variant === "duel";
  const outcome = roundOutcome(state);
  const mine = outcome.mine;
  const shownScore = useCountUp(mine?.score || 0, {
    key: room.roundIndex,
    delayMs: 120,
  });
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const answer = reveal?.answer;
  const place = [answer?.city, answer?.country?.name]
    .filter(Boolean)
    .join(", ");
  const last =
    room.roundIndex + 1 >= room.roundsTotal ||
    (duel && players.filter((p) => !p.eliminated).length <= 1);
  return (
    <div
      className="geo-reveal-panel pe-round-reveal absolute inset-x-0 bottom-0 z-40 max-h-[46%] overflow-y-auto text-white sm:max-h-[40%]"
      data-outcome={outcome.tone}
    >
      <div className="pe-reveal-inner">
        <div className="pe-reveal-heading">
          <div>
            <p className="pe-eyebrow">
              Round {room.roundIndex + 1} result
              {duel && reveal?.multiplier > 1
                ? ` · ${reveal.multiplier}× damage`
                : ""}
            </p>
            <h2>{outcome.title}</h2>
            <p className="pe-reveal-place">
              {reveal?.scriptAnswer ? `${reveal.scriptAnswer.name} · ${reveal.scriptAnswer.endonym}` : <>{answer?.country?.flag} {place || "Location revealed"}</>}
              {answer?.date ? <small> · Imagery {answer.date}</small> : null}
            </p>
          </div>
          {mine ? (
            <div
              className="pe-round-award"
              aria-label={`${formatScore(mine.score)} round points`}
            >
              <strong aria-hidden="true">
                +{formatScore(Math.round(shownScore))}
              </strong>
              <span>round points</span>
              <small>
                {mine.timedOut
                  ? "No guess submitted"
                  : `${formatDistance(mine.distanceKm)} away`}
                {duel
                  ? ` · ${mine.damage ? `−${formatScore(mine.damage)} HP` : "No damage taken"}`
                  : ""}
              </small>
            </div>
          ) : null}
          <div className="pe-reveal-next">
            <span>
              {last ? "Results" : "Next round"} in {secondsLeft}s
            </span>
            {me?.isHost && !room.config?.matchmaking ? (
              <button
                type="button"
                onClick={onNext}
                disabled={busy}
                className="pe-button pe-button--primary"
              >
                <SkipForward size={16} />
                {last ? "See results" : "Next round"}
              </button>
            ) : (
              <small>{room.config?.matchmaking ? 'The next round starts automatically' : 'Your host can continue early'}</small>
            )}
          </div>
        </div>
        <ol className="pe-round-standings" aria-label="This round’s results">
          {(reveal?.guesses || []).map((g, i) => {
            const player = byId[g.playerId];
            if (!player) return null;
            return (
              <li
                key={g.playerId}
                data-you={player.you || undefined}
                style={{ "--arrival": `${180 + i * 55}ms` }}
              >
                <span className="pe-round-place">
                  {g.rank === 1 && g.score > 0 ? (
                    <span aria-label="First place">✦</span>
                  ) : (
                    g.rank
                  )}
                </span>
                <PlayerBadge player={player} size="sm" />
                <div className="pe-round-player">
                  <strong>
                    {player.name}
                    {player.you ? <small>you</small> : null}
                  </strong>
                  {duel ? (
                    <HpBar
                      hp={player.hp}
                      damage={g.damage}
                      color={player.color}
                    />
                  ) : null}
                </div>
                <span className="pe-round-distance">
                  {g.timedOut ? "No guess" : formatDistance(g.distanceKm)}
                </span>
                <strong className="pe-round-points">
                  {formatScore(g.score)}
                  <small>pts</small>
                </strong>
                {duel ? (
                  <span
                    className="pe-round-damage"
                    data-damaged={g.damage > 0 || undefined}
                  >
                    {player.eliminated
                      ? "Out"
                      : g.damage
                        ? `−${formatScore(g.damage)} HP`
                        : "Safe"}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        {onReact ? (
          <div className="pe-reveal-reactions">
            <span>Give your rivals a reaction</span>
            <ReactionsBar
              onReact={onReact}
              disabled={busy}
              emoji={me?.reactions || REACTION_EMOJI}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MatchRating({ player }) {
  if (!player || !Number.isFinite(player.ratingDelta)) return null;
  const league = placedLeague(player);
  const delta = player.ratingDelta;
  return (
    <div className="pe-match-rating">
      <RankEmblem tier={league} />
      <div>
        <span>Your {league ? "league" : "placement"}</span>
        <strong>
          {league ||
            `${Math.min(player.rating?.games || 0, PROVISIONAL_GAMES)} of ${PROVISIONAL_GAMES} games`}
        </strong>
        <p>
          <b data-positive={delta >= 0}>
            {delta >= 0 ? "+" : ""}
            {delta} rating
          </b>
          {league && Number.isFinite(player.ratingAfter)
            ? ` · ${formatScore(player.ratingAfter)}`
            : ""}
        </p>
      </div>
    </div>
  );
}

function VictoryBurst() {
  return (
    <div className="pe-victory-burst" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <i
          key={i}
          style={{
            "--angle": `${i * 30}deg`,
            "--arrival": `${(i % 3) * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function StandingsPanel({ state, onRematch, onLeave, busy, error }) {
  const [copied, copy] = useCopy();
  const { room, players, me } = state;
  const duel = room.variant === "duel";
  const standings = matchStandings(players, room.variant);
  const winners = standings.filter((p) => p.placement === 1);
  const winner = winners[0] || standings[0];
  const shared = winners.length > 1;
  const hasWinner = winner && (duel ? winner.hp > 0 : winner.score > 0);
  const own = players.find((p) => p.you || p.id === me?.id);
  const won =
    hasWinner &&
    (shared ? winners.some((p) => p.id === own?.id) : winner.id === own?.id);
  const host = players.find((p) => p.isHost);
  const title = !hasWinner
    ? "Match complete."
    : shared
      ? "Draw"
      : won
        ? "You won"
        : `${winner.name} wins.`;
  const text = [
    `Probably Earth: ${VARIANTS[room.variant]?.label || room.variant}, ${room.roundsTotal} rounds.`,
    ...standings.map(
      (p, i) =>
        `${p.placement || i + 1}. ${p.name}: ${duel ? `${p.hp} HP` : `${formatScore(p.score)} points`}`,
    ),
  ].join("\n");
  return (
    <Panel wide>
      <div className="pe-match-finish" data-won={won || undefined}>
        <div className="pe-finish-hero">
          <div className="pe-finish-crest">
            {won ? <VictoryBurst /> : null}
            <VictoryCrest />
          </div>
          <div>
            <p className="pe-eyebrow">
              {VARIANTS[room.variant]?.label} · Final result
            </p>
            <h1>{title}</h1>
            <p>
              {hasWinner
                ? shared
                  ? winners.map((p) => p.name).join(" & ")
                  : duel
                    ? `${winner.name} finished with ${formatScore(winner.hp)} HP.`
                    : `${winner.name} scored ${formatScore(winner.score)} points.`
                : "Every round is in. Ready for another game?"}
            </p>
          </div>
        </div>
        <div className="pe-finish-next">
          <div className="pe-rematch-action">
            {room.rematchCode ? (
              <Link
                href={`/geo/room/${room.rematchCode}?name=${encodeURIComponent(me?.name || "")}`}
                className="pe-button pe-button--primary"
              >
                <RefreshCw size={18} />
                Join the rematch
              </Link>
            ) : me?.isHost ? (
              <button
                type="button"
                onClick={onRematch}
                disabled={busy}
                className="pe-button pe-button--primary"
              >
                <RefreshCw size={18} />
                {busy ? "Opening the next game…" : "Play again together"}
              </button>
            ) : (
              <p className="pe-rematch-wait">
                Waiting for {host?.name || "the host"} to open a rematch.
              </p>
            )}
            <small>
              {room.rematchCode
                ? "Your next room is ready."
                : room.config?.game === 'script' ? "Same settings, new sentences." : "Same settings, new places."}
            </small>
          </div>
          {room.config?.game !== 'script' ? <MatchRating player={own} /> : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <div className="pe-finish-board">
          <div className="pe-finish-board-heading">
            <h2>Final standings</h2>
            <span>{duel ? "Health remaining" : "Total points"}</span>
          </div>
          <ol>
            {standings.map((p, i) => (
              <li
                key={p.id}
                data-you={p.you || undefined}
                style={{ "--arrival": `${150 + i * 60}ms` }}
              >
                <span className="pe-finish-position">
                  {p.placement || i + 1}
                </span>
                <PlayerBadge player={p} size="lg" />
                <div className="pe-finish-player">
                  <PlayerName
                    name={p.name}
                    cosmetics={p.cosmetics}
                    you={p.you}
                  />
                  <span>
                    {room.config?.game === 'script' ? 'Script' : placedLeague(p) || "Placement games"}
                    {p.roundWins
                      ? ` · ${p.roundWins} round ${p.roundWins === 1 ? "win" : "wins"}`
                      : ""}
                  </span>
                </div>
                <div className="pe-finish-score">
                  <strong>
                    {formatScore(duel ? p.hp : p.score)}
                    <small>{duel ? "HP" : "pts"}</small>
                  </strong>
                  {Number.isFinite(p.ratingDelta) ? (
                    <span data-positive={p.ratingDelta >= 0}>
                      {p.ratingDelta >= 0 ? "+" : ""}
                      {p.ratingDelta} rating
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
        {own?.pointsEarned > 0 ? (
          <p className="pe-finish-earned">
            +{formatScore(own.pointsEarned)} cosmetic points earned{" "}
            <Link href="/geo/me">View your profile</Link>
          </p>
        ) : null}
        <div className="pe-finish-links">
          <button type="button" onClick={() => copy("text", text)}>
            {copied === "text" ? <Check size={16} /> : <Share2 size={16} />}{" "}
            {copied === "text" ? "Standings copied" : "Copy standings"}
          </button>
          <Link href="/geo/leaderboard">View rankings</Link>
          <button type="button" onClick={onLeave}>
            <LogOut size={16} />
            Leave room
          </button>
        </div>
        {!players.some((p) => Number.isFinite(p.ratingDelta)) ? (
          <p className="pe-unrated-note">
            {room.config?.game === 'script'
              ? 'Script matches do not change your Street rating.'
              : 'No rating change for this match. Two or more players with profiles are needed for rated play.'}
          </p>
        ) : null}
      </div>
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
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-ocean-900/80 p-1 backdrop-blur">
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
  const byId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );
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
    setShown((list) =>
      [...list, ...fresh.map((r) => ({ ...r, shownAt }))].slice(-6),
    );
    setTimeout(
      () =>
        setShown((list) => list.filter((r) => Date.now() - r.shownAt < 4000)),
      4200,
    );
  }, [reactions]);
  if (!shown.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-32 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      {shown.map((r, i) => {
        const p = byId[r.p];
        return (
          <div
            key={`${r.at}-${i}`}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-ocean-900/85 px-3 py-1 text-sm shadow-lg backdrop-blur"
          >
            <span className="text-lg">{r.e}</span>
            <span
              className="font-semibold"
              style={{ color: p?.color || "#fff" }}
            >
              {r.n}
            </span>
          </div>
        );
      })}
    </div>
  );
}
