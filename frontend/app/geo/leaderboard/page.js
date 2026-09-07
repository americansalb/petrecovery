'use client';

/**
 * /geo/leaderboard: the ladders. Ratings are Glicko: a number and a
 * band of uncertainty, updated from every finished room (docs/GEO.md).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users } from 'lucide-react';
import { LADDERS, PROVISIONAL_GAMES } from '@/app/lib/geo/rating';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { profileHeaders } from '../lib/profile';

function RatingCell({ row }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold">{row.value}</span>
      <span className="text-midnight-400"> ±{Math.round(row.rd * 2)}</span>
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
    fetch(`/api/geo/leaderboard?ladder=${ladder}`, { headers: profileHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('leaderboard'))))
      .then((data) => alive && setBoard(data))
      .catch(() => alive && setError('Could not load the leaderboard.'));
    return () => {
      alive = false;
    };
  }, [ladder]);

  const you = board?.you;

  return (
    <div className="min-h-screen bg-midnight-50 text-midnight-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-midnight-500">
            <Link href="/geo" className="hover:underline">Where on Earth</Link>
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <Trophy className="h-7 w-7 text-flash-500" />
            Rankings
          </h1>
          <p className="mt-2 max-w-2xl text-midnight-600">
            Every finished room rates everyone in it against everyone else, with margin of victory counted. New players move fast and settle down. A rating shows once you have played {board?.minGames || 3} rated games; it stays provisional until {PROVISIONAL_GAMES}.
          </p>
        </header>

        <div className="mt-6 inline-flex rounded-xl bg-midnight-100 p-1" role="tablist">
          {LADDERS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={ladder === id} onClick={() => setLadder(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${ladder === id ? 'bg-midnight-900 text-white shadow' : 'text-midnight-700 hover:bg-white'}`}>
              {VARIANTS[id]?.label || id}
            </button>
          ))}
        </div>

        {you ? (
          <section className="mt-6 rounded-2xl border border-midnight-900 bg-midnight-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">You, {you.name}</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-4xl font-bold tabular-nums text-flash-300">{you.value}</p>
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

        {error ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p> : null}

        <section className="mt-6 overflow-x-auto rounded-2xl border border-midnight-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-midnight-50 text-left text-xs uppercase tracking-wide text-midnight-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Rating</th>
                <th className="px-4 py-2 text-right">Games</th>
                <th className="px-4 py-2 text-right">Wins</th>
                <th className="px-4 py-2 text-right">Podiums</th>
                <th className="px-4 py-2 text-right">Peak</th>
                <th className="px-4 py-2 text-right">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight-100">
              {board === null && !error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-midnight-500">Loading</td>
                </tr>
              ) : null}
              {board && !board.rows.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-midnight-600">
                    Nobody has {board.minGames} rated games on this ladder yet.
                  </td>
                </tr>
              ) : null}
              {(board?.rows || []).map((row) => (
                <tr key={row.profileId} className={row.profileId === you?.profileId ? 'bg-flash-50' : ''}>
                  <td className="px-4 py-2 tabular-nums text-midnight-500">{row.rank}</td>
                  <td className="px-4 py-2 font-semibold">{row.name}</td>
                  <td className="px-4 py-2 text-midnight-600">{row.tier}</td>
                  <td className="px-4 py-2"><RatingCell row={row} /></td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.games}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.wins}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.games ? `${Math.round((100 * row.podiums) / row.games)}%` : '0%'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.peak}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.streak ? `${row.streak}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-4 flex items-center gap-2 text-sm text-midnight-600">
          <Users className="h-4 w-4" />
          Ratings come from rooms only. Solo games and the daily challenge are not rated.
        </p>
      </div>
    </div>
  );
}
