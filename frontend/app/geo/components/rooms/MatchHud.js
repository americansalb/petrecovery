"use client";

import { Check, Swords, Trophy, X } from "lucide-react";
import { formatScore } from "@/app/lib/geo/distance";
import { TimerRing } from "../GameHud";
import { PlayerBadge, HpBar } from "./PlayersPanel";

/** Live, named opponents stay visible without obscuring the place being explored. */
export default function MatchHud({ state, secondsLeft, onLeave }) {
  const { room, players } = state;
  const duel = room.variant === "duel";
  const active = players.filter((p) => !p.eliminated);
  const locked = active.filter((p) => p.guessed).length;
  const guessing = room.phase === "guessing";
  const ordered = [...players].sort((a, b) => Number(b.you) - Number(a.you));
  return (
    <div className="pe-match-hud">
      <div className="pe-match-topline">
        <div className="pe-match-identity">
          {duel ? <Swords size={22} /> : <Trophy size={22} />}
          <div>
            <strong>{duel ? "Duel" : "Classic"}</strong>
            <span>{room.name}</span>
          </div>
        </div>
        <div className="pe-match-round">
          <span>
            Round <strong>{room.roundIndex + 1}</strong> / {room.roundsTotal}
          </span>
          <div className="pe-round-progress" aria-hidden="true">
            {Array.from({ length: room.roundsTotal }, (_, i) => (
              <span key={i} data-complete={i <= room.roundIndex} />
            ))}
          </div>
        </div>
        <div className="pe-match-clock">
          {guessing && Number.isFinite(secondsLeft) ? (
            <TimerRing secondsLeft={secondsLeft} total={room.config.time} />
          ) : (
            <span className="pe-match-phase">Round results</span>
          )}
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave the room"
            title="Leave the room"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      {guessing ? (
        <>
          <div
            className="pe-rivals"
            role="list"
            aria-label="Players in this match"
          >
            {ordered.map((p) => (
              <div
                className="pe-rival"
                role="listitem"
                key={p.id}
                data-you={p.you || undefined}
                data-out={p.eliminated || undefined}
                style={{ "--player-color": p.color }}
              >
                <PlayerBadge player={p} />
                <div className="pe-rival-info">
                  <div>
                    <strong>{p.name}</strong>
                    {p.you ? <small>You</small> : null}
                  </div>
                  <span
                    className="pe-rival-status"
                    data-locked={p.guessed || undefined}
                  >
                    {p.eliminated ? (
                      "Spectating"
                    ) : p.guessed ? (
                      <>
                        <Check size={12} /> Locked in
                      </>
                    ) : p.online === false ? (
                      "Away"
                    ) : (
                      "Finding a place"
                    )}
                  </span>
                  {duel ? <HpBar hp={p.hp} color={p.color} /> : null}
                </div>
                <span
                  className="pe-rival-value"
                  data-player={p.name}
                  data-player-hp={duel ? p.hp : undefined}
                >
                  {formatScore(duel ? p.hp : p.score)}
                  <small>{duel ? "HP" : "points"}</small>
                </span>
              </div>
            ))}
          </div>
          <p className="pe-match-locks" aria-live="polite">
            {locked} of {active.length} guesses locked in
          </p>
        </>
      ) : null}
    </div>
  );
}
