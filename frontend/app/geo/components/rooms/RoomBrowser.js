"use client";

/**
 * The room browser: open a room, join one by code, or pick a public
 * room that is waiting for players.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Plus, Swords, Trophy, Users } from "lucide-react";
import {
  CONTINENTS,
  CONTINENT_ORDER,
  FORMATS,
  FORMAT_ORDER,
  MODES,
  PRIMARY_PROVIDER,
  formatSettings,
  timeLabel,
} from "@/app/lib/geo/modes";
import Button from "../ui/Button";
import {
  MAX_PLAYERS,
  ROOM_MODES,
  ROOM_ROUND_OPTIONS,
  ROOM_TIME_OPTIONS,
  VARIANTS,
  describeRoomStatus,
  normalizeRoomCode,
} from "@/app/lib/geo/rooms";
import {
  listRecentRooms,
  loadName,
  saveIdentity,
  saveName,
} from "../../lib/useRoom";
import { configErrorMessage, loadGeoConfig } from "../../lib/serverConfig";
import { ensureProfile, profileHeaders } from "../../lib/profile";
import { ago } from "../../lib/time";
import SetupNotice from "../SetupNotice";
import { APPLE_COVERAGE } from "@/app/lib/geo/coverage";

function Field({ label, hint, children }) {
  // The hint sits outside the label so the label reads as its name alone.
  return (
    <div className="text-sm">
      <label className="block">
        <span className="mb-1 block font-semibold text-white/80">{label}</span>
        {children}
      </label>
      {hint ? (
        <span className="mt-1 block text-xs text-white/60">{hint}</span>
      ) : null}
    </div>
  );
}

const select =
  "w-full rounded-xl border border-white/15 bg-ocean-900/60 px-3 py-2 text-sm";

export default function RoomBrowser({ initialVariant = "classic" }) {
  const router = useRouter();
  const [server, setServer] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({
    roomName: "",
    variant: initialVariant === "duel" ? "duel" : "classic",
    provider: PRIMARY_PROVIDER,
    mode: "balanced",
    continent: "europe",
    country: "US",
    rounds: 5,
    time: 60,
    format: "moving",
    visibility: "public",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setHydrated(true);
    setName(loadName());
    setRecent(listRecentRooms());
    let alive = true;
    loadGeoConfig({ shouldStop: () => !alive })
      .then((data) => alive && data && setServer(data))
      .catch((error) => alive && setError(configErrorMessage(error)));
    const load = () =>
      fetch("/api/geo/rooms", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("rooms"))))
        .then((data) => alive && setRooms(data.rooms || []))
        .catch(() => alive && setRooms((prev) => prev || []));
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const configured = Boolean(server?.providers?.apple?.configured);
  const modesFor = (provider) =>
    ROOM_MODES.filter((id) => MODES[id]?.providers?.includes(provider));
  const countries = server?.countries || [];
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const settings = useMemo(
    () => ({
      variant: form.variant,
      provider: form.provider,
      mode: form.mode,
      region:
        form.mode === "continent"
          ? form.continent
          : form.mode === "country"
            ? form.country
            : "",
      rounds: form.rounds,
      time: form.time,
      ...formatSettings(form.format),
      visibility: form.visibility,
    }),
    [form],
  );

  const create = async (event) => {
    event.preventDefault();
    const hostName = name.trim();
    if (!hostName) {
      setError("Type your name first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ensureProfile(hostName).catch(() => null);
      const res = await fetch("/api/geo/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...profileHeaders() },
        body: JSON.stringify({
          name: form.roomName.trim() || `${hostName}'s room`,
          hostName,
          settings,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not open the room");
      saveName(hostName);
      saveIdentity(json.code, {
        token: json.token,
        playerId: json.playerId,
        name: hostName,
      });
      router.push(`/geo/room/${json.code}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const joinByCode = (event) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      setError("A room code is six letters and numbers.");
      return;
    }
    if (name.trim()) saveName(name.trim());
    router.push(
      `/geo/room/${normalized}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`,
    );
  };

  return (
    <main className="pe-rooms-page pe-page">
      <header className="pe-rooms-heading">
        <div>
          <p className="pe-eyebrow">Play together · All modes free</p>
          <h1>
            Play with <em>friends.</em>
          </h1>
          <p>Pick a game. Create a room. Invite your friends.</p>
        </div>
        <form method="post" onSubmit={joinByCode} className="pe-join-inline">
          <label htmlFor="join-room-code">Already have a room code?</label>
          <div>
            <input
              id="join-room-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABC123"
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" aria-label="Join room">
              Join <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </header>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {server && !configured ? (
        <SetupNotice
          provider="apple"
          missing={server?.providers?.apple?.missing || []}
          compact
          tone="light"
        />
      ) : null}
      <div className="pe-rooms-layout">
        <form
          method="post"
          onSubmit={create}
          data-ready={hydrated ? "1" : "0"}
          className="pe-open-create"
        >
          <h2>What are we playing?</h2>
          <div className="pe-arena-choices" role="group" aria-label="Game">
            {Object.values(VARIANTS).map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={form.variant === v.id}
                onClick={() => update({ variant: v.id })}
                className={`pe-arena-choice pe-arena-choice--${v.id}`}
              >
                <span className="pe-arena-insignia" aria-hidden="true">
                  {v.id === "duel" ? (
                    <Swords size={48} strokeWidth={1.2} />
                  ) : (
                    <Trophy size={48} strokeWidth={1.2} />
                  )}
                </span>
                <span className="pe-arena-number">
                  {v.id === "duel" ? "02" : "01"}
                </span>
                <strong>{v.label}</strong>
                <small>
                  {v.id === "duel"
                    ? "Better guesses damage your rivals. Last player standing wins."
                    : "Everyone guesses the same places. Highest total score wins."}
                </small>
                <span className="pe-arena-selected">
                  {form.variant === v.id ? "Selected" : "Choose " + v.label}
                  <ArrowRight size={15} />
                </span>
              </button>
            ))}
          </div>
          <div className="pe-player-name">
            <span className="pe-avatar">
              <Compass size={25} />
            </span>
            <label htmlFor="host-name">
              Your player name
              <input
                id="host-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="What should we call you?"
                autoComplete="nickname"
              />
            </label>
          </div>
          <div className="pe-room-preset">
            {form.rounds} rounds · {timeLabel(form.time)} per round ·{" "}
            {FORMATS[form.format]?.label}
            <br />
            {form.visibility === "public"
              ? "Public room. Anyone can join."
              : "Private room. Only people with your code can join."}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={busy || !configured || !name.trim()}
          >
            <Plus size={18} />
            {busy
              ? "Creating your room…"
              : "Create " + VARIANTS[form.variant].label + " room"}
            <ArrowRight size={18} />
          </Button>
          <p className="pe-room-next">
            Next: you’ll get a link to invite your friends.
          </p>
          <details className="pe-custom-rules">
            <summary>Customize rules & privacy</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Room name">
                <input
                  type="text"
                  value={form.roomName}
                  onChange={(e) => update({ roomName: e.target.value })}
                  maxLength={40}
                  placeholder={name ? `${name}'s room` : "Friday night"}
                  className={select}
                />
              </Field>
              <Field label="Who can find it">
                <select
                  value={form.visibility}
                  onChange={(e) => update({ visibility: e.target.value })}
                  className={select}
                >
                  <option value="public">Anyone, listed here</option>
                  <option value="private">Only people with the code</option>
                </select>
              </Field>
              {/* There is one imagery, so there is no choice to offer.
                  The line says where a room will actually take people. */}
              <Field
                label="Places"
                hint={`City streets in ${APPLE_COVERAGE.size} countries.`}
              >
                <select
                  value={form.mode}
                  onChange={(e) => update({ mode: e.target.value })}
                  className={select}
                >
                  {modesFor(form.provider).map((id) => (
                    <option key={id} value={id}>
                      {MODES[id].label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.mode === "continent" ? (
                <div className="sm:col-span-2">
                  <Field label="Continent">
                    <select
                      value={form.continent}
                      onChange={(e) => update({ continent: e.target.value })}
                      className={select}
                    >
                      {CONTINENT_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {CONTINENTS[id].label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : form.mode === "country" ? (
                <div className="sm:col-span-2">
                  <Field label="Country">
                    <select
                      value={form.country}
                      onChange={(e) => update({ country: e.target.value })}
                      className={select}
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                          {!c.apple ? " (no city streets yet)" : ""}
                        </option>
                      ))}
                      {!countries.length ? (
                        <option value={form.country}>{form.country}</option>
                      ) : null}
                    </select>
                  </Field>
                </div>
              ) : null}
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field label="Rounds">
                  <select
                    value={form.rounds}
                    onChange={(e) => update({ rounds: Number(e.target.value) })}
                    className={select}
                  >
                    {ROOM_ROUND_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Time per round">
                  <select
                    value={form.time}
                    onChange={(e) => update({ time: Number(e.target.value) })}
                    className={select}
                  >
                    {ROOM_TIME_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {timeLabel(n)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Format" hint={FORMATS[form.format]?.description}>
                  <select
                    value={form.format}
                    onChange={(e) => update({ format: e.target.value })}
                    className={select}
                  >
                    {FORMAT_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {FORMATS[id].label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </details>
        </form>
        <aside className="pe-room-directory">
          <section>
            <div className="pe-directory-heading">
              <h2>Join a game</h2>
              <Users size={19} />
            </div>
            {rooms === null ? (
              <p className="pe-directory-note">Finding open rooms…</p>
            ) : null}
            {rooms && !rooms.length ? (
              <div className="pe-empty-rooms">
                <span className="pe-empty-orbits" aria-hidden="true">
                  <Compass size={35} />
                  <Users size={25} />
                </span>
                <h3>
                  The next game
                  <br />
                  starts with you.
                </h3>
                <p>
                  No public rooms are open right now. Create one and send the
                  invite link to a friend.
                </p>
              </div>
            ) : null}
            {rooms?.length ? (
              <ul className="pe-room-list">
                {rooms.map((room) => (
                  <li key={room.code}>
                    <div>
                      <strong>{room.name}</strong>
                      <span>
                        {VARIANTS[room.variant]?.label || room.variant} ·{" "}
                        {room.players}/{room.maxPlayers || MAX_PLAYERS} players
                      </span>
                      <small>{describeRoomStatus(room)}</small>
                    </div>
                    <Link
                      href={`/geo/room/${room.code}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`}
                    >
                      {room.status === "playing" && room.variant === "duel"
                        ? "Watch"
                        : "Join"}
                      <ArrowRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {recent.length ? (
            <section className="pe-recent-rooms">
              <h2>Recently played</h2>
              <ul className="pe-room-list">
                {recent.slice(0, 3).map((r) => (
                  <li key={r.code}>
                    <div>
                      <strong>{r.roomName || r.code}</strong>
                      <span>{ago(r.at)}</span>
                    </div>
                    <Link href={`/geo/room/${r.code}`}>
                      Return <ArrowRight size={15} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Link href="/geo" className="pe-solo-exit">
            Playing on your own?{" "}
            <strong>
              Solo games <ArrowRight size={16} />
            </strong>
          </Link>
        </aside>
      </div>
    </main>
  );
}
