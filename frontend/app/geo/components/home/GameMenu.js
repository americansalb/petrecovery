'use client';

/**
 * /geo: the game menu.
 *
 * It was one enormous Play button on a globe and a row of four text
 * links. Quick to enter and impossible to understand: nothing on it
 * said the game had a second family (Script), that you could play with
 * people, or that there were competitions running right now. Those
 * lived on Rankings, which is a standings page, so the only way to find
 * Country Streak was to read a leaderboard (founder, 2026-09-17: "I
 * should never have to dig through a ranking report to find a casual
 * mode").
 *
 * So this is a menu. The quick start stays the biggest thing on it -
 * one click to a street, no account, no form - and the rest of the
 * product is visible beside it rather than described somewhere else.
 *
 * Every status on it is real or absent. Nothing here invents a player
 * count, a rank or a streak for atmosphere.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Flag, Globe2, Languages, MapPin, Play, Timer, Trophy, Users } from 'lucide-react';
import { CONTINENTS, CONTINENT_ORDER, configToParams, DEFAULT_CONFIG, FORMATS, formatOf, MODES } from '@/app/lib/geo/modes';
import { PROVISIONAL_GAMES } from '@/app/lib/geo/rating';
import { ordinal } from '@/app/lib/geo/distance';
import { untilText } from '@/app/lib/geo/meter';
import { APPLE_COVERAGE_NAMES, citiesFor } from '@/app/lib/geo/coverage';
import { isSignedIn } from '@/app/geo/lib/session';
import { profileHeaders } from '../../lib/profile';
import { getStats } from '../../lib/storage';
import { loadGeoConfig } from '../../lib/serverConfig';
import ScriptSample from '../script/ScriptSample';
import WorldBackdrop from './WorldBackdrop';
import './home.css';

/** A real sentence from the corpus, so the Script card shows the game. */
const SCRIPT_SAMPLE = { script: 'taml', text: 'இன்று காலை மிகவும் குளிராக இருந்தது' };

const FIELD = 'rounded-xl border border-white/15 bg-ocean-950/60 px-3 py-2 text-sm text-white';
const GO = 'inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10';

/** The covered countries by name, so the list reads as places. */
const COUNTRIES = Object.entries(APPLE_COVERAGE_NAMES)
  .map(([code, name]) => ({ code, name: name.replace(/^the /, '') }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Rule chips for the default game, read from the config rather than typed. */
function defaultChips() {
  const c = DEFAULT_CONFIG;
  return [`${c.rounds} rounds`, c.time ? `${c.time}s a round` : 'No timer', FORMATS[formatOf(c)]?.label].filter(Boolean);
}

function Chips({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {items.map((chip) => (
        <li key={chip} className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/70">
          {chip}
        </li>
      ))}
    </ul>
  );
}

/** A competition tile: what it is, where you stand, one way in. */
function Compete({ icon: Icon, name, chips, status, href, cta, marker }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-white/10 bg-ocean-900/60 p-4 transition hover:border-white/25 hover:bg-ocean-900/80"
      {...(marker ? { [marker]: true } : {})}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-clay-300" />
        {name}
      </p>
      <Chips items={chips} />
      <p className="mt-3 flex-1 text-sm text-white/60">{status}</p>
      <span className="mt-3 text-sm font-semibold text-clay-300 group-hover:text-clay-200">{cta} &rarr;</span>
    </Link>
  );
}

export default function GameMenu() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [stats, setStats] = useState(null);
  const [starting, setStarting] = useState(false);
  const [imagery, setImagery] = useState(null);
  const [daily, setDaily] = useState(null);
  const [cup, setCup] = useState(null);
  const [solo, setSolo] = useState(null);
  const [openRooms, setOpenRooms] = useState(null);
  const [continent, setContinent] = useState('europe');
  const [country, setCountry] = useState('JP');

  useEffect(() => {
    setSignedIn(isSignedIn());
    setStats(getStats());
    let live = true;
    const get = (url, set, pick = (d) => d) =>
      fetch(url, { headers: profileHeaders(), cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        // A status that will not load is a status that is not shown.
        // The way in beside it still works, which is the part that matters.
        .then((d) => live && d && set(pick(d)))
        .catch(() => {});
    get('/api/geo/daily', setDaily);
    get('/api/geo/cup', setCup);
    get('/api/geo/leaderboard?ladder=solo', setSolo, (d) => d.you || null);
    get('/api/geo/rooms', setOpenRooms, (d) => (Array.isArray(d.rooms) ? d.rooms.length : null));
    loadGeoConfig({ shouldStop: () => !live })
      .then((data) => live && data && setImagery(Boolean(data.providers?.apple?.configured)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const scriptOnly = imagery === false;
  const played = stats?.games || 0;

  const start = () => {
    setStarting(true);
    if (scriptOnly) {
      router.push('/geo/script/play?ladder=world&rounds=5');
      return;
    }
    router.push(`/geo/play?${configToParams(DEFAULT_CONFIG).toString()}`);
  };

  // Real places from the pool a round actually draws from, so the Street
  // card shows the game rather than another globe. Apple's imagery
  // cannot be redistributed as a still, so the honest sample is where
  // you might land.
  //
  // One per country: the list is in file order and its first six rows
  // are all American, which is the opposite of what this mode does.
  const places = (() => {
    const seen = new Set();
    const picked = [];
    for (const city of citiesFor()) {
      if (seen.has(city.country)) continue;
      seen.add(city.country);
      picked.push(city.name);
      if (picked.length === 6) break;
    }
    return picked.join(' · ');
  })();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <WorldBackdrop />
      {/* The globe is the brand, not the page. Everything below sits on
          a scrim so the menu is readable over it. */}
      <div className="pointer-events-none absolute inset-0 bg-ocean-950/70" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="geo-rise">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Probably Earth</h1>
          <p className="mt-2 max-w-xl text-white/70">
            {scriptOnly
              ? 'Read the sentence. Pin where the language is used.'
              : 'You get dropped on a street somewhere in the world. Put a pin where you think you are.'}
          </p>
        </header>

        {/* Quick start, then the other two ways to play. The primary
            action is the only one this size. */}
        <div className="geo-rise mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]" style={{ animationDelay: '60ms' }}>
          <section className="flex flex-col rounded-2xl border border-clay-400/40 bg-ocean-900/70 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Globe2 className="h-4 w-4 text-clay-300" />
              Street
            </p>
            <p className="mt-2 text-white/70">Look around. Place your pin. See how close you get.</p>
            <Chips items={defaultChips()} />
            <p className="mt-3 flex-1 truncate text-xs text-white/40" title={places}>
              {places}
            </p>
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="mt-4 inline-flex items-center justify-center gap-3 rounded-xl bg-clay-500 px-8 py-4 text-xl font-bold text-white transition hover:bg-clay-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-200 disabled:opacity-70"
              data-cold-open-play
            >
              <Play className="h-5 w-5 fill-current" />
              {starting ? 'Finding a street' : played ? 'Play again' : 'Play'}
            </button>
            {scriptOnly ? (
              <p className="mt-2 text-xs text-white/50">Street imagery is off here, so Play starts Script.</p>
            ) : null}
          </section>

          <Link
            href="/geo/script"
            className="group flex flex-col rounded-2xl border border-white/10 bg-ocean-900/60 p-5 transition hover:border-white/25 hover:bg-ocean-900/80"
            data-menu-script
          >
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Languages className="h-4 w-4 text-clay-300" />
              Script
            </p>
            <p className="mt-2 text-white/70">Read the sentence. Pin where the language is used.</p>
            <div className="mt-3 flex-1 rounded-xl border border-sand-300 bg-[#fffdf8] p-3">
              <ScriptSample text={SCRIPT_SAMPLE.text} script={SCRIPT_SAMPLE.script} size="sm" />
            </div>
            <span className="mt-4 text-sm font-semibold text-clay-300 group-hover:text-clay-200">Choose a pool &rarr;</span>
          </Link>

          <Link
            href="/geo/rooms"
            className="group flex flex-col rounded-2xl border border-white/10 bg-ocean-900/60 p-5 transition hover:border-white/25 hover:bg-ocean-900/80"
            data-menu-friends
          >
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Users className="h-4 w-4 text-clay-300" />
              Friends
            </p>
            <p className="mt-2 text-white/70">Same places, same clock, everyone at once.</p>
            <p className="mt-3 flex-1 text-sm text-white/60">
              {openRooms === null ? '' : openRooms ? `${openRooms} open ${openRooms === 1 ? 'room' : 'rooms'}.` : 'No open rooms. Start one.'}
            </p>
            <span className="mt-4 text-sm font-semibold text-clay-300 group-hover:text-clay-200">Create or join &rarr;</span>
          </Link>
        </div>

        <h2 className="geo-rise mt-8 text-sm font-semibold uppercase tracking-wide text-white/60" style={{ animationDelay: '120ms' }}>
          Compete
        </h2>
        <div className="geo-rise mt-3 grid gap-4 sm:grid-cols-3" style={{ animationDelay: '140ms' }}>
          <Compete
            icon={CalendarDays}
            name="Daily"
            chips={[`${MODES.daily.fixed.rounds} rounds`, 'No timer', 'Same for everyone']}
            status={
              daily?.you?.rank
                ? `You are ${ordinal(daily.you.rank)} of ${daily.finished} today.`
                : daily?.finished
                  ? `${daily.finished} finished today.`
                  : 'Nobody has finished today.'
            }
            href="/geo/play?mode=daily"
            cta="Play today's five"
            marker="data-menu-daily"
          />
          <Compete
            icon={Timer}
            name="Ranked"
            chips={[`${MODES.ranked.fixed.rounds} rounds`, `${MODES.ranked.fixed.time}s`, 'No Move']}
            // A rating is not shown until it means something. 1500 is
            // where everyone starts, so printing "Silver, 1500" after
            // one game reads as an accomplishment nobody has; placement
            // progress is the honest status until the ladder places you.
            status={
              solo?.games >= PROVISIONAL_GAMES
                ? `${solo.tier}, ${solo.value}. ${solo.games} rated.`
                : `${solo?.games || 0} of ${PROVISIONAL_GAMES} placement games played`
            }
            href="/geo/play?mode=ranked"
            cta="Play this hour's five"
            marker="data-menu-ranked"
          />
          <Compete
            icon={Trophy}
            name="Weekly cup"
            chips={[`${MODES.cup.fixed.rounds} rounds`, `${MODES.cup.fixed.time}s`, 'No Move']}
            status={
              cup?.endsAt
                ? cup.you?.rank
                  ? `You are ${ordinal(cup.you.rank)} of ${cup.finished}. Ends ${untilText(cup.endsAt)}.`
                  : `Ends ${untilText(cup.endsAt)}.`
                : ''
            }
            href="/geo/play?mode=cup"
            cta="Play this week's ten"
            marker="data-menu-cup"
          />
        </div>

        <h2 className="geo-rise mt-8 text-sm font-semibold uppercase tracking-wide text-white/60" style={{ animationDelay: '180ms' }}>
          More ways to play
        </h2>
        <div className="geo-rise mt-3 flex flex-wrap items-center gap-2" style={{ animationDelay: '200ms' }}>
          <Link href="/geo/play?mode=streak" className={GO} data-menu-streak>
            <Flag className="h-4 w-4 text-clay-300" />
            Country streak
          </Link>
          {/* A region, because "one continent" is not a mode until you
              say which. These were selects on the Rankings page; moving
              the catalogue into Play must not cost the choice. */}
          <span className="inline-flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-clay-300" aria-hidden="true" />
            <select value={continent} onChange={(e) => setContinent(e.target.value)} aria-label="Continent" className={FIELD}>
              {CONTINENT_ORDER.map((id) => (
                <option key={id} value={id}>
                  {CONTINENTS[id].label}
                </option>
              ))}
            </select>
            <Link href={`/geo/play?mode=continent&region=${continent}`} className={GO} data-menu-continent>
              Play
            </Link>
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-clay-300" aria-hidden="true" />
            <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className={FIELD}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link href={`/geo/play?mode=country&region=${country}`} className={GO} data-menu-country>
              Play
            </Link>
          </span>
        </div>

        <p className="geo-rise mt-8 text-sm text-white/60" style={{ animationDelay: '240ms' }}>
          {signedIn ? (
            played ? `${played} ${played === 1 ? 'game' : 'games'} played.` : 'Signed in. Your scores follow you.'
          ) : (
            <>
              {"It's free. "}
              <Link href="/geo/signin" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Sign in
              </Link>
              {' and your scores follow you to your phone.'}
            </>
          )}
        </p>
      </div>
    </main>
  );
}
