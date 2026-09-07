'use client';

/**
 * The room browser: open a room, join one by code, or pick a public
 * room that is waiting for players.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, History, Plus, RefreshCw, Users } from 'lucide-react';
import { CONTINENTS, CONTINENT_ORDER, MODES, timeLabel } from '@/app/lib/geo/modes';
import { MAX_PLAYERS, ROOM_MODES, ROOM_ROUND_OPTIONS, ROOM_TIME_OPTIONS, VARIANTS, describeRoomStatus, normalizeRoomCode } from '@/app/lib/geo/rooms';
import { listRecentRooms, loadName, saveIdentity, saveName } from '../../lib/useRoom';
import { ensureProfile, profileHeaders } from '../../lib/profile';
import { ago } from '../../lib/time';
import SetupNotice from '../SetupNotice';

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-midnight-800">{label}</span>
      {children}
    </label>
  );
}

const select = 'w-full rounded-xl border border-midnight-300 bg-white px-3 py-2 text-sm';

export default function RoomBrowser() {
  const router = useRouter();
  const [server, setServer] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ roomName: '', variant: 'classic', mode: 'balanced', continent: 'europe', country: 'US', rounds: 5, time: 60, move: true, pan: true, zoom: true, visibility: 'public' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setHydrated(true);
    setName(loadName());
    setRecent(listRecentRooms());
    let alive = true;
    fetch('/api/geo/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
      .then((data) => alive && setServer(data))
      .catch(() => alive && setError('Could not load the game settings from the server.'));
    const load = () =>
      fetch('/api/geo/rooms', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('rooms'))))
        .then((data) => alive && setRooms(data.rooms || []))
        .catch(() => alive && setRooms((prev) => prev || []));
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const configured = Boolean(server?.providers?.google?.configured);
  const countries = server?.countries || [];
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const settings = useMemo(
    () => ({
      variant: form.variant,
      mode: form.mode,
      region: form.mode === 'continent' ? form.continent : form.mode === 'country' ? form.country : '',
      rounds: form.rounds,
      time: form.time,
      move: form.move,
      pan: form.pan,
      zoom: form.zoom,
      visibility: form.visibility,
    }),
    [form]
  );

  const create = async (event) => {
    event.preventDefault();
    const hostName = name.trim();
    if (!hostName) {
      setError('Type your name first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await ensureProfile(hostName).catch(() => null);
      const res = await fetch('/api/geo/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ name: form.roomName.trim() || `${hostName}'s room`, hostName, settings }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not open the room');
      saveName(hostName);
      saveIdentity(json.code, { token: json.token, playerId: json.playerId, name: hostName });
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
      setError('A room code is six letters and numbers.');
      return;
    }
    if (name.trim()) saveName(name.trim());
    router.push(`/geo/room/${normalized}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-midnight-50 text-midnight-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-midnight-500">
            <Link href="/geo" className="hover:underline">Where on Earth</Link>
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Rooms</h1>
          <p className="mt-1 text-sm text-midnight-500">
            Finished rooms count toward the <Link href="/geo/leaderboard" className="underline">rankings</Link>.
          </p>
          <p className="mt-2 max-w-2xl text-midnight-600">
            Everyone in a room gets the same places on the same clock. Classic counts points; a duel starts everyone at 6,000 HP and the best guess each round hurts the rest.
          </p>
        </header>

        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p> : null}
        {server && !configured ? (
          <div className="mt-6">
            <SetupNotice provider="google" missing={server?.providers?.google?.missing || []} compact tone="light" />
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-midnight-200 bg-white p-5">
          <Field label="Your name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="What the others will see" className="w-full max-w-sm rounded-xl border border-midnight-300 bg-white px-3 py-2 text-sm" />
          </Field>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <form method="post" onSubmit={create} data-ready={hydrated ? '1' : '0'} className="rounded-2xl border border-midnight-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
              <Plus className="h-4 w-4" />
              Open a room
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Room name">
                <input type="text" value={form.roomName} onChange={(e) => update({ roomName: e.target.value })} maxLength={40} placeholder={name ? `${name}'s room` : 'Friday night'} className={select} />
              </Field>
              <Field label="Who can find it">
                <select value={form.visibility} onChange={(e) => update({ visibility: e.target.value })} className={select}>
                  <option value="public">Anyone, listed here</option>
                  <option value="private">Only people with the code</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1 text-sm font-semibold text-midnight-800">Game</p>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Game">
                  {Object.values(VARIANTS).map((v) => (
                    <button key={v.id} type="button" role="radio" aria-checked={form.variant === v.id} onClick={() => update({ variant: v.id })} className={`rounded-xl border-2 p-3 text-left transition ${form.variant === v.id ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 hover:border-midnight-400'}`}>
                      <p className="font-semibold">{v.label}</p>
                      <p className="mt-0.5 text-xs text-midnight-600">{v.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Places">
                <select value={form.mode} onChange={(e) => update({ mode: e.target.value })} className={select}>
                  {ROOM_MODES.map((id) => (
                    <option key={id} value={id}>
                      {MODES[id].label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.mode === 'continent' ? (
                <Field label="Continent">
                  <select value={form.continent} onChange={(e) => update({ continent: e.target.value })} className={select}>
                    {CONTINENT_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CONTINENTS[id].label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : form.mode === 'country' ? (
                <Field label="Country">
                  <select value={form.country} onChange={(e) => update({ country: e.target.value })} className={select}>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                        {!c.google ? ' (no known imagery)' : ''}
                      </option>
                    ))}
                    {!countries.length ? <option value={form.country}>{form.country}</option> : null}
                  </select>
                </Field>
              ) : (
                <div />
              )}
              <Field label="Rounds">
                <select value={form.rounds} onChange={(e) => update({ rounds: Number(e.target.value) })} className={select}>
                  {ROOM_ROUND_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time per round">
                <select value={form.time} onChange={(e) => update({ time: Number(e.target.value) })} className={select}>
                  {ROOM_TIME_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {timeLabel(n)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1 text-sm font-semibold text-midnight-800">Movement</p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.move} onChange={(e) => update({ move: e.target.checked })} className="h-4 w-4 rounded border-midnight-300" /> Move</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.pan} onChange={(e) => update({ pan: e.target.checked })} className="h-4 w-4 rounded border-midnight-300" /> Pan</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.zoom} onChange={(e) => update({ zoom: e.target.checked })} className="h-4 w-4 rounded border-midnight-300" /> Zoom</label>
                  <button type="button" onClick={() => update({ move: false, pan: false, zoom: false })} className="rounded-lg border border-midnight-300 px-2 py-1 text-xs font-semibold hover:bg-midnight-100">
                    NMPZ
                  </button>
                </div>
              </div>
            </div>
            <button type="submit" disabled={busy || !configured} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-flash-400 px-5 py-2.5 font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-50">
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {busy ? 'Opening' : 'Open the room'}
            </button>
          </form>

          <aside className="space-y-6">
            <form method="post" onSubmit={joinByCode} className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight-500">Join with a code</h2>
              <div className="mt-3 flex gap-2">
                <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABC123" aria-label="Room code" className="w-full rounded-xl border border-midnight-300 bg-white px-3 py-2 font-mono text-lg tracking-[0.2em]" />
                <button type="submit" className="rounded-xl bg-midnight-900 px-4 py-2 font-semibold text-white hover:bg-midnight-800" aria-label="Join">
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </form>

            {recent.length ? (
              <section className="rounded-2xl border border-midnight-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                  <History className="h-4 w-4" />
                  Rooms you were in
                </h2>
                <ul className="mt-3 divide-y divide-midnight-100">
                  {recent.slice(0, 6).map((r) => (
                    <li key={r.code} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {r.roomName || 'Room'} <span className="font-mono text-xs text-midnight-500">{r.code}</span>
                        </p>
                        <p className="text-xs text-midnight-600">
                          {ago(r.at)}
                          {r.name ? `, as ${r.name}` : ''}
                        </p>
                      </div>
                      <Link href={`/geo/room/${r.code}`} className="rounded-lg border border-midnight-300 px-3 py-1.5 text-sm font-semibold hover:bg-midnight-100">
                        Return
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <Users className="h-4 w-4" />
                Open rooms
              </h2>
              {rooms === null ? <p className="mt-2 text-sm text-midnight-500">Looking</p> : null}
              {rooms && !rooms.length ? <p className="mt-2 text-sm text-midnight-600">No public rooms right now. Open one and share the code.</p> : null}
              {rooms && rooms.length ? (
                <ul className="mt-3 divide-y divide-midnight-100">
                  {rooms.map((room) => (
                    <li key={room.code} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {room.name} <span className="rounded-full bg-midnight-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-midnight-600">{VARIANTS[room.variant]?.label || room.variant}</span>
                        </p>
                        <p className="truncate text-xs text-midnight-600">
                          {room.mode}. {describeRoomStatus(room)}. {room.players} of {room.maxPlayers || MAX_PLAYERS} in.
                        </p>
                      </div>
                      <Link href={`/geo/room/${room.code}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`} className="rounded-lg bg-flash-400 px-3 py-1.5 text-sm font-bold text-midnight-900 hover:bg-flash-500">
                        {room.status === 'playing' && room.variant === 'duel' ? 'Watch' : 'Join'}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
