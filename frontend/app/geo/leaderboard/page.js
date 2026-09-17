'use client';

/**
 * /geo/leaderboard: the ladders. Ratings are Glicko: a number and a
 * band of uncertainty, updated from every finished room (docs/GEO.md).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users } from 'lucide-react';
import { LADDERS, LADDER_LABELS, PROVISIONAL_GAMES } from '@/app/lib/geo/rating';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { profileHeaders } from '../lib/profile';
import PlayerName from '../components/PlayerName';
import Contests from '../components/Contests';
import OtherModes from '../components/OtherModes';

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
  const [solo, setSolo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setBoard(null);
    fetch(`/api/geo/leaderboard?ladder=${ladder}`, { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('leaderboard'))))
      .then((data) => alive && setBoard(data))
      .catch(() => alive && setError('Could not load the leaderboard.'));
    return () => {
      alive = false;
    };
  }, [ladder]);

  // Asked for once, not per tab: the Ranked panel below shows the solo
  // standing whichever ladder is on screen.
  useEffect(() => {
    let alive = true;
    fetch('/api/geo/leaderboard?ladder=solo', { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => alive && setSolo(data?.you || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const you = board?.you;

  return (
    <div className="min-h-screen bg-ocean-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
            <Link href="/geo" className="hover:underline">Probably Earth</Link>
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <Trophy className="h-7 w-7 text-clay-300" />
            Rankings
          </h1>
          <ul className="mt-3 max-w-2xl space-y-1 text-sm text-white/60">
            <li>Classic and Duel rate you against everyone else in a finished room.</li>
            <li>Ranked solo rates this hour&apos;s five places against everyone who played them.</li>
            <li>A rating appears after {board?.minGames || 3} rated games and settles by {PROVISIONAL_GAMES}.</li>
          </ul>
        </header>

        <div className="mt-6 inline-flex rounded-xl bg-white/5 p-1" role="tablist">
          {LADDERS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={ladder === id} onClick={() => setLadder(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${ladder === id ? 'bg-ocean-900 text-white shadow' : 'text-white/70 hover:bg-ocean-900/60'}`}>
              {LADDER_LABELS[id] || VARIANTS[id]?.label || id}
            </button>
          ))}
        </div>
        {board?.season ? (
          <p className="mt-2 text-sm text-white/60" data-season>
            {board.season.label}. {board.season.daysLeft} {board.season.daysLeft === 1 ? 'day' : 'days'} left. Finishing Silver or better
            on a ladder, with three rated games on it, pays points.
          </p>
        ) : null}

        {you ? (
          <section className="mt-6 rounded-2xl border border-clay-400 bg-ocean-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">You, {you.name}</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-4xl font-bold tabular-nums text-clay-300">{you.value}</p>
                <p className="text-sm text-white/70">
                  {you.tier}
                  {you.provisional ? ', provisional' : ''} · likely between {you.low} and {you.high}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-white/60">Rank</dt>
                  <dd className="font-semibold">{you.rank ? `#${you.rank}` : 'unranked'}</dd>
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
              <p className="mt-3 text-sm text-white/70">
                No rated games yet. <Link href="/geo/rooms" className="underline">Open a room</Link> with a friend to get one.
              </p>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="mt-6 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-2 text-sm text-red-200">{error}</p> : null}

        {/* Rank, player and rating on a phone; the rest as the screen
            allows. Nine columns behind a sideways scroll meant the one
            number this page is about was the one you could not see. */}
        <section className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-ocean-900/60">
          <table className="w-full text-sm">
            <thead className="bg-ocean-950 text-left text-xs uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="hidden px-4 py-2 sm:table-cell">Tier</th>
                <th className="px-4 py-2">Rating</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">Games</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">Wins</th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">Podiums</th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">Peak</th>
                <th className="hidden px-4 py-2 text-right lg:table-cell">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {board === null && !error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-white/60">Loading</td>
                </tr>
              ) : null}
              {board && !board.rows.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-white/60">
                    Nobody has {board.minGames} rated games on this ladder yet.
                  </td>
                </tr>
              ) : null}
              {(board?.rows || []).map((row) => (
                <tr key={row.profileId} className={row.profileId === you?.profileId ? 'bg-clay-500/10' : ''}>
                  <td className="px-4 py-2 tabular-nums text-white/60">{row.rank}</td>
                  <td className="px-4 py-2 font-semibold">
                    <PlayerName name={row.name} cosmetics={row.cosmetics} />
                  </td>
                  <td className="hidden px-4 py-2 text-white/60 sm:table-cell">{row.tier}</td>
                  <td className="px-4 py-2"><RatingCell row={row} /></td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{row.games}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{row.wins}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">{row.games ? `${Math.round((100 * row.podiums) / row.games)}%` : '0%'}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">{row.peak}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums lg:table-cell">{row.streak ? `${row.streak}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Users className="h-4 w-4" />
          Nothing else is rated: the daily challenge, the weekly cup and an ordinary game are for the board and for points.
        </p>

        <Contests solo={solo} />
        <OtherModes />
      </div>
    </div>
  );
}
