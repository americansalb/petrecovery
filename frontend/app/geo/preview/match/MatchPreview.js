"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import MatchHud from "../../components/rooms/MatchHud";
import { RevealPanel, StandingsPanel } from "../../components/rooms/RoomPanels";
import RankPath from "../../components/RankPath";
import "../../components/round.css";
import "./preview.css";

const PreviewMap = dynamic(
  () => import("../../components/script/LeafletScriptMap"),
  { ssr: false },
);
const SAMPLE_ANSWER = {
  name: "Porto",
  regions: [{ name: "Porto", lat: 41.1579, lng: -8.6291, radiusKm: 2 }],
};
const SAMPLE_GUESS = { lat: 41.27, lng: -8.64 };
const SAMPLE_LOCATION = { lat: 41.1579, lng: -8.6291 };

const NAMES = [
  "Alex",
  "Mira",
  "Jules",
  "Sam",
  "River",
  "Leo",
  "Nia",
  "Robin",
  "Kai",
  "Toni",
  "Ash",
  "Remy",
];
const COLORS = ["#c8dba0", "#e9ad88", "#8ecbd0", "#d8bf7e"];

export default function MatchPreview() {
  const [view, setView] = useState("results");
  const [variant, setVariant] = useState("duel");
  const [count, setCount] = useState(2);
  const [newPlayer, setNewPlayer] = useState(false);
  const [guest, setGuest] = useState(false);
  const [rematch, setRematch] = useState(false);
  const [lost, setLost] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: NAMES[i],
    color: COLORS[i % 4],
    you: i === 0,
    isHost: guest ? i === 1 : i === 0,
    online: true,
    guessed: i % 2 === 0,
    score: lost
      ? i === 1
        ? 23080
        : 17600 - i * 800
      : Math.max(500, 22480 - i * 2100),
    hp: lost ? (i === 0 ? 0 : 2800) : i === 0 ? 3800 : 0,
    eliminated: lost ? i === 0 : i > 0,
    rating: {
      tier: i === 0 ? "Gold" : "Silver",
      value: i === 0 ? 1742 : 1470,
      provisional: newPlayer,
      games: newPlayer ? 2 : 18,
    },
    ratingAfter: i === 0 ? 1742 : 1470,
    ratingDelta: i === 0 ? (lost ? -18 : 24) : i === 1 ? (lost ? 24 : -18) : 5,
    placement: lost ? (i === 0 ? 2 : i === 1 ? 1 : i + 1) : i + 1,
    roundWins: i === 0 ? 3 : 1,
    pointsEarned: i === 0 ? 35 : 15,
  }));
  const live = players.map((p, i) => ({
    ...p,
    hp: i === 0 ? 3800 : 2100,
    eliminated: false,
  }));
  const state = {
    room: {
      code: "PREVIEW",
      name: "Friday night",
      variant,
      status: view === "results" ? "finished" : "playing",
      phase: view === "round" ? "guessing" : "reveal",
      roundIndex: 3,
      roundsTotal: 5,
      rematchCode: rematch ? "PREVIEW" : null,
      config: {
        time: 60,
        mode: "balanced",
        provider: "apple",
        rounds: 5,
        move: true,
        pan: true,
        zoom: true,
      },
    },
    me: { id: "p0", name: "Alex", isHost: !guest },
    players: view === "round" ? live : players,
    reveal: {
      multiplier: 2,
      answer: {
        city: "Porto",
        country: { name: "Portugal", flag: "🇵🇹" },
        date: "2025",
      },
      guesses: players.map((p, i) => ({
        playerId: p.id,
        rank: lost ? (i === 1 ? 1 : i === 0 ? 2 : i + 1) : i + 1,
        score: lost ? (i === 1 ? 4880 : 2040) : i === 0 ? 4880 : 2640 - i * 70,
        distanceKm: i === 0 ? 12.4 : 230 + i * 80,
        damage:
          variant === "duel"
            ? lost
              ? i === 0
                ? 3800
                : 0
              : i === 0
                ? 0
                : 3600
            : 0,
        timedOut: false,
      })),
    },
  };
  return (
    <div className="pe-preview-shell">
      <header className="pe-preview-controls">
        <strong>DESIGN PREVIEW · SAMPLE PLAYERS</strong>
        <nav aria-label="Preview screen">
          {["round", "reveal", "results", "leagues"].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
        <select
          aria-label="Game type"
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
        >
          <option value="duel">Duel</option>
          <option value="classic">Classic</option>
        </select>
        <select
          aria-label="Player count"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        >
          {[2, 4, 12].map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={lost}
          onClick={() => setLost(!lost)}
        >
          Loss
        </button>
        <button
          type="button"
          aria-pressed={guest}
          onClick={() => setGuest(!guest)}
        >
          Guest
        </button>
        <button
          type="button"
          aria-pressed={newPlayer}
          onClick={() => setNewPlayer(!newPlayer)}
        >
          Unplaced
        </button>
        <button
          type="button"
          aria-pressed={urgent}
          onClick={() => setUrgent(!urgent)}
        >
          Low timer
        </button>
      </header>
      <div className="pe-preview-stage">
        <div className="pe-preview-landscape" aria-hidden="true" />
        {view === "round" || view === "reveal" ? (
          <MatchHud
            state={state}
            secondsLeft={urgent ? 8 : 28}
            onLeave={() =>
              setNote("Leave control works. This is a sample match.")
            }
          />
        ) : null}
        {view === "round" ? (
          <p className="pe-preview-caption">
            Illustrative scene. Live matches use Street imagery.
          </p>
        ) : null}
        {view === "reveal" ? (
          <>
            <div
              className="pe-preview-map"
              aria-label="Sample guess comparison"
            >
              <PreviewMap
                mode="result"
                answer={SAMPLE_ANSWER}
                guess={SAMPLE_GUESS}
                nearestPoint={SAMPLE_LOCATION}
              />
              <small>Sample location for layout review</small>
            </div>
            <RevealPanel
              state={state}
              secondsLeft={9}
              onNext={() => setView("results")}
              onReact={async (e) => setNote(`Reaction: ${e}`)}
              busy={false}
            />
          </>
        ) : null}
        {view === "results" ? (
          <StandingsPanel
            state={state}
            onRematch={() => setRematch(true)}
            onLeave={() => setView("round")}
            busy={false}
          />
        ) : null}
        {view === "leagues" ? (
          <div className="pe-preview-leagues">
            <p className="pe-eyebrow">Five leagues. A rank of your own.</p>
            <h1>Make your way up.</h1>
            <RankPath />
          </div>
        ) : null}
        {note ? (
          <button
            className="pe-preview-note"
            type="button"
            onClick={() => setNote("")}
          >
            {note} · Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
