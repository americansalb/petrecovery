'use client';

/**
 * /geo/leaderboard: the ladders. Ratings are Glicko: a number and a
 * band of uncertainty, updated from every finished room (docs/GEO.md).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users } from 'lucide-react';
import {
  LADDERS,
  LADDER_LABELS,
  PROVISIONAL_GAMES,
} from '@/app/lib/geo/rating';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { profileHeaders } from '../lib/profile';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import PlayerName from '../components/PlayerName';
import RankPath from '../components/RankPath';

function RatingCell({ row }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold">{row.value}</span>
      <span className="text-white/40"> ±{Math.round(row.rd * 2)}</span>
    </span>
  );
}

export default function GeoLeaderboardPage() {
  const [ladder, setLadder] = useState('duel');
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError('');
    fetch(`/api/geo/leaderboard?ladder=${ladder}`, {
      headers: profileHeaders(),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('leaderboard'))))
      .then((data) => alive && setBoard(data))
      .catch(() => alive && setError('Could not load the leaderboard.'));
    return () => {
      alive = false;
    };
  }, [ladder]);

  const you = board?.you;

  return (
    <div className="pe-secondary-page min-h-screen text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
            <Link href="/geo" className="hover:underline">
              Probably Earth
            </Link>
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <Trophy className="h-7 w-7 text-clay-300" />
            Rankings
          </h1>
          {/* How rating works is worth knowing once and reading never.
              It was three lines above the table on every visit. */}
          <details className="mt-3 max-w-2xl text-sm text-white/60">
            <summary className="cursor-pointer font-semibold text-white/70 hover:text-white">
              How rating works
            </summary>
            {/* The six leagues, and where each one starts. This was the
                first thing on the page: a grid of six emblems above a
                table with nobody in it, explaining a rating that a
                first-time visitor does not have and cannot get without
                playing. It is the legend for the Rating column, so it
                reads once with the rest of the explanation. */}
            <RankPath />
            <ul className="mt-2 space-y-1">
              <li>
                Street and Script have separate ratings, based on your results against other players.
              </li>
              <li>
                Ranked solo rates this hour&apos;s five places against everyone
                who played them.
              </li>
              <li>
                Finish {PROVISIONAL_GAMES} placement matches to join the rankings.
              </li>
              <li>Leagues follow your position among placed players this season. Small pools round each percentile cutoff up to a whole player.</li>
              <li>Meteorite requires a top-five position, 20 rated matches and 80% average accuracy. Accuracy means round points earned out of the points available, including missed rounds. It is not win rate or remaining health.</li>
              <li>Your league can change when other players move past you. Rating ties are ordered by games played, then a stable player ID.</li>
            </ul>
          </details>
        </header>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={LADDERS.filter((id) => id !== 'classic').map((id) => ({
              id,
              label: id === 'duel' ? 'Street multiplayer' : LADDER_LABELS[id] || VARIANTS[id]?.label || id,
            }))}
            value={ladder}
            onChange={setLadder}
            label="Ladders"
            marker="ladder-tab"
          />
          {/* The way into the ladder on screen. Solo is a solo ladder: it
            can only be entered by playing the ranked hour, and sending
            an unplaced player to open a room was the bug. */}
          <Button
            href={
              ladder === 'solo'
                ? '/geo/play?mode=ranked'
                : `/geo/rooms?game=${ladder === 'script' ? 'script' : 'street'}`
            }
            data-ladder-play
          >
            {ladder === 'solo'
              ? "Play this hour's five"
              : 'Play multiplayer'}
          </Button>
        </div>
        {/* The line is always there. It used to appear when the board
            arrived and push the table down 28px while the page was being
            read, so the shape is held with a placeholder the height of
            one line of text. */}
        {board?.season ? (
          <p className="mt-2 text-sm text-white/60" data-season>
            {board.season.label} &middot; {board.season.daysLeft}{' '}
            {board.season.daysLeft === 1 ? 'day' : 'days'} left
          </p>
        ) : !error ? (
          <p className="mt-2 flex h-5 items-center" aria-hidden="true">
            <span className="pe-skeleton h-3 w-56" />
          </p>
        ) : null}

        {/* Somebody with a profile will get a card here; reserve it before
            the first paint so it does not shove the board down when it
            lands. :root[data-geo-profile] is set by an inline script in
            the layout, before anything is drawn (motion.css). */}
        {board === null && !error ? (
          <div className="pe-you-skeleton mt-6" aria-hidden="true">
            <Card tone="marked">
              <span className="pe-skeleton block h-3 w-24" />
              <span className="pe-skeleton mt-4 block h-9 w-40" />
              <span className="pe-skeleton mt-3 block h-3 w-52" />
              <span className="pe-skeleton mt-6 block h-3 w-64" />
            </Card>
          </div>
        ) : null}

        {you ? (
          <Card tone="marked" className="pe-swap mt-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              You, {you.name}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              {/* 1500 is where everyone starts, not something earned.
                  Printing it as "Silver, provisional" beside 0 games
                  reads as an accomplishment nobody has, so an unplaced
                  player is told they are unplaced and how far off it is
                  (founder, 2026-09-17). */}
              {you.games >= PROVISIONAL_GAMES ? (
                <div>
                  <p className="text-4xl font-bold tabular-nums text-clay-300">
                    {you.value}
                  </p>
                  <p className="text-sm text-white/70">
                    {you.tier}
                    {you.provisional ? ', provisional' : ''} · likely between{' '}
                    {you.low} and {you.high}
                  </p>
                  <p className="mt-1 text-sm text-white/70">{you.accuracy != null ? `${Math.floor(you.accuracy * 1000) / 10}% average accuracy` : 'Play a new rated match to start tracking accuracy.'}</p>
                </div>
              ) : (
                <div>
                  <p className="text-4xl font-bold text-white/80">Unplaced</p>
                  <p className="text-sm text-white/70">
                    Placement games: {you.games} of {PROVISIONAL_GAMES}
                  </p>
                  <div className="pe-placement-track" aria-hidden="true">
                    {Array.from({ length: PROVISIONAL_GAMES }, (_, i) => (
                      <span key={i} data-complete={i < you.games} />
                    ))}
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-white/60">Rank</dt>
                  <dd className="font-semibold">
                    {you.rank ? `#${you.rank}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/60">Games</dt>
                  <dd className="font-semibold">{you.games}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Wins</dt>
                  <dd className="font-semibold">{you.wins}</dd>
                </div>
              </dl>
            </div>
            {!you.games ? (
              /* The destination has to match the ladder on screen. This
                 said "open a room with a friend" on every tab including
                 Ranked solo, which is a solo ladder a room cannot rate
                 (founder, 2026-09-17). */
              <p className="mt-3 text-sm text-white/70">
                {ladder === 'solo' ? (
                  <>
                    No rated games yet.{' '}
                    <Link href="/geo/play?mode=ranked" className="underline">
                      Play this hour&apos;s five
                    </Link>{' '}
                    to start placing.
                  </>
                ) : (
                  <>
                    No rated games yet.{' '}
                    <Link href={`/geo/rooms?game=${ladder === 'script' ? 'script' : 'street'}`} className="underline">
                      Play {ladder === 'script' ? 'Script' : 'Street'} multiplayer
                    </Link>{' '}
                    to start placing.
                  </>
                )}
              </p>
            ) : null}
          </Card>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {/* Rank, player and rating on a phone; the rest as the screen
            allows. Nine columns behind a sideways scroll meant the one
            number this page is about was the one you could not see. */}
        {/* Keyed on the ladder and on whether it has loaded, so both
            choosing a ladder and the rows arriving are a fade rather than
            a swap. */}
        <Card key={`${ladder}:${board ? 'board' : 'loading'}`} pad="none" className="pe-swap mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ocean-950 text-left text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="hidden px-4 py-2 sm:table-cell">Tier</th>
                <th className="px-4 py-2">Rating</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">
                  Games
                </th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">
                  Wins
                </th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">
                  Podiums
                </th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">
                  Peak
                </th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">
                  Streak
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {/* While the board loads: the empty state itself, invisible,
                  under a shimmer. The one-line "Loading" row this replaces
                  was 50px tall and the empty state is 282, so the page
                  grew by 232px about three seconds in - measured, that was
                  most of this page's layout shift. Rendering the real
                  shape invisibly keeps them the same height by
                  construction, rather than by a number that drifts. */}
              {board === null && !error ? (
                <tr aria-hidden="true">
                  <td colSpan={9} className="relative px-4 py-6 text-center">
                    <div className="pe-ladder-empty invisible">
                      <Trophy size={35} strokeWidth={1.2} />
                      <strong>No ranked players yet</strong>
                      <p>Finish {PROVISIONAL_GAMES} placement matches to appear here.</p>
                      <span>Play</span>
                    </div>
                    <span className="pe-skeleton absolute inset-x-4 inset-y-6" />
                  </td>
                </tr>
              ) : null}
              {board && !board.rows.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-white/60"
                  >
                    <div className="pe-ladder-empty">
                      <Trophy size={35} strokeWidth={1.2} />
                      <strong>No ranked players yet</strong>
                      <p>
                        Finish {PROVISIONAL_GAMES} placement matches to appear here.
                      </p>
                      <Link
                        href={
                          ladder === 'solo'
                            ? '/geo/play?mode=ranked'
                            : `/geo/rooms?game=${ladder === 'script' ? 'script' : 'street'}`
                        }
                      >
                        Play <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
              {(board?.rows || []).map((row) => (
                <tr
                  key={row.profileId}
                  className={
                    row.profileId === you?.profileId ? 'bg-clay-500/10' : ''
                  }
                >
                  <td className="px-4 py-2 tabular-nums text-white/60">
                    {row.rank}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    <PlayerName name={row.name} cosmetics={row.cosmetics} />
                    <span className="block text-xs font-normal text-white/70 sm:hidden">{row.tier}</span>
                  </td>
                  <td className="hidden px-4 py-2 text-white/60 sm:table-cell">
                    {row.tier}
                  </td>
                  <td className="px-4 py-2">
                    <RatingCell row={row} />
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                    {row.games}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                    {row.wins}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">
                    {row.games
                      ? `${Math.round((100 * row.podiums) / row.games)}%`
                      : '0%'}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">
                    {row.peak}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">
                    {row.streak ? `${row.streak}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Users className="h-4 w-4" />
          Street, Script and ranked solo have separate ratings.{' '}
          <Link href="/geo" className="ml-1 underline hover:text-white">
            Everything else is in Play
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
