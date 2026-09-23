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
  DEFAULT_PLAYER_NAME,
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
  // A narrow panel is one card (joining, a message); a wide one is a
  // page of its own (the lobby, the final standings) and brings its own.
  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-pe-canvas px-4 py-12 sm:items-center sm:py-16">
      {wide ? (
        <div className="w-full max-w-2xl">{children}</div>
      ) : (
        <Card className="w-full max-w-md">{children}</Card>
      )}
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

export function RoomSummary({ room, chip = true }) {
  const parts = [
    describeRoomMode(room.config),
    `${room.roundsTotal} rounds`,
    `${timeLabel(room.config.time)} each`,
  ];
  if (room.config.game !== 'script' && !(room.config.move && room.config.pan && room.config.zoom))
    parts.push(movementLabel(room.config));
  if (room.config.provider && room.config.provider !== PRIMARY_PROVIDER)
    parts.push(PROVIDERS[room.config.provider]?.label || room.config.provider);
  return (
    <p className="text-sm text-pe-muted">
      {chip ? (
        <>
          <span className="rounded-full bg-pe-raised px-2 py-0.5 text-xs font-semibold text-pe-fg">
            {VARIANTS[room.variant]?.label || room.variant}
          </span>{" "}
        </>
      ) : null}
      {parts.join(". ")}.
    </p>
  );
}

export function JoinPanel({ state, defaultName, onJoin, busy, error }) {
  const room = state.room;
  const finished = room.status === "finished";
  const playing = room.status === "playing";
  // Somebody who followed a friend's invite link is here to play, not to
  // fill in a form. They play under their account's name, which is
  // theirs to change on their profile; the panel used to hold a name box
  // whose contents renamed the account (RoomClient, onJoin).
  const named = defaultName && defaultName !== DEFAULT_PLAYER_NAME;
  return (
    <Panel>
      <p className="text-sm font-medium text-pe-muted">Room {room.code}</p>
      <h1 className="ui-h2 mt-1">{room.name}</h1>
      <div className="mt-2">
        <RoomSummary room={room} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-pe-muted">
        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
        {state.players.length}{" "}
        {state.players.length === 1 ? "player" : "players"}
        {state.players.length
          ? `: ${state.players.map((p) => p.name).join(", ")}`
          : ""}
      </p>
      {finished ? (
        <div className="mt-6">
          <p className="text-pe-fg">This game is over.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {room.rematchCode ? (
              <Link href={`/geo/room/${room.rematchCode}`} className="ui-btn ui-btn--primary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Join the rematch
              </Link>
            ) : null}
            <Link href="/geo/rooms" className="ui-btn ui-btn--secondary">
              Back to Multiplayer
            </Link>
          </div>
        </div>
      ) : (
        <form
          method="post"
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin();
          }}
        >
          {named ? (
            <p className="text-sm text-pe-muted">
              You will play as{" "}
              <span className="font-semibold text-pe-fg">{defaultName}</span>.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
            autoFocus
          >
            {busy ? "Joining…" : playing ? "Rejoin" : "Join"}
          </button>
        </form>
      )}
      {error ? <p role="alert" className="ui-error mt-3">{error}</p> : null}
      {!finished && playing ? <p className="mt-3 text-sm text-pe-muted">Already playing? Use the same account to rejoin. New players can join the next game.</p> : null}
      <p className="mt-5 text-sm text-pe-subtle">
        Not this room?{" "}
        <Link href="/geo/rooms" className="font-medium text-pe-accent-fg hover:underline">
          Back to Multiplayer
        </Link>
      </p>
    </Panel>
  );
}

export function LobbyPanel({
  state,
  onStart,
  onLeave,
  busy,
  error,
}) {
  const [copied, copy] = useCopy();
  const room = state.room;
  const me = state.me;
  const ready = state.players.length >= 2;
  const host = state.players.find((p) => p.isHost);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/geo/room/${room.code}`
      : `/geo/room/${room.code}`;
  return (
    <Panel wide>
      <p className="text-sm font-medium text-pe-muted">
        {room.config?.game === "script" ? "Script multiplayer" : "Street multiplayer"}
        {" · "}
        {VARIANTS[room.variant]?.label || room.variant}
      </p>
      <h1 className="ui-h1 mt-1">{ready ? "Ready to play" : "Invite a friend"}</h1>
      <p className="ui-lead mt-2">
        {ready
          ? me?.isHost
            ? `${state.players.length} players are here. Start whenever you’re ready.`
            : `${state.players.length} players are here. ${host?.name || "Your host"} will start the game.`
          : "Send the link to a friend. You can start once they join."}
      </p>

      <Card className="mt-6">
        <p className="text-sm font-medium text-pe-muted">Room code</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
          <strong className="font-mono text-3xl font-bold tracking-[0.2em] text-pe-fg">
            {room.code}
          </strong>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy("link", link)}
              className="ui-btn ui-btn--primary"
            >
              {copied === "link" ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
              {copied === "link" ? "Invite link copied" : "Copy invite link"}
            </button>
            <button
              type="button"
              onClick={() => copy("code", room.code)}
              className="ui-btn ui-btn--secondary"
            >
              {copied === "code" ? "Code copied" : "Copy code"}
            </button>
          </div>
        </div>
      </Card>

      <section className="mt-6" aria-labelledby="lobby-players">
        <h2 id="lobby-players" className="ui-h2">
          Players <span className="text-pe-muted">({state.players.length})</span>
        </h2>
        <div className="mt-3">
          <PlayersPanel
            players={state.players}
            variant={room.variant}
            phase="lobby"
          />
        </div>
        {!ready ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-pe-muted">
            <Users size={16} aria-hidden="true" /> Waiting for someone to join
          </p>
        ) : null}
      </section>

      <section className="mt-6 border-t border-pe-line pt-5" aria-label="Rules">
        <p className="text-sm text-pe-fg">
          <span className="font-semibold">{VARIANTS[room.variant]?.label}.</span>{" "}
          {room.variant === "duel"
            ? "Better guesses damage your rivals. Last player standing wins."
            : "Everyone guesses the same places. Highest total score wins."}
        </p>
        <div className="mt-1">
          <RoomSummary room={room} chip={false} />
        </div>
      </section>

      {room.lastError || error ? (
        <p role="alert" className="ui-error mt-4">
          {error || room.lastError}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {me?.isHost ? (
          <button
            type="button"
            disabled={busy || !ready}
            onClick={onStart}
            className="ui-btn ui-btn--primary ui-btn--lg pe-button pe-button--primary"
          >
            <Play size={18} aria-hidden="true" />
            {busy ? "Starting…" : ready ? "Start game" : "Waiting for a player"}
          </button>
        ) : (
          <p className="text-pe-muted">
            Waiting for {host?.name || "your host"} to start.
          </p>
        )}
        <button type="button" onClick={onLeave} className="ui-btn ui-btn--ghost">
          Leave room
        </button>
      </div>
    </Panel>
  );
}

export function LoadingPanel({ state }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-pe-canvas/95 text-center text-pe-fg"
      role="status"
      aria-live="polite"
    >
      {/* The dark screen is there at once, so the last round does not
          show through it; what it says rises in. */}
      <div className="pe-swap flex flex-col items-center">
        <RefreshCw className="h-9 w-9 animate-spin text-pe-accent-fg" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">
          Round{" "}
          {state.room.roundIndex + 2 > state.room.roundsTotal
            ? state.room.roundsTotal
            : state.room.roundIndex + 2}
        </p>
        <p className="mt-1 text-sm text-pe-muted">
          Finding a place with imagery for everyone
        </p>
      </div>
    </div>
  );
}

/** Apple rooms: a browser is trying the places offered; the screen waits with it. */
export function LocatingPanel({ state, attempt = 0 }) {
  const total = state.locating?.candidates?.length || 0;
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-pe-canvas/95 text-center text-pe-fg"
      role="status"
      aria-live="polite"
    >
      <div className="pe-swap flex flex-col items-center">
        <RefreshCw className="h-9 w-9 animate-spin text-pe-accent-fg" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">
          Round {state.room.roundIndex + 1} of {state.room.roundsTotal}
        </p>
        <p className="mt-1 text-sm text-pe-muted">
          Finding Look Around imagery for everyone
          {attempt
            ? `, place ${Math.min(attempt, total || attempt)} of ${total || "?"}`
            : ""}
        </p>
      </div>
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
                className="ui-btn ui-btn--primary pe-button pe-button--primary"
              >
                <SkipForward size={16} />
                {last ? "See results" : "Next round"}
              </button>
            ) : (
              <small>{room.config?.matchmaking ? (last ? 'Final standings open automatically' : 'The next round starts automatically') : 'Your host can continue early'}</small>
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
            {room.config?.matchmaking ? (
              <Link
                href={`/geo/rooms?game=${room.config.game === 'script' ? 'script' : 'street'}`}
                className="ui-btn ui-btn--primary pe-button pe-button--primary"
              >
                <RefreshCw size={18} />
                Find another opponent
              </Link>
            ) : room.rematchCode ? (
              <Link
                href={`/geo/room/${room.rematchCode}?name=${encodeURIComponent(me?.name || "")}`}
                className="ui-btn ui-btn--primary pe-button pe-button--primary"
              >
                <RefreshCw size={18} />
                Join the rematch
              </Link>
            ) : me?.isHost ? (
              <button
                type="button"
                onClick={onRematch}
                disabled={busy}
                className="ui-btn ui-btn--primary pe-button pe-button--primary"
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
              {room.config?.matchmaking
                ? "Choose Find match to join the queue again."
                : room.rematchCode
                ? "Your next room is ready."
                : room.config?.game === 'script' ? "Same settings, new sentences." : "Same settings, new places."}
            </small>
          </div>
          <MatchRating player={own} />
        </div>
        {error ? (
          <p role="alert" className="ui-error mt-3">
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
                    {placedLeague(p) || "Placement games"}
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
          <Link href={room.config.game === 'script' ? '/geo/leaderboard?queue=script' : '/geo/leaderboard'}>View rankings</Link>
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
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-pe-canvas/75 p-1 shadow-lg backdrop-blur">
      {emoji.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => send(e)}
          disabled={disabled || cooldown}
          className="h-10 w-10 rounded-full text-lg transition hover:bg-white/10 disabled:opacity-50"
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
    // Each toast keeps one key for its whole life. It was keyed on its
    // place in the list, so when the oldest went every other toast got
    // a new key, was mounted again, and started its animation over.
    setShown((list) =>
      [
        ...list,
        ...fresh.map((r, j) => ({ ...r, shownAt, key: `${r.at}-${r.p}-${j}` })),
      ].slice(-6),
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
      {shown.map((r) => {
        const p = byId[r.p];
        return (
          <div
            key={r.key}
            className="pe-reaction flex items-center gap-1.5 rounded-full border border-white/15 bg-pe-canvas/85 px-3 py-1 text-sm shadow-lg backdrop-blur"
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
