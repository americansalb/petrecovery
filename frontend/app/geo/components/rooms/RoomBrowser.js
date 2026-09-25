"use client";

/**
 * The room browser: open a room, join one by code, or pick a public
 * room that is waiting for players.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import {
  FORMATS,
  FORMAT_ORDER,
  PRIMARY_PROVIDER,
  formatSettings,
  timeLabel,
} from "@/app/lib/geo/modes";
import Button from "../ui/Button";
import {
  DEFAULT_PLAYER_NAME,
  MAX_PLAYERS,
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

function Field({ label, hint, children }) {
  // The hint sits outside the label so the label reads as its name alone.
  return (
    <div className="ui-field">
      <label className="grid gap-2">
        <span className="ui-label">{label}</span>
        {children}
      </label>
      {hint ? <span className="ui-hint">{hint}</span> : null}
    </div>
  );
}

const select = "ui-input";

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

/** Script unless Street was asked for: Script is the game a page opens on (founder, 2026-09-25). */
const gameOf = (value) => (value === 'street' ? 'street' : 'script');

export default function RoomBrowser({ initialGame, resumeRequest }) {
  const router = useRouter();
  const [server, setServer] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({
    roomName: "",
    variant: "duel",
    game: gameOf(initialGame),
    provider: PRIMARY_PROVIDER,
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
    if (draft?.form) setForm((current) => ({ ...current, ...draft.form, game: gameOf(initialGame || draft.form.game), variant: "duel" }));
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
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const settings = useMemo(
    () => ({
      variant: form.variant,
      game: form.game,
      provider: form.provider,
      // A room is played on the whole of what is covered. The host used
      // to choose a continent or a country, from a list that showed what
      // is covered; that is kept secret (app/lib/geo/rooms.js).
      mode: "balanced",
      region: "",
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

  const game = form.game;
  const roomSummary = [
    `${form.rounds} rounds`,
    `${timeLabel(form.time)} each`,
    ...(game !== 'script' ? [FORMATS[form.format]?.label] : []),
    form.visibility === 'public' ? 'Public' : 'Private',
  ].filter(Boolean).join(' · ');

  return (
    <main className="ui-page">
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

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ui-h1">Multiplayer</h1>
          <p className="ui-lead mt-2">Play live against other people.</p>
        </div>
        <form method="post" onSubmit={joinByCode} className="ui-field sm:w-72">
          <label className="ui-label" htmlFor="join-room-code">Have a room code?</label>
          <div className="flex gap-2">
            <input
              id="join-room-code"
              className="ui-input font-mono uppercase tracking-[0.2em]"
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
            <button type="submit" className="ui-btn ui-btn--secondary shrink-0" aria-label="Join room" disabled={searching}>
              Join
            </button>
          </div>
        </form>
      </header>

      {/* One choice of game for the whole page. Quick match and a room
          each had their own Street/Script switch, side by side. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="ui-seg" role="group" aria-label="Game">
          {['script', 'street'].map((choice) => (
            <button key={choice} type="button" aria-pressed={game === choice} disabled={searching} onClick={() => update({ game: choice })}>
              {choice === 'street' ? 'Street' : 'Script'}
            </button>
          ))}
        </div>
        <p className="text-sm text-pe-muted">
          {game === 'script'
            ? 'Guess where a language is written. Does not change your Street rating.'
            : 'Guess where a street photo was taken.'}
        </p>
      </div>

      {error ? (
        <p role="alert" className="ui-error mt-4">
          {error}
        </p>
      ) : null}
      {server && !configured ? (
        <div className="mt-4">
          <SetupNotice
            provider="apple"
            missing={server?.providers?.apple?.missing || []}
            compact
            tone="light"
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Matchmaker game={form.game} name={name} onNameChange={setName} onGameChange={(choice) => update({ game: choice })} onActiveChange={setSearching} />

        <form
          method="post"
          onSubmit={create}
          data-ready={hydrated ? "1" : "0"}
          className="ui-card flex flex-col p-5 sm:p-6"
        >
          <fieldset disabled={searching} className="contents">
            <legend className="sr-only">Create a room</legend>
            <h2 className="ui-h2">Play with friends</h2>
            <p className="mt-1 text-sm text-pe-muted">
              Open a room and send the link. Everyone gets the same places; better guesses deal damage, and the last player standing wins.
            </p>
            <div className="pt-6">
              <Button type="submit" size="lg" block disabled={busy || !configured}>
                <Plus size={18} />
                {busy ? "Creating your room…" : "Create room"}
              </Button>
              <p className="mt-3 text-sm text-pe-muted">{roomSummary}</p>
            </div>
            {searching ? <p className="ui-small mt-2">Cancel your search before opening a room.</p> : null}
            <details className="mt-4 border-t border-pe-line pt-3">
              <summary className="cursor-pointer py-1 text-sm font-medium text-pe-accent-fg">Room settings</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <Field label="Who can join">
                  <select
                    value={form.visibility}
                    onChange={(e) => update({ visibility: e.target.value })}
                    className={select}
                  >
                    <option value="public">Anyone (listed below)</option>
                    <option value="private">Only people with the link</option>
                  </select>
                </Field>
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
                {game !== 'script' ? (
                  <Field label="Moving" hint={FORMATS[form.format]?.description}>
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
                ) : null}
              </div>
            </details>
          </fieldset>
        </form>
      </div>

      <section className="mt-10" aria-labelledby="open-rooms-title">
        <h2 id="open-rooms-title" className="ui-h2">Open rooms</h2>
        {rooms === null ? (
          <p className="ui-small mt-3">Finding open rooms…</p>
        ) : null}
        {rooms && !rooms.length ? (
          <p className="pe-swap mt-3 text-sm text-pe-muted">
            No open rooms right now. Create one above and send the link to a friend.
          </p>
        ) : null}
        {/* The list refreshes every four seconds. Rows are keyed on
            the room code, so a room that is already listed stays
            still and only a new one arrives. */}
        {rooms?.length ? (
          <ul className="pe-stagger ui-card mt-3 divide-y divide-pe-line overflow-hidden">
            {rooms.map((room, i) => (
              <li key={room.code} style={{ "--i": i }} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-semibold text-pe-fg">{room.name}</strong>
                  <span className="block text-sm text-pe-muted">
                    {VARIANTS[room.variant]?.label || room.variant} · {room.players}/{room.maxPlayers || MAX_PLAYERS} players · {describeRoomStatus(room)}
                  </span>
                </div>
                <Link
                  href={`/geo/room/${room.code}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`}
                  aria-disabled={searching || undefined}
                  onClick={(event) => { if (searching) event.preventDefault(); }}
                  className="ui-btn ui-btn--secondary ui-btn--sm shrink-0"
                >
                  {room.status === "playing" && room.variant === "duel" ? "Watch" : "Join"}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {recent.length ? (
        <section className="mt-10" aria-labelledby="recent-rooms-title">
          <h2 id="recent-rooms-title" className="ui-h2">Recently played</h2>
          <ul className="ui-card mt-3 divide-y divide-pe-line overflow-hidden">
            {recent.slice(0, 3).map((r) => (
              <li key={r.code} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-semibold text-pe-fg">{r.roomName || r.code}</strong>
                  <span className="block text-sm text-pe-muted">{ago(r.at)}</span>
                </div>
                <Link
                  href={`/geo/room/${r.code}`}
                  aria-disabled={searching || undefined}
                  onClick={(event) => { if (searching) event.preventDefault(); }}
                  className="ui-btn ui-btn--ghost ui-btn--sm shrink-0"
                >
                  Return <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
