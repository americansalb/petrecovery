'use client';

/**
 * The front door.
 *
 * What was here before was a settings form. A stranger arriving from a
 * search result had to choose imagery, then a mode from seven cards of
 * dense text, then a round count, a timer, a format and a search
 * radius, and only then was there a button. Eight different buttons on
 * the page started a game and nothing said which one was the game.
 *
 * So: one button (founder direction, 2026-09-16). The page is the
 * world, the button starts a round, and everything that used to be on
 * this page is either behind Settings or behind the navigation. Nobody
 * has to decide anything to play, and nobody has to sign in.
 *
 * The other ways in stay as one quiet row, because a player who has
 * been here before is looking for the daily and should not have to hunt
 * for it. They are text, not cards.
 */

import { useEffect, useState } from 'react';
import { loadGeoConfig } from '../../lib/serverConfig';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe2, Play, Settings2, Sparkles } from 'lucide-react';
import { configToParams, DEFAULT_CONFIG } from '@/app/lib/geo/modes';
import { isSignedIn } from '@/app/geo/lib/session';
import { getStats } from '../../lib/storage';
import WorldBackdrop from './WorldBackdrop';
import './home.css';

/** The other doors. Text, in one row, in the order a returning player wants them. */
const WAYS = [
  { href: '/geo/play?mode=daily', label: 'Daily' },
  { href: '/geo/script', label: 'Script' },
  { href: '/geo/rooms', label: 'Rooms' },
  { href: '/geo/leaderboard', label: 'Rankings' },
];

export default function ColdOpen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [stats, setStats] = useState(null);
  const [starting, setStarting] = useState(false);
  // null while the answer is unknown, which is not the same as "no".
  const [imagery, setImagery] = useState(null);

  useEffect(() => {
    setSignedIn(isSignedIn());
    setStats(getStats());
    let live = true;
    // Whether ANY street imagery is available. Neither Apple nor Google
    // is guaranteed: a deployment without those keys used to send every
    // visitor from this button to a dead end reading "Apple Look Around
    // did not load. Back to the lobby", which is the worst possible
    // first minute. Script needs no key and no quota, so when there is
    // no imagery the button starts the game that works instead of the
    // game that cannot.
    loadGeoConfig({ shouldStop: () => !live })
      .then((data) => {
        if (!live || !data) return;
        setImagery(Boolean(data.providers?.apple?.configured));
      })
      .catch(() => {
        // Unreachable config is not proof of missing imagery, and
        // guessing "no" here would send a working site to Script.
      });
    return () => {
      live = false;
    };
  }, []);

  // The default game, which is the whole point: no choices on the way
  // in. Anything else a player wants is behind Settings, and their last
  // settings are remembered there rather than asked for here.
  const start = () => {
    setStarting(true);
    if (imagery === false) {
      router.push('/geo/script/play?ladder=world&rounds=5');
      return;
    }
    router.push(`/geo/play?${configToParams(DEFAULT_CONFIG).toString()}`);
  };

  const played = stats?.games || 0;
  const scriptOnly = imagery === false;

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden text-sand-50">
      <WorldBackdrop />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <Globe2 className="h-5 w-5 text-clay-300" />
          Probably Earth
        </span>
        <Link
          href={signedIn ? '/geo/me' : '/geo/me?signin=1'}
          className="rounded-full px-4 py-2 text-sm font-semibold text-sand-100/80 transition hover:bg-sand-50/10 hover:text-white"
        >
          {signedIn ? 'Your profile' : 'Sign in'}
        </Link>
      </header>

      {/* pointer-events-none so the globe behind can be grabbed
          anywhere the hero is not an actual control; each control
          switches them back on. */}
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        <h1 className="geo-rise text-[clamp(2.75rem,10vw,5.5rem)] font-black leading-[0.95] tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
          Probably Earth
        </h1>
        <p className="geo-rise mt-4 max-w-md text-balance text-lg text-sand-100/85 sm:text-xl" style={{ animationDelay: '80ms' }}>
          {scriptOnly
            ? 'You are given a sentence in one of 159 languages. Work out where it is spoken, and put a pin on it.'
            : 'You are standing on a street somewhere on Earth. Work out where, and put a pin on it.'}
        </p>

        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="geo-rise pointer-events-auto mt-9 inline-flex items-center gap-3 rounded-2xl bg-clay-500 px-11 py-5 ring-1 ring-clay-300/40 text-xl font-bold text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] transition hover:bg-clay-400 hover:ring-clay-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-200 disabled:opacity-70 sm:text-2xl"
          style={{ animationDelay: '160ms' }}
          data-cold-open-play
        >
          <Play className="h-6 w-6 fill-current" />
          {starting ? 'Finding a street' : played ? 'Play again' : 'Play'}
        </button>

        {/* This said "No account needed", which sells the opposite of
            what is wanted: an account is never required and always
            worth having, so the line under Play offers one instead of
            talking people out of it (founder, 2026-09-16). */}
        <p className="geo-rise mt-4 text-sm text-sand-200/70" style={{ animationDelay: '220ms' }}>
          {signedIn ? (
            played ? `${played} ${played === 1 ? 'game' : 'games'} played.` : 'Signed in. Your scores follow you.'
          ) : (
            <>
              {played ? `${played} ${played === 1 ? 'game' : 'games'} in this browser. ` : ''}
              <Link href="/geo/me?signin=1" className="pointer-events-auto font-semibold text-sand-100 underline decoration-sand-200/40 underline-offset-4 hover:decoration-sand-100">
                {played ? 'Sign in to keep them' : 'Sign in to keep your scores'}
              </Link>
              . One email, no password.
            </>
          )}
        </p>
        {scriptOnly ? (
          <p className="geo-rise mt-2 max-w-sm text-xs text-sand-200/55" style={{ animationDelay: '240ms' }}>
            Street imagery is off on this deployment, so Play starts the language game. Everything else works.
          </p>
        ) : null}

      </div>

      {/* The credits belong on the page and not in the middle of it:
          small, quiet, and one line wherever there is room for one. */}
      <footer className="relative z-10 px-5 pb-5 text-center text-[11px] leading-relaxed text-sand-200/45 sm:px-8 sm:text-xs">
        <p className="inline-flex flex-wrap items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Street imagery from Apple Look Around, under Apple&apos;s terms. Country outlines from Natural Earth.</span>
          <span className="sm:hidden">Imagery: Apple Look Around. Outlines: Natural Earth.</span>
        </p>
      </footer>
    </main>
  );
}
