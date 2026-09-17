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
  const [ladder, setLadder] = useState('classic');
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
            Find your place.
          </h1>
          {/* How rating works is worth knowing once and reading never.
              It was three lines above the table on every visit. */}
          <details className="mt-3 max-w-2xl text-sm text-white/60">
            <summary className="cursor-pointer font-semibold text-white/70 hover:text-white">
              How rating works
            </summary>
            <ul className="mt-2 space-y-1">
              <li>
                Classic and Duel rate you against everyone else in a finished
                room.
              </li>
              <li>
                Ranked solo rates this hour&apos;s five places against everyone
                who played them.
              </li>
              <li>
                A rating appears after {board?.minGames || 3} rated games and
                settles by {PROVISIONAL_GAMES}.
              </li>
            </ul>
          </details>
        </header>

        <RankPath />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={LADDERS.map((id) => ({
              id,
              label: LADDER_LABELS[id] || VARIANTS[id]?.label || id,
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
                : `/geo/rooms?variant=${ladder}`
            }
            data-ladder-play
          >
            {ladder === 'solo'
              ? "Play this hour's five"
              : `Open a ${LADDER_LABELS[ladder]?.toLowerCase() || ''} room`}
          </Button>
        </div>
        {board?.season ? (
          <p className="mt-2 text-sm text-white/60" data-season>
            {board.season.label} &middot; {board.season.daysLeft}{' '}
            {board.season.daysLeft === 1 ? 'day' : 'days'} left
          </p>
        ) : null}

        {you ? (
          <Card tone="marked" className="mt-6 text-white">
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
                    <Link href="/geo/rooms" className="underline">
                      Open a {LADDER_LABELS[ladder]?.toLowerCase() || ''} room
                    </Link>{' '}
                    with a friend to get one.
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
        <Card pad="none" className="mt-6 overflow-x-auto">
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
              {board === null && !error ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-white/60"
                  >
                    Loading
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
                      <strong>Be first on this ladder.</strong>
                      <p>
                        Complete {PROVISIONAL_GAMES} placement games to reveal your
                        league.
                      </p>
                      <Link
                        href={
                          ladder === 'solo'
                            ? '/geo/play?mode=ranked'
                            : `/geo/rooms?variant=${ladder}`
                        }
                      >
                        Start your climb <span aria-hidden="true">↗</span>
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
          Only these three are rated.{' '}
          <Link href="/geo" className="ml-1 underline hover:text-white">
            Everything else is in Play
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
