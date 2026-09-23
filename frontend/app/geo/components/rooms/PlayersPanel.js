"use client";

/**
 * Who is in the room: a coloured badge with initials, the name, and
 * whatever matters in the current phase (points or HP, a tick once they
 * have guessed, a crown for the host, a dot for who is here right now).
 */

import { Crown } from "lucide-react";
import { initials } from "@/app/lib/geo/rooms";
import { formatScore } from "@/app/lib/geo/distance";
import PlayerName from "../PlayerName";
import RankEmblem from "../RankEmblem";
import { placedLeague } from "../../lib/matchPresentation";

export function PlayerBadge({ player, size = "md" }) {
  const dims =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
        ? "h-12 w-12 text-base"
        : "h-9 w-9 text-xs";
  return (
    <span
      className={`relative inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-pe-canvas`}
      style={{
        backgroundColor: player.color,
        opacity: player.eliminated ? 0.45 : 1,
        // A frame from the shop sits outside the ring.
        boxShadow: player.cosmetics?.frame
          ? `0 0 0 3px ${player.cosmetics.frame}`
          : undefined,
      }}
      title={player.name}
    >
      {initials(player.name)}
      {player.online === false ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-pe-subtle ring-2 ring-pe-canvas"
          title="Away"
        />
      ) : null}
    </span>
  );
}

export function HpBar({ hp, max = 6000, color, damage = 0 }) {
  const value = Math.max(0, Math.min(max, Number(hp) || 0));
  const pct = (value / max) * 100;
  const loss = Math.max(0, Math.min(max - value, damage));
  return (
    <div
      className="pe-hp-track"
      role="progressbar"
      aria-label="Health"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${value} HP`}
    >
      <span
        className="pe-hp-fill"
        style={{ width: `${pct}%`, backgroundColor: color || "rgb(var(--pe-good))" }}
      />
      {loss > 0 ? (
        <span
          className="pe-hp-loss"
          style={{ left: `${pct}%`, width: `${(loss / max) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/**
 * compact: a horizontal strip for the HUD. Otherwise a list.
 */
export default function PlayersPanel({
  players,
  variant = "classic",
  phase,
  compact = false,
}) {
  const isDuel = variant === "duel";
  if (phase === "lobby" && !compact) {
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-pe-line bg-pe-surface p-3">
            <PlayerBadge player={p} />
            <div className="min-w-0 flex-1">
              <PlayerName
                name={p.name}
                cosmetics={p.cosmetics}
                you={p.you}
                className="max-w-full font-semibold"
              />
              <span className="block text-xs text-pe-muted">
                {p.isHost ? "Host" : p.online === false ? "Away" : "Joined"}
              </span>
            </div>
            {p.isHost ? <Crown size={16} className="shrink-0 text-pe-warm" aria-label="Host" /> : null}
          </li>
        ))}
      </ul>
    );
  }
  if (compact) {
    return (
      <div className="flex max-w-[60vw] flex-wrap items-center justify-end gap-1.5">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1 rounded-full border border-white/15 bg-pe-canvas/80 py-0.5 pl-0.5 pr-2 backdrop-blur"
            title={`${p.name}: ${isDuel ? `${p.hp} HP` : `${formatScore(p.score)} points`}`}
          >
            <PlayerBadge player={p} size="sm" />
            <span
              className={`text-xs font-semibold ${p.you ? "text-pe-warm" : "text-white"}`}
              data-player={p.name}
              data-player-hp={isDuel ? p.hp : undefined}
            >
              {isDuel ? p.hp : formatScore(p.score)}
            </span>
            {phase === "guessing" ? (
              <span
                className={`text-xs ${p.guessed ? "text-pe-good" : "text-white/30"}`}
                aria-label={p.guessed ? "guessed" : "still guessing"}
              >
                {p.guessed ? "✓" : "·"}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-pe-line">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2">
          <PlayerBadge player={p} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <PlayerName
                name={p.name}
                cosmetics={p.cosmetics}
                you={p.you}
                className={`font-semibold ${p.you && !p.cosmetics?.color ? "text-pe-warm" : "text-pe-fg"}`}
              />
              {p.isHost ? (
                <Crown
                  className="h-3.5 w-3.5 text-pe-warm"
                  aria-label="Host"
                />
              ) : null}
              {p.eliminated ? (
                <span className="rounded-full bg-pe-bad/20 px-1.5 text-[10px] font-bold uppercase text-pe-bad">
                  out
                </span>
              ) : null}
              {p.online === false ? (
                <span className="text-[10px] uppercase tracking-wide text-pe-subtle">
                  away
                </span>
              ) : null}
            </div>
            {p.rating ? (
              <div className="text-[11px] text-pe-muted">
                {/* 1500 is where everyone starts, not something earned.
                    "Silver 1500 (provisional)" beside a player who has
                    never been rated reads as a rank they hold, which is
                    the same thing the rankings page was fixed for
                    (founder, 2026-09-17). */}
                {placedLeague(p) ? (
                  <span className="pe-player-league">
                    <RankEmblem tier={placedLeague(p)} decorative />
                    {p.rating.tier} {p.rating.value}
                  </span>
                ) : (
                  "Placement games"
                )}
              </div>
            ) : p.rated === false ? (
              <div className="text-[11px] text-pe-subtle">unrated</div>
            ) : null}
            {isDuel ? (
              <div className="mt-1 w-40 max-w-full">
                <HpBar hp={p.hp} color={p.color} />
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <div
              className="font-semibold tabular-nums text-pe-fg"
              data-player={p.name}
              data-player-hp={isDuel ? p.hp : undefined}
            >
              {isDuel ? `${p.hp} HP` : formatScore(p.score)}
            </div>
            {phase === "finished" && Number.isFinite(p.ratingDelta) ? (
              <div
                className={`text-[11px] font-semibold tabular-nums ${p.ratingDelta >= 0 ? "text-pe-good" : "text-pe-bad"}`}
              >
                {p.ratingDelta >= 0 ? "+" : ""}
                {p.ratingDelta} rating
              </div>
            ) : null}
            {!isDuel && p.roundWins ? (
              <div className="text-[11px] text-pe-muted">
                {p.roundWins} round {p.roundWins === 1 ? "win" : "wins"}
              </div>
            ) : null}
            {phase === "guessing" ? (
              <div
                className={`text-[11px] ${p.guessed ? "text-pe-good" : "text-pe-subtle"}`}
              >
                {p.guessed ? "guessed" : "thinking"}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
