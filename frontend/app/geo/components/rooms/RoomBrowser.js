"use client";

/**
 * The room browser: open a room, join one by code, or pick a public
 * room that is waiting for players.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Plus, Users } from "lucide-react";
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
  DEFAULT_PLAYER_NAME,
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
import AccountDialog from "../AccountDialog";
import Matchmaker from './Matchmaker';
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

const ROOM_DRAFT_KEY = "geo:pending-room:v1";
const ROOM_RECEIPT_KEY = "geo:created-room:v1";

function rememberDraft(draft) {
  try {
    window.localStorage.setItem(ROOM_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* A private browser can still use rooms, it just cannot resume a draft. */
  }
}

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(ROOM_DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    return draft && Date.now() - draft.savedAt < 86400000 ? draft : null;
  } catch {
    return null;
  }
}

function forgetDraft() {
  try {
    window.localStorage.removeItem(ROOM_DRAFT_KEY);
  } catch {
    /* Nothing to clear when browser storage is unavailable. */
  }
}

export default function RoomBrowser({ initialGame, resumeRequest }) {
  const router = useRouter();
  const [server, setServer] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({
    roomName: "",
    variant: "duel",
    game: initialGame === 'script' ? 'script' : 'street',
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
  const [signedIn, setSignedIn] = useState(null);
  const [accountGate, setAccountGate] = useState(false);
  const [searching, setSearching] = useState(false);
  const pendingAction = useRef(null);
  const requestId = useRef(null);
  const submitting = useRef(false);
  const continueRef = useRef(null);

  useEffect(() => {
    setHydrated(true);
    setName(loadName());
    setRecent(listRecentRooms());
    const draft = loadDraft();
    if (draft?.action) {
      pendingAction.current = draft.action;
      requestId.current = draft.requestId || null;
    }
    if (resumeRequest) {
      try {
        const receipt = JSON.parse(localStorage.getItem(ROOM_RECEIPT_KEY) || 'null');
        if (receipt?.requestId === resumeRequest && Date.now() - receipt.at < 86400000 && /^[A-Z0-9]{6}$/.test(receipt.code)) {
          router.push(`/geo/room/${receipt.code}`);
          return undefined;
        }
      } catch { /* The retained draft can still continue without a receipt. */ }
    }
    if (draft?.name) setName(draft.name);
    if (draft?.form) setForm((current) => ({ ...current, ...draft.form, game: initialGame || draft.form.game || 'street', variant: "duel" }));
    if (draft?.code) setCode(draft.code);
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (data) => {
        if (data?.signedIn) {
          const profile = await ensureProfile('').catch(() => null);
          if (profile?.name) { setName(profile.name); saveName(profile.name); }
        }
        setSignedIn(Boolean(data?.signedIn));
      })
      .catch(() => setSignedIn(false));
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
  }, [initialGame, resumeRequest, router]);

  useEffect(() => {
    if (signedIn && hydrated && pendingAction.current) continueRef.current?.();
  }, [signedIn, hydrated]);

  const configured = form.game === 'script' || Boolean(server?.providers?.apple?.configured);
  const modesFor = (provider) =>
    ROOM_MODES.filter((id) => MODES[id]?.providers?.includes(provider));
  const countries = server?.countries || [];
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const settings = useMemo(
    () => ({
      variant: form.variant,
      game: form.game,
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
    event?.preventDefault();
    if (searching || submitting.current) return;
    // Opening a room used to be refused until the host typed a name,
    // with the button dead until they did - and then it asked them to
    // sign in anyway, so there were two hurdles where the code needs
    // one. A guest who just wants to send a friend a link gets one
    // (founder, 2026-09-19: "WE don't make it easy"). Signing in fills
    // this from the account, so anybody who has a name keeps it, and
    // anybody who does not is a Player until they choose one.
    const hostName = name.trim() || DEFAULT_PLAYER_NAME;
    if (!signedIn) {
      requestId.current ||= crypto.randomUUID();
      pendingAction.current = 'create';
      rememberDraft({ name: hostName, form, action: 'create', requestId: requestId.current });
      setAccountGate(true);
      return;
    }
    requestId.current ||= crypto.randomUUID();
    submitting.current = true;
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
          requestId: requestId.current,
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
      try { localStorage.setItem(ROOM_RECEIPT_KEY, JSON.stringify({ requestId: requestId.current, code: json.code, at: Date.now() })); } catch { /* Optional cross-tab continuation. */ }
      forgetDraft();
      router.push(`/geo/room/${json.code}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      submitting.current = false;
    }
  };

  const joinByCode = (event) => {
    event?.preventDefault();
    if (searching) return;
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      setError("A room code is six letters and numbers.");
      return;
    }
    if (!signedIn) {
      pendingAction.current = 'join';
      rememberDraft({ name: name.trim(), form, code: normalized, action: 'join' });
      setAccountGate(true);
      return;
    }
    if (name.trim()) saveName(name.trim());
    forgetDraft();
    router.push(
      `/geo/room/${normalized}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`,
    );
  };

  continueRef.current = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action === 'create') create();
    else if (action === 'join') joinByCode();
  };

  return (
    <main className="pe-rooms-page pe-page">
      {accountGate ? (
        <AccountDialog
          onClose={() => {
            pendingAction.current = null;
            rememberDraft({ name, form, code });
            setAccountGate(false);
          }}
          name={name}
          onNameChange={(value) => {
            setName(value);
            saveName(value);
            rememberDraft({ name: value, form, code, action: pendingAction.current, requestId: requestId.current });
          }}
          returnTo={pendingAction.current === 'join' ? `/geo/room/${normalizeRoomCode(code)}` : `/geo/rooms?game=${form.game}&resumeRoom=${requestId.current}`}
          onAuthenticated={() => {
            setSignedIn(true);
            setAccountGate(false);
          }}
        />
      ) : null}
      <header className="pe-rooms-heading">
        <div>
          <p className="pe-eyebrow">Play together · All modes free</p>
          <h1>
            Multiplayer
          </h1>
          <p>Find an opponent, or invite your friends.</p>
        </div>
        <form method="post" onSubmit={joinByCode} className="pe-join-inline">
          <label htmlFor="join-room-code">Already have a room code?</label>
          <div>
            <input
              id="join-room-code"
              disabled={searching}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABC123"
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" aria-label="Join room" disabled={searching}>
              Join <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </header>
      <Matchmaker game={form.game} name={name} onNameChange={setName} onGameChange={(game) => update({ game })} onActiveChange={setSearching} />
      {searching ? <p className="pe-directory-note">Cancel your search before opening a different room.</p> : null}
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
          <fieldset disabled={searching} className="contents">
          <legend className="sr-only">Create a room</legend>
          <h2>Create a room</h2>
          <p className="text-sm text-white/70">Better guesses deal damage. Last player standing wins.</p>
          <div className="pe-rule-choice" role="group" aria-label="Game">
            {['street', 'script'].map((game) => <button key={game} type="button" aria-pressed={form.game === game} onClick={() => update({ game })}>{game === 'street' ? 'Street' : 'Script'}</button>)}
          </div>
          {form.game === 'script' ? <p className="text-sm text-white/70">Script matches do not change your Street rating.</p> : null}
          <div className="pe-player-name">
            <span className="pe-avatar">
              <Compass size={25} />
            </span>
            <label htmlFor="host-name">
              Your player name (optional)
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
            {form.rounds} rounds · {timeLabel(form.time)} per round
            {form.game !== 'script' ? ` · ${FORMATS[form.format]?.label}` : ''}
            <br />
            {form.visibility === "public"
              ? "Public room. Anyone can join."
              : "Private room. Only people with your code can join."}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={busy || !configured}
          >
            <Plus size={18} />
            {busy
              ? "Creating your room…"
              : "Create room"}
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
              {form.game !== 'script' ? <Field
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
              </Field> : null}
              {form.game !== 'script' && form.mode === "continent" ? (
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
              ) : form.game !== 'script' && form.mode === "country" ? (
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
                {form.game !== 'script' ? <Field label="Format" hint={FORMATS[form.format]?.description}>
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
                </Field> : null}
              </div>
            </div>
          </details>
          </fieldset>
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
              <div className="pe-empty-rooms pe-swap">
                <span className="pe-empty-orbits" aria-hidden="true">
                  <Compass size={35} />
                  <Users size={25} />
                </span>
                <h3>No open rooms</h3>
                <p>
                  No public rooms are open right now. Create one and send the
                  invite link to a friend.
                </p>
              </div>
            ) : null}
            {/* The list refreshes every four seconds. Rows are keyed on
                the room code, so a room that is already listed stays
                still and only a new one arrives. */}
            {rooms?.length ? (
              <ul className="pe-room-list pe-stagger">
                {rooms.map((room, i) => (
                  <li key={room.code} style={{ "--i": i }}>
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
                      aria-disabled={searching || undefined}
                      onClick={(event) => { if (searching) event.preventDefault(); }}
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
                    <Link href={`/geo/room/${r.code}`} aria-disabled={searching || undefined} onClick={(event) => { if (searching) event.preventDefault(); }}>
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
