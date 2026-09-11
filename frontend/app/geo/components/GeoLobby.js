'use client';

/**
 * The lobby: provider, mode, rules, start. Also the daily challenge,
 * your local stats, and a plain explanation of how the random spot is
 * found. Settings are remembered in this browser.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Gauge, Medal, Play, Trophy, Users } from 'lucide-react';
import {
  CONTINENTS,
  CONTINENT_ORDER,
  FORMATS,
  FORMAT_ORDER,
  MODES,
  MODE_ORDER,
  PROVIDERS,
  RADIUS_PRESETS,
  ROUND_OPTIONS,
  TIME_OPTIONS,
  configToParams,
  formatOf,
  formatSettings,
  normalizeConfig,
  timeLabel,
} from '@/app/lib/geo/modes';
import { randomSeedString } from '@/app/lib/geo/random';
import { isSignedIn } from '@/app/geo/lib/session';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { getHistory, getStats } from '../lib/storage';
import { ensureProfile, loadProfileToken, profileHeaders } from '../lib/profile';
import { listRecentRooms, loadName } from '../lib/useRoom';
import { ago } from '../lib/time';
import { DEFAULT_LIMITS, allowanceText, roomGamesText, untilText } from '@/app/lib/geo/meter';
import { APPLE_COVERAGE, appleCoverageSentence } from '@/app/lib/geo/coverage';
import SetupNotice from './SetupNotice';
import PlayerName from './PlayerName';

const SETTINGS_KEY = 'geo:lobby:v1';

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function ordinal(n) {
  const v = Number(n) || 0;
  const suffix = ['th', 'st', 'nd', 'rd'];
  const mod = v % 100;
  return `${v}${suffix[(mod - 20) % 10] || suffix[mod] || suffix[0]}`;
}

function Segmented({ options, value, onChange, label, format = (v) => String(v), disabled }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-midnight-500">{label}</p>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-midnight-100 p-1" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${value === option ? 'bg-midnight-900 text-white shadow' : 'text-midnight-700 hover:bg-white'}`}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GeoLobby() {
  const router = useRouter();
  const [server, setServer] = useState(null);
  const [serverError, setServerError] = useState('');
  const [provider, setProvider] = useState('google');
  const [mode, setMode] = useState('world');
  const [continent, setContinent] = useState('europe');
  const [country, setCountry] = useState('JP');
  const [rounds, setRounds] = useState(5);
  const [time, setTime] = useState(0);
  const [move, setMove] = useState(true);
  const [pan, setPan] = useState(true);
  const [zoom, setZoom] = useState(true);
  const [radius, setRadius] = useState('standard');
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [restored, setRestored] = useState(false);
  const [profile, setProfile] = useState(null);
  const [recentRooms, setRecentRooms] = useState([]);
  const [daily, setDaily] = useState(null);
  const [cup, setCup] = useState(null);


  useEffect(() => {
    let alive = true;
    fetch('/api/geo/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
      .then((data) => alive && setServer(data))
      .catch(() => alive && setServerError('Could not load the game settings from the server.'));
    setStats(getStats());
    setHistory(getHistory().slice(0, 8));
    setRecentRooms(listRecentRooms());
    fetch('/api/geo/daily', { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('daily'))))
      .then((data) => alive && setDaily(data))
      .catch(() => {});
    fetch('/api/geo/cup', { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('cup'))))
      .then((data) => alive && setCup(data))
      .catch(() => {});
    const saved = loadSettings();
    if (saved) {
      const c = normalizeConfig(saved);
      setProvider(c.provider);
      setMode(c.mode);
      if (c.mode === 'continent') setContinent(c.region);
      if (c.mode === 'country') setCountry(c.region);
      setRounds(c.rounds || 5);
      setTime(c.time);
      setMove(c.move);
      setPan(c.pan);
      setZoom(c.zoom);
      setRadius(c.radius);
    }
    setRestored(true);
    return () => {
      alive = false;
    };
  }, []);

  // Your rating: this browser gets a profile the first time it joins a
  // room, and a WanderGuesser account has one across devices. Nobody
  // else needs a row for looking at the lobby.
  useEffect(() => {
    // A visitor who has never played and is not signed in gets no row.
    if (!loadProfileToken() && !isSignedIn()) return undefined;
    let alive = true;
    ensureProfile(loadName())
      .then((p) => alive && setProfile(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const config = useMemo(
    () =>
      normalizeConfig({
        provider,
        mode,
        region: mode === 'continent' ? continent : mode === 'country' ? country : '',
        rounds,
        time,
        move,
        pan,
        zoom,
        radius,
      }),
    [provider, mode, continent, country, rounds, time, move, pan, zoom, radius]
  );

  useEffect(() => {
    if (restored) saveSettings({ ...config, seed: '' });
  }, [config, restored]);

  // Keep the mode valid when the provider changes.
  useEffect(() => {
    if (!MODES[mode].providers.includes(provider)) {
      setMode(MODE_ORDER.find((id) => MODES[id].providers.includes(provider)));
    }
  }, [provider, mode]);

  const providerInfo = server?.providers?.[provider];
  const configured = Boolean(providerInfo?.configured);
  const countries = server?.countries || [];
  const modeDef = MODES[config.mode];
  const fixed = config.mode === 'daily' || config.mode === 'cup';
  // Kidnapped fixes the clock and the drive; rounds and the radius stay yours.
  const driven = config.mode === 'kidnapped';
  const format = formatOf(config);
  const setFormat = (id) => {
    const f = formatSettings(id);
    setMove(f.move);
    setPan(f.pan);
    setZoom(f.zoom);
  };

  const start = (overrides = {}) => {
    const c = normalizeConfig({ ...config, ...overrides });
    const seed = c.mode === 'daily' ? c.seed : randomSeedString();
    router.push(`/geo/play?${configToParams({ ...c, seed }).toString()}`);
  };

  return (
    <div className="min-h-screen bg-midnight-50 text-midnight-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">WanderGuesser</h1>
            <p className="mt-2 max-w-2xl text-midnight-600">
              You are dropped at a random spot with street-level imagery. Look around, then put a pin on the map. Up to 5,000 points a round, depending on how close you are.
            </p>
          </div>
          <button
            type="button"
            onClick={() => start()}
            disabled={!configured}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-flash-400 px-6 py-3 text-base font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-5 w-5" />
            Play
          </button>
        </header>

        {serverError ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{serverError}</p> : null}
        {server && !configured ? (
          <div className="mt-6">
            <SetupNotice provider={provider} missing={providerInfo?.missing || []} compact tone="light" />
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            {/* Provider */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight-500">Imagery</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.values(PROVIDERS).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    aria-pressed={provider === p.id}
                    className={`rounded-xl border-2 p-3 text-left transition ${provider === p.id ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 hover:border-midnight-400'}`}
                  >
                    <p className="font-semibold">
                      {p.label}
                      {p.beta ? <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${provider === p.id ? 'bg-flash-400 text-midnight-900' : 'bg-midnight-100 text-midnight-600'}`}>beta</span> : null}
                    </p>
                    <p className={`mt-0.5 text-sm ${provider === p.id ? 'text-white/75' : 'text-midnight-600'}`}>{p.description}</p>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-midnight-600">
                Apple Look Around covers city streets in {APPLE_COVERAGE.size} countries: {appleCoverageSentence()}.
              </p>
            </section>

            {/* Mode */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight-500">Mode</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mode">
                {MODE_ORDER.filter((id) => MODES[id].providers.includes(provider)).map((id) => {
                  const m = MODES[id];
                  const active = mode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMode(id)}
                      className={`rounded-xl border-2 p-3 text-left transition ${active ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 hover:border-midnight-400'}`}
                    >
                      <p className="font-semibold">{m.label}</p>
                      <p className="mt-0.5 text-sm text-midnight-600">{m.description}</p>
                    </button>
                  );
                })}
              </div>
              {modeDef.needs === 'continent' ? (
                <label className="mt-4 block text-sm">
                  <span className="mb-1 block font-semibold">Continent</span>
                  <select value={continent} onChange={(e) => setContinent(e.target.value)} className="w-full max-w-xs rounded-xl border border-midnight-300 bg-white px-3 py-2">
                    {CONTINENT_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CONTINENTS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {modeDef.needs === 'country' ? (
                <label className="mt-4 block text-sm">
                  <span className="mb-1 block font-semibold">Country</span>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full max-w-xs rounded-xl border border-midnight-300 bg-white px-3 py-2">
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                        {!c.google ? ' (no known imagery)' : ''}
                      </option>
                    ))}
                    {!countries.length ? <option value={country}>{country}</option> : null}
                  </select>
                </label>
              ) : null}
            </section>

            {/* Rules */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-midnight-500">Rules</h2>
              {fixed || driven ? (
                <p className="mt-2 text-sm text-midnight-600">
                  {config.mode === 'cup'
                    ? 'The weekly cup uses fixed rules so scores compare: 10 rounds, 60 seconds each, No Move.'
                    : config.mode === 'daily'
                      ? 'The daily challenge uses fixed rules so scores compare: 5 rounds, no timer, Moving.'
                      : 'Kidnapped has its own clock: three minutes a round. The car drives; you can look around but not steer or zoom. Guess whenever you like.'}
                </p>
              ) : null}
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                {config.mode !== 'streak' ? <Segmented label="Rounds" options={ROUND_OPTIONS} value={config.rounds} onChange={setRounds} disabled={fixed} /> : null}
                <Segmented label="Time per round" options={TIME_OPTIONS} value={config.time} onChange={setTime} format={timeLabel} disabled={fixed || driven} />
                <div>
                  <Segmented label="Format" options={FORMAT_ORDER} value={format} onChange={setFormat} format={(id) => FORMATS[id].label} disabled={fixed || driven} />
                  <p className="mt-1.5 text-xs text-midnight-600">{driven ? 'Driven: no steering, look around, no zoom.' : FORMATS[format].description}</p>
                </div>
                {config.provider === 'google' && config.mode !== 'cities' ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-midnight-500">How random</p>
                    <div className="space-y-1">
                      {Object.values(RADIUS_PRESETS).map((preset) => (
                        <label key={preset.id} className={`flex cursor-pointer items-start gap-2 text-sm ${fixed ? 'opacity-50' : ''}`}>
                          <input type="radio" name="radius" checked={config.radius === preset.id} disabled={fixed} onChange={() => setRadius(preset.id)} className="mt-1 text-midnight-900 focus:ring-flash-400" />
                          <span>
                            <span className="font-semibold">{preset.label}</span> <span className="text-midnight-600">{preset.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => start()}
                disabled={!configured}
                className="inline-flex items-center gap-2 rounded-xl bg-flash-400 px-6 py-3 text-base font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-5 w-5" />
                Play {modeDef.short.toLowerCase()}
              </button>
              <p className="text-sm text-midnight-600">Every game gets a seed. After it ends you can send a link that plays the same places.</p>
            </div>
          </div>

          <aside className="space-y-6">
            {/* Rooms */}
            <section className="rounded-2xl border border-midnight-900 bg-midnight-900 p-5 text-white">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                <Users className="h-4 w-4" />
                Play with friends
              </h2>
              <p className="mt-2 text-sm text-white/80">Open a room, share the code, and everyone guesses the same places on one clock. Classic scoring or a duel with HP. One room a day on Google Street View is free; rooms on Apple Look Around are free without limit.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/geo/rooms" className="inline-flex items-center gap-2 rounded-xl bg-flash-400 px-4 py-2 text-sm font-bold text-midnight-900 hover:bg-flash-500">
                  <Users className="h-4 w-4" />
                  Rooms
                </Link>
                <Link href="/geo/leaderboard" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                  <Trophy className="h-4 w-4" />
                  Rankings
                </Link>
              </div>
              {recentRooms.length ? (
                <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm" aria-label="Rooms you were in">
                  {recentRooms.slice(0, 4).map((r) => (
                    <li key={r.code}>
                      <Link href={`/geo/room/${r.code}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/10">
                        <span className="truncate">
                          {r.roomName || 'Room'} <span className="font-mono text-white/60">{r.code}</span>
                        </span>
                        <span className="shrink-0 text-xs text-white/60">{ago(r.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {/* Rating */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <Medal className="h-4 w-4" />
                Your rating
              </h2>
              {profile ? (
                <>
                  <p className="mt-2 text-sm text-midnight-700">
                    <span className="font-semibold text-midnight-900" style={profile.equipped?.color ? { color: profile.equipped.color } : undefined}>
                      {profile.name || 'Player'}
                    </span>
                    {profile.equipped?.title ? <span className="ml-1.5 rounded-full bg-midnight-100 px-1.5 text-[10px] font-bold uppercase tracking-wide text-midnight-600">{profile.equipped.title}</span> : null}
                    {profile.signedIn ? ', on your account' : ', in this browser'}
                  </p>
                  <p className="mt-1 text-sm text-midnight-700">
                    <span className="font-semibold text-midnight-900">{formatScore(profile.points || 0)}</span> points
                    {profile.badges?.length ? `, ${profile.badges.length} country ${profile.badges.length === 1 ? 'badge' : 'badges'}` : ''}.{' '}
                    <Link href="/geo/me" className="underline">
                      Profile and shop
                    </Link>
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    {['classic', 'duel'].map((ladder) => {
                      const r = profile.ratings?.[ladder] || {};
                      return (
                        <div key={ladder}>
                          <dt className="text-midnight-500">{VARIANTS[ladder]?.label || ladder}</dt>
                          <dd className="text-lg font-bold tabular-nums">
                            {r.value ?? 1500} <span className="text-xs font-semibold text-midnight-500">{r.tier || 'Silver'}</span>
                          </dd>
                          <dd className="text-xs text-midnight-500">
                            {r.games || 0} rated {r.games === 1 ? 'game' : 'games'}
                            {r.provisional ? ', provisional' : ''}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {profile.recent?.length ? (
                    <ul className="mt-3 divide-y divide-midnight-100 text-sm">
                      {profile.recent.slice(0, 5).map((g) => (
                        <li key={g.roomId} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="truncate text-midnight-700">
                            {VARIANTS[g.ladder]?.label || g.ladder}, {ordinal(g.placement)} of {g.players}
                          </span>
                          <span className={`font-semibold tabular-nums ${g.delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {g.delta >= 0 ? '+' : ''}
                            {g.delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-midnight-600">No rated games yet. A room counts once it finishes with two or more rated players.</p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-midnight-600">
                  Every round earns points, a guess within 100 km earns the country&apos;s badge, and rooms are rated. Your rating, points and badges show here and on the{' '}
                  <Link href="/geo/me" className="underline">
                    profile
                  </Link>
                  .
                </p>
              )}
            </section>

            {/* Today's meter */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <Gauge className="h-4 w-4" />
                Today
              </h2>
              {profile?.usage ? (
                <>
                  <p className="mt-2 text-sm text-midnight-700">
                    <span className="font-semibold text-midnight-900">
                      {profile.usage.google.freeUsed} of {profile.usage.google.freeLimit}
                    </span>{' '}
                    free Google Street View rounds used.
                    {profile.usage.google.paidLeft ? ` ${profile.usage.google.paidLeft} bought rounds left.` : ''}
                  </p>
                  <p className="mt-1 text-sm text-midnight-700">{roomGamesText(profile.usage.google.roomGames)}</p>
                  <p className="mt-1 text-sm text-midnight-600">Apple Look Around: no limit. The daily challenge and the weekly cup do not count.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-midnight-600">{allowanceText({ ...DEFAULT_LIMITS, ...(server?.limits || {}) })}</p>
              )}
            </section>

            {/* Daily */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <CalendarDays className="h-4 w-4" />
                Daily challenge
              </h2>
              <p className="mt-2 text-sm text-midnight-700">Five places, the same for everyone{server?.daily?.date ? ` on ${server.daily.date}` : ' today'}. Free, and it does not count against your Google rounds.</p>
              <button
                type="button"
                onClick={() => start({ mode: 'daily', provider: 'google' })}
                disabled={!server?.providers?.google?.configured}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-midnight-900 px-4 py-2 text-sm font-semibold text-white hover:bg-midnight-800 disabled:opacity-50"
              >
                {stats?.dailyPlayed ? <Check className="h-4 w-4 text-flash-400" /> : <Play className="h-4 w-4" />}
                {stats?.dailyPlayed ? 'Play today again' : "Play today's five"}
              </button>
              {daily ? (
                <div className="mt-4 border-t border-midnight-100 pt-3" data-daily-board>
                  <p className="text-sm text-midnight-700">
                    {daily.you?.rank
                      ? `You are ${ordinal(daily.you.rank)} of ${daily.finished} who finished today.`
                      : daily.you
                        ? `Your ${daily.you.rounds} of ${daily.rounds} rounds are in.`
                        : daily.finished
                          ? `${daily.finished} finished today's five so far.`
                          : 'Nobody has finished today yet. Be first.'}
                  </p>
                  {daily.board?.length ? (
                    <ol className="mt-2 space-y-0.5 text-sm">
                      {daily.board.slice(0, 5).map((row) => (
                        <li key={row.profileId} className="flex items-center gap-2">
                          <span className="w-5 tabular-nums text-midnight-400">{row.rank}</span>
                          <PlayerName name={row.name} cosmetics={row.cosmetics} dark={false} className="flex-1 text-midnight-800" />
                          <span className="font-semibold tabular-nums">{formatScore(row.total)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Weekly cup */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5" data-cup-board>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <Trophy className="h-4 w-4" />
                Weekly cup
              </h2>
              <p className="mt-2 text-sm text-midnight-700">
                Ten places on a 60 second clock, the same for everyone this week. Free, outside your Google rounds.
                {cup?.endsAt ? ` Ends ${untilText(cup.endsAt)}.` : ''}
              </p>
              <p className="mt-1 text-xs text-midnight-500">Prizes in points: 300, 200 and 100 for the top three, 50 for the rest of the top ten, 20 for finishing.</p>
              <button
                type="button"
                onClick={() => start({ mode: 'cup', provider: 'google' })}
                disabled={!server?.providers?.google?.configured}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-midnight-900 px-4 py-2 text-sm font-semibold text-white hover:bg-midnight-800 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {cup?.you ? (cup.you.finished ? 'Play the ten again' : 'Finish the ten') : "Play this week's ten"}
              </button>
              {cup ? (
                <div className="mt-4 border-t border-midnight-100 pt-3">
                  <p className="text-sm text-midnight-700">
                    {cup.you?.rank
                      ? `You are ${ordinal(cup.you.rank)} of ${cup.finished} who finished this week.`
                      : cup.you
                        ? `Your ${cup.you.rounds} of ${cup.rounds} rounds are in.`
                        : cup.finished
                          ? `${cup.finished} finished this week's ten so far.`
                          : 'Nobody has finished this week yet. Be first.'}
                  </p>
                  {cup.board?.length ? (
                    <ol className="mt-2 space-y-0.5 text-sm">
                      {cup.board.slice(0, 5).map((row) => (
                        <li key={row.profileId} className="flex items-center gap-2">
                          <span className="w-5 tabular-nums text-midnight-400">{row.rank}</span>
                          <PlayerName name={row.name} cosmetics={row.cosmetics} dark={false} className="flex-1 text-midnight-800" />
                          <span className="font-semibold tabular-nums">{formatScore(row.total)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Stats */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <Trophy className="h-4 w-4" />
                Your games
              </h2>
              {stats && stats.games ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-midnight-500">Played</dt>
                    <dd className="text-lg font-bold">{stats.games}</dd>
                  </div>
                  <div>
                    <dt className="text-midnight-500">Best score</dt>
                    <dd className="text-lg font-bold">{formatScore(stats.best)}</dd>
                  </div>
                  <div>
                    <dt className="text-midnight-500">Average</dt>
                    <dd className="text-lg font-bold">{formatScore(stats.average)}</dd>
                  </div>
                  <div>
                    <dt className="text-midnight-500">Best streak</dt>
                    <dd className="text-lg font-bold">{stats.bestStreak}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-midnight-600">Nothing yet. Results stay in this browser.</p>
              )}
              {history.length ? (
                <ul className="mt-4 divide-y divide-midnight-100 text-sm">
                  {history.map((game, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate text-midnight-700">
                        {MODES[game.config?.mode]?.short || game.config?.mode}
                        {game.config?.mode === 'country' ? ` ${game.config.region}` : ''}
                        {Number.isFinite(game.avgKm) ? <span className="text-midnight-400"> {formatDistance(game.avgKm)} avg</span> : null}
                      </span>
                      {game.code ? (
                        <Link href={`/geo/share?s=${encodeURIComponent(game.code)}`} className="font-semibold tabular-nums text-midnight-900 underline-offset-2 hover:underline">
                          {game.config?.mode === 'streak' ? `streak ${game.streak}` : formatScore(game.total)}
                        </Link>
                      ) : (
                        <span className="font-semibold tabular-nums">{game.config?.mode === 'streak' ? `streak ${game.streak}` : formatScore(game.total)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </aside>
        </div>

        <section className="mt-10 grid gap-6 rounded-2xl border border-midnight-200 bg-white p-5 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">How the spot is picked</h3>
            <p className="mt-1 text-sm text-midnight-600">
              The server draws a random point on the globe, throws it away if it is water, then asks Street View whether official imagery exists within the radius you chose. It keeps drawing until one hits. Nothing is pre-made, so no two games repeat unless you share a seed.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">How points work</h3>
            <p className="mt-1 text-sm text-midnight-600">
              5,000 for a guess within 25 metres, falling off with distance. The falloff is scaled to the area you are playing, so a 100 km miss inside one country costs more than a 100 km miss on the whole world.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Where the pictures come from</h3>
            <p className="mt-1 text-sm text-midnight-600">
              Google Street View or Apple Look Around, shown with their own logos and under their own terms. Country outlines are Natural Earth data. The answer never reaches your browser until you have guessed.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
