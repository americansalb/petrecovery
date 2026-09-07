'use client';

/**
 * The lobby: provider, mode, rules, start. Also the daily challenge,
 * your local stats, and a plain explanation of how the random spot is
 * found. Settings are remembered in this browser.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Play, Trophy } from 'lucide-react';
import {
  CONTINENTS,
  CONTINENT_ORDER,
  MODES,
  MODE_ORDER,
  PROVIDERS,
  RADIUS_PRESETS,
  ROUND_OPTIONS,
  TIME_OPTIONS,
  configToParams,
  normalizeConfig,
  timeLabel,
} from '@/app/lib/geo/modes';
import { randomSeedString } from '@/app/lib/geo/random';
import { formatDistance, formatScore } from '@/app/lib/geo/distance';
import { getHistory, getStats } from '../lib/storage';
import SetupNotice from './SetupNotice';

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

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-midnight-300 text-midnight-900 focus:ring-flash-400" />
      {label}
    </label>
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

  useEffect(() => {
    let alive = true;
    fetch('/api/geo/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
      .then((data) => alive && setServer(data))
      .catch(() => alive && setServerError('Could not load the game settings from the server.'));
    setStats(getStats());
    setHistory(getHistory().slice(0, 8));
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
  const fixed = config.mode === 'daily';

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
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Where on Earth</h1>
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
              {fixed ? <p className="mt-2 text-sm text-midnight-600">The daily challenge uses fixed rules so scores compare: 5 rounds, no timer, moving allowed.</p> : null}
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                {config.mode !== 'streak' ? <Segmented label="Rounds" options={ROUND_OPTIONS} value={config.rounds} onChange={setRounds} disabled={fixed} /> : null}
                <Segmented label="Time per round" options={TIME_OPTIONS} value={config.time} onChange={setTime} format={timeLabel} disabled={fixed} />
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-midnight-500">Movement</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <Toggle label="Move" checked={config.move} onChange={setMove} disabled={fixed} />
                    <Toggle label="Pan" checked={config.pan} onChange={setPan} disabled={fixed} />
                    <Toggle label="Zoom" checked={config.zoom} onChange={setZoom} disabled={fixed} />
                    <button
                      type="button"
                      disabled={fixed}
                      onClick={() => {
                        setMove(false);
                        setPan(false);
                        setZoom(false);
                      }}
                      className="rounded-lg border border-midnight-300 px-2 py-1 text-xs font-semibold hover:bg-midnight-100 disabled:opacity-50"
                      title="No move, pan or zoom: one view, that is all you get"
                    >
                      NMPZ
                    </button>
                  </div>
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
            {/* Daily */}
            <section className="rounded-2xl border border-midnight-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-midnight-500">
                <CalendarDays className="h-4 w-4" />
                Daily challenge
              </h2>
              <p className="mt-2 text-sm text-midnight-700">Five places, the same for everyone{server?.daily?.date ? ` on ${server.daily.date}` : ' today'}.</p>
              <button
                type="button"
                onClick={() => start({ mode: 'daily', provider: 'google' })}
                disabled={!server?.providers?.google?.configured}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-midnight-900 px-4 py-2 text-sm font-semibold text-white hover:bg-midnight-800 disabled:opacity-50"
              >
                {stats?.dailyPlayed ? <Check className="h-4 w-4 text-flash-400" /> : <Play className="h-4 w-4" />}
                {stats?.dailyPlayed ? 'Play today again' : "Play today's five"}
              </button>
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
